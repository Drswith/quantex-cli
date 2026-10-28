//! `--idempotency-key`: a successful mutation is recorded under `~/.quantex/idempotency/`
//! and replayed when the same request is retried, as long as its postcondition still
//! holds. Records, fingerprints, and evidence payloads match v1.13.6 byte for byte, so
//! either build can replay the other's records.

use std::fs;
use std::path::{Path, PathBuf};

use serde_json::{Map, Value, json};
use sha2::{Digest, Sha256};

use crate::catalog::{self, Agent};
use crate::context::Context;
use crate::lifecycle::{self, Drift, Kind, View};
use crate::protocol::{self, CommandError, ErrorCode, Outcome, Target};
use crate::providers::{self, Binding, Observed};
use crate::{probe, store};

const SCHEMA_VERSION: i64 = 1;
const TTL_MS: i64 = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Canonical form

/// v1 `stringifyCanonicalValue`: JSON with object keys in code-point order and no spaces.
fn canonical_string(value: &Value) -> String {
    match value {
        Value::Array(items) => format!("[{}]", items.iter().map(canonical_string).collect::<Vec<_>>().join(",")),
        // Object keys are kept sorted by byte, which for UTF-8 is code-point order.
        Value::Object(map) => format!(
            "{{{}}}",
            map.iter()
                .map(|(key, value)| format!("{}:{}", Value::from(key.as_str()), canonical_string(value)))
                .collect::<Vec<_>>()
                .join(",")
        ),
        other => other.to_string(),
    }
}

fn sha256_hex(text: &str) -> String {
    Sha256::digest(text.as_bytes())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// v1 `fingerprintCanonicalValue`.
pub fn fingerprint(value: &Value) -> String {
    sha256_hex(&canonical_string(value))
}

/// v1 `canonicalizeMutationRequest`.
pub fn request(action: &str, options: Value, targets: &[String]) -> Value {
    let mut targets = targets.to_vec();
    targets.sort();
    targets.dedup();
    json!({ "action": action, "options": options, "targets": targets })
}

fn fingerprinted(payload: &Value) -> Value {
    json!({ "fingerprint": fingerprint(payload), "payload": payload })
}

/// Items sorted by fingerprint, as v1 `sortUniqueEvidenceItems` stores them.
fn sorted_by_fingerprint(items: Vec<Value>) -> Option<Vec<Value>> {
    let mut keyed: Vec<(String, Value)> = items.into_iter().map(|item| (fingerprint(&item), item)).collect();
    keyed.sort_by(|left, right| left.0.cmp(&right.0));
    if keyed.windows(2).any(|pair| pair[0].0 == pair[1].0) {
        return None;
    }
    Some(keyed.into_iter().map(|(_, item)| item).collect())
}

// ---------------------------------------------------------------------------
// Records

fn records_dir(dir: &Path) -> PathBuf {
    dir.join("idempotency")
}

fn record_path(dir: &Path, key: &str) -> PathBuf {
    records_dir(dir).join(format!("{}.json", sha256_hex(key)))
}

enum Loaded {
    Missing,
    Expired,
    Invalid(&'static str),
    Valid(Value),
}

fn load(dir: &Path, key: &str) -> Loaded {
    let path = record_path(dir, key);
    let Ok(text) = fs::read_to_string(&path) else {
        return Loaded::Missing;
    };
    let Ok(value) = serde_json::from_str::<Value>(&text) else {
        return Loaded::Invalid("invalid-json");
    };
    if let Err(reason) = validate_record(&value) {
        return Loaded::Invalid(reason);
    }
    let expires = crate::time::parse_iso(value["expiresAt"].as_str().unwrap_or_default()).unwrap_or(0);
    if expires <= crate::time::now_millis() {
        let _ = fs::remove_file(&path);
        return Loaded::Expired;
    }
    Loaded::Valid(value)
}

fn save(dir: &Path, key: &str, postcondition: &Value, receipt: &Value, policy: &Policy, result: Value) {
    let now = crate::time::now_millis();
    let record = json!({
        "createdAt": crate::time::format_iso(now),
        "expiresAt": crate::time::format_iso(now + TTL_MS),
        "postcondition": fingerprinted(postcondition),
        "receipt": fingerprinted(receipt),
        "request": fingerprinted(&policy.request),
        "resolvedPlan": fingerprinted(&policy.resolved_plan),
        "result": result,
        "schemaVersion": SCHEMA_VERSION,
    });
    if validate_record(&record).is_err() || fs::create_dir_all(records_dir(dir)).is_err() {
        return;
    }
    let path = record_path(dir, key);
    let temporary = PathBuf::from(format!(
        "{}.{}.{}.tmp",
        path.display(),
        std::process::id(),
        uuid::Uuid::new_v4()
    ));
    let text = format!("{}\n", serde_json::to_string_pretty(&record).unwrap());
    if fs::write(&temporary, text).is_err() || fs::rename(&temporary, &path).is_err() {
        let _ = fs::remove_file(&temporary);
    }
}

// --- v1 `parseIdempotencyRecord`

fn has_exact_keys(map: &Map<String, Value>, keys: &[&str]) -> bool {
    map.len() == keys.len() && keys.iter().all(|key| map.contains_key(*key))
}

fn has_only_keys(map: &Map<String, Value>, keys: &[&str]) -> bool {
    map.keys().all(|key| keys.contains(&key.as_str()))
}

fn non_empty(value: Option<&Value>) -> bool {
    value.and_then(Value::as_str).is_some_and(|text| !text.is_empty())
}

fn iso_instant(value: Option<&Value>) -> Option<i64> {
    let text = value?.as_str()?;
    let millis = crate::time::parse_iso(text)?;
    (crate::time::format_iso(millis) == text).then_some(millis)
}

fn integer(value: &Value) -> Option<i64> {
    value.as_i64().or_else(|| {
        value
            .as_f64()
            .filter(|number| number.fract() == 0.0)
            .map(|number| number as i64)
    })
}

fn diagnostic(value: &Value) -> bool {
    let Some(map) = value.as_object() else { return false };
    has_only_keys(map, &["code", "details", "message"])
        && non_empty(map.get("code"))
        && non_empty(map.get("message"))
        && map.get("details").is_none_or(Value::is_object)
}

fn command_meta(value: &Value) -> bool {
    let Some(map) = value.as_object() else { return false };
    let optional_instant = |key: &str| map.get(key).is_none() || iso_instant(map.get(key)).is_some();
    has_only_keys(
        map,
        &[
            "fetchedAt",
            "mode",
            "runId",
            "schemaVersion",
            "source",
            "staleAfter",
            "timestamp",
            "version",
        ],
    ) && matches!(
        map.get("mode").and_then(Value::as_str),
        Some("human" | "json" | "ndjson")
    ) && non_empty(map.get("runId"))
        && non_empty(map.get("schemaVersion"))
        && iso_instant(map.get("timestamp")).is_some()
        && non_empty(map.get("version"))
        && optional_instant("fetchedAt")
        && optional_instant("staleAfter")
        && map
            .get("source")
            .is_none_or(|source| matches!(source.as_str(), Some("cache" | "network")))
}

fn command_target(value: &Value) -> bool {
    let Some(map) = value.as_object() else { return false };
    has_only_keys(map, &["kind", "name"])
        && matches!(
            map.get("kind").and_then(Value::as_str),
            Some("agent" | "config" | "self" | "system")
        )
        && (map.get("name").is_none() || non_empty(map.get("name")))
}

/// `Err(true)` when the result is a well-formed failure.
fn successful_result(value: &Value) -> Result<(), bool> {
    let Some(map) = value.as_object() else {
        return Err(false);
    };
    let well_formed = has_only_keys(
        map,
        &[
            "action", "data", "error", "exitCode", "meta", "ok", "target", "warnings",
        ],
    ) && non_empty(map.get("action"))
        && map.contains_key("error")
        && map.contains_key("ok")
        && map.get("meta").is_some_and(command_meta)
        && map
            .get("warnings")
            .and_then(Value::as_array)
            .is_some_and(|warnings| warnings.iter().all(diagnostic))
        && map.get("exitCode").is_none_or(|code| integer(code).is_some())
        && map.get("target").is_none_or(command_target);
    if !well_formed {
        return Err(false);
    }
    let exit_code = map.get("exitCode").and_then(integer);
    if map["ok"] != Value::Bool(true) || !map["error"].is_null() || exit_code.is_some_and(|code| code != 0) {
        return Err(map["ok"] == Value::Bool(false) && diagnostic(&map["error"]));
    }
    Ok(())
}

fn fingerprinted_payload(value: &Value) -> bool {
    value.as_object().is_some_and(|map| {
        has_exact_keys(map, &["fingerprint", "payload"])
            && map["fingerprint"].as_str().is_some_and(|text| {
                text.len() == 64 && text.bytes().all(|byte| matches!(byte, b'0'..=b'9' | b'a'..=b'f'))
            })
    })
}

fn canonical_request(value: &Value) -> bool {
    let Some(map) = value.as_object() else { return false };
    if !has_exact_keys(map, &["action", "options", "targets"])
        || !non_empty(map.get("action"))
        || !map["options"].is_object()
    {
        return false;
    }
    let Some(targets) = map["targets"].as_array() else {
        return false;
    };
    let names: Option<Vec<&str>> = targets
        .iter()
        .map(|target| target.as_str().filter(|text| !text.is_empty()))
        .collect();
    names.is_some_and(|names| names.windows(2).all(|pair| pair[0] < pair[1]))
}

fn single_receipt(value: &Value) -> bool {
    value.as_object().is_some_and(|map| {
        map.get("schemaVersion")
            .and_then(integer)
            .is_some_and(|version| version >= 1)
            && non_empty(map.get("providerId"))
            && non_empty(map.get("targetId"))
            && (map.get("version").is_none() || non_empty(map.get("version")))
    })
}

fn evidence_list(value: &Value, item: fn(&Value) -> bool) -> bool {
    let Some(items) = value.as_array() else { return false };
    if items.is_empty() || !items.iter().all(item) {
        return false;
    }
    let fingerprints: Vec<String> = items.iter().map(fingerprint).collect();
    fingerprints.windows(2).all(|pair| pair[0] < pair[1])
}

fn receipt_set(value: &Value) -> bool {
    value.as_object().is_some_and(|map| {
        has_exact_keys(map, &["items", "kind", "schemaVersion"])
            && map["kind"] == "receipt-set"
            && integer(&map["schemaVersion"]) == Some(SCHEMA_VERSION)
            && evidence_list(&map["items"], single_receipt)
    })
}

fn single_postcondition(value: &Value) -> bool {
    let Some(map) = value.as_object() else { return false };
    match map.get("kind").and_then(Value::as_str) {
        Some("package-absent" | "package-present") => {
            non_empty(map.get("providerId")) && non_empty(map.get("targetId"))
        }
        Some("executable-absent" | "executable-present") => non_empty(map.get("executable")),
        Some("version-satisfies") => non_empty(map.get("expectedVersion")) && non_empty(map.get("targetId")),
        _ => false,
    }
}

fn postcondition(value: &Value) -> bool {
    let Some(map) = value.as_object() else { return false };
    if map.get("kind").and_then(Value::as_str) == Some("all-of") {
        return has_exact_keys(map, &["items", "kind"]) && evidence_list(&map["items"], single_postcondition);
    }
    single_postcondition(value)
}

fn validate_record(value: &Value) -> Result<(), &'static str> {
    let Some(map) = value.as_object() else {
        return Err("malformed-record");
    };
    let Some(version) = map.get("schemaVersion") else {
        return Err("legacy-record");
    };
    if integer(version) != Some(SCHEMA_VERSION) {
        return Err("unsupported-schema");
    }
    if !has_exact_keys(
        map,
        &[
            "createdAt",
            "expiresAt",
            "postcondition",
            "receipt",
            "request",
            "resolvedPlan",
            "result",
            "schemaVersion",
        ],
    ) {
        return Err("malformed-record");
    }
    match (iso_instant(map.get("createdAt")), iso_instant(map.get("expiresAt"))) {
        (Some(created), Some(expires)) if expires > created => {}
        _ => return Err("invalid-timestamp"),
    }
    match successful_result(&map["result"]) {
        Ok(()) => {}
        Err(true) => return Err("failed-result"),
        Err(false) => return Err("malformed-record"),
    }
    let parts = ["request", "resolvedPlan", "receipt", "postcondition"];
    if !parts.iter().all(|part| fingerprinted_payload(&map[*part])) {
        return Err("malformed-record");
    }
    let payload = |part: &str| &map[part]["payload"];
    if !canonical_request(payload("request"))
        || !payload("resolvedPlan").is_object()
        || !(single_receipt(payload("receipt")) || receipt_set(payload("receipt")))
        || !postcondition(payload("postcondition"))
    {
        return Err("invalid-payload");
    }
    if parts
        .iter()
        .any(|part| map[*part]["fingerprint"].as_str() != Some(fingerprint(payload(part)).as_str()))
    {
        return Err("fingerprint-mismatch");
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Policies

/// A postcondition and receipt snapshot proving a mutation's effect.
pub type Evidence = (Value, Value);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Live {
    Satisfied,
    Drifted,
    Inconclusive,
}

/// The verified recorded source an uninstall removed.
#[derive(Debug, Clone)]
struct AbsenceSource {
    agent_target_id: String,
    binding: Binding,
    executable_name: String,
    receipt_schema_version: Value,
}

#[derive(Debug, Clone)]
enum PolicyKind {
    Presence {
        target: String,
    },
    PresenceBatch {
        targets: Vec<String>,
    },
    Absence {
        target: String,
        source: Option<AbsenceSource>,
    },
    Update {
        target: String,
    },
    UpdateBatch {
        targets: Vec<String>,
    },
}

/// What identifies a request and how to check its recorded effect.
#[derive(Debug, Clone)]
pub struct Policy {
    pub request: Value,
    pub resolved_plan: Value,
    kind: PolicyKind,
}

fn load_state(ctx: &Context) -> Option<store::State> {
    store::load_state(&ctx.quantex_dir()).ok()
}

/// The read observation install, ensure, and uninstall verify against.
fn observe(ctx: &Context, name: &str) -> Option<View> {
    let agent = catalog::find(name)?;
    let state = load_state(ctx)?;
    Some(lifecycle::observe_lifecycle(ctx, agent, &state, None))
}

fn candidate_identity(binding: &Binding) -> Value {
    let mut map = Map::new();
    if let Some(binary) = &binding.target.binary_name {
        map.insert("binaryName".into(), binary.clone().into());
    }
    map.insert("providerId".into(), binding.provider.as_str().into());
    map.insert("targetId".into(), binding.target.id.clone().into());
    map.insert("targetKind".into(), binding.target.kind.into());
    Value::Object(map)
}

fn candidates(name: &str) -> Vec<Value> {
    catalog::find(name)
        .map(|agent| {
            providers::catalog_bindings(agent)
                .iter()
                .map(candidate_identity)
                .collect()
        })
        .unwrap_or_default()
}

fn sorted_candidates(name: &str) -> Vec<Value> {
    let mut list = candidates(name);
    let fields = |value: &Value| -> Vec<String> {
        ["providerId", "targetKind", "targetId", "binaryName"]
            .iter()
            .map(|key| value[*key].as_str().unwrap_or_default().to_owned())
            .collect()
    };
    list.sort_by_key(fields);
    list
}

fn canonical_name(input: &str) -> String {
    catalog::find(input).map_or_else(|| input.to_owned(), |agent| agent.name.clone())
}

/// `install` or `ensure` of one agent.
pub fn presence(action: &str, input: &str) -> Policy {
    let target = canonical_name(input);
    Policy {
        request: request(action, json!({}), std::slice::from_ref(&target)),
        resolved_plan: json!({ "candidates": candidates(&target), "kind": "agent-presence", "targetId": target }),
        kind: PolicyKind::Presence { target },
    }
}

/// `install` of several agents.
pub fn presence_batch(targets: &[String]) -> Policy {
    let request = request("install", json!({}), targets);
    let targets: Vec<String> = request["targets"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|target| target.as_str().map(str::to_owned))
        .collect();
    let plan_targets: Vec<Value> = targets
        .iter()
        .map(|target| json!({ "candidates": sorted_candidates(target), "targetId": target }))
        .collect();
    Policy {
        request,
        resolved_plan: json!({ "kind": "agent-presence-batch", "targets": plan_targets }),
        kind: PolicyKind::PresenceBatch { targets },
    }
}

/// `uninstall` of one agent; observes the recorded source before it is removed.
pub fn absence(ctx: &Context, input: &str) -> Policy {
    let view = observe(ctx, input);
    let target = view
        .as_ref()
        .map_or_else(|| input.to_owned(), |view| view.agent.name.clone());
    let source = view.as_ref().and_then(verified_absence_source);
    Policy {
        request: request("uninstall", json!({}), std::slice::from_ref(&target)),
        resolved_plan: json!({ "kind": "agent-absence", "targetId": target }),
        kind: PolicyKind::Absence { target, source },
    }
}

/// `update` of one agent, identified by its resolved plan.
pub fn update(target: &str, plan_id: String) -> Policy {
    Policy {
        request: request(
            "update",
            json!({ "requestedVersion": "latest", "scope": "single" }),
            &[target.to_owned()],
        ),
        resolved_plan: json!({ "kind": "agent-update", "planId": plan_id, "targetId": target }),
        kind: PolicyKind::Update {
            target: target.to_owned(),
        },
    }
}

/// `update --all`, identified by its resolved plan.
pub fn update_batch(targets: &[String], plan_id: String) -> Policy {
    Policy {
        request: request(
            "update",
            json!({ "requestedVersion": "latest", "scope": "all" }),
            targets,
        ),
        resolved_plan: json!({ "kind": "agent-update-batch", "planId": plan_id, "targets": targets }),
        kind: PolicyKind::UpdateBatch {
            targets: targets.to_vec(),
        },
    }
}

impl Policy {
    /// The evidence install, ensure, and uninstall record after a success. Update
    /// evidence comes from its execution instead.
    pub fn capture(&self, ctx: &Context) -> Option<Evidence> {
        match &self.kind {
            PolicyKind::Presence { target } => match classify_presence(&observe(ctx, target)?, None) {
                Classified::Compatible(evidence) => Some(evidence),
                _ => None,
            },
            PolicyKind::PresenceBatch { targets } => {
                let mut evidence = Vec::new();
                for target in targets {
                    match classify_presence(&observe(ctx, target)?, None) {
                        Classified::Compatible(item) => evidence.push(item),
                        _ => return None,
                    }
                }
                combine(evidence)
            }
            PolicyKind::Absence { source, .. } => {
                let source = source.as_ref()?;
                if providers::observe(ctx, &source.binding) != Observed::Absent
                    || executable_present(&source.executable_name)
                {
                    return None;
                }
                Some(absence_evidence(source))
            }
            PolicyKind::Update { .. } | PolicyKind::UpdateBatch { .. } => None,
        }
    }

    fn validate_live(&self, ctx: &Context, postcondition: &Value, receipt: &Value) -> Live {
        let single = postcondition["kind"] != "all-of" && !receipt_set(receipt);
        match &self.kind {
            PolicyKind::Presence { target } => {
                if !single {
                    return Live::Inconclusive;
                }
                let Some(current) = observe(ctx, target) else {
                    return Live::Inconclusive;
                };
                match classify_presence(&current, Some(receipt)) {
                    Classified::Compatible((live_post, live_receipt)) => {
                        if fingerprint(&live_post) == fingerprint(postcondition)
                            && fingerprint(&live_receipt) == fingerprint(receipt)
                        {
                            Live::Satisfied
                        } else {
                            Live::Drifted
                        }
                    }
                    Classified::Drifted => Live::Drifted,
                    Classified::Inconclusive => Live::Inconclusive,
                }
            }
            PolicyKind::PresenceBatch { targets } => {
                let Some(stored) = stored_batch(postcondition, receipt, targets) else {
                    return Live::Inconclusive;
                };
                combine_live(targets.iter().map(|target| {
                    let (expected_post, expected_receipt) = &stored[target];
                    if expected_post["kind"] != "package-present"
                        || expected_post["providerId"] != expected_receipt["providerId"]
                        || expected_post["targetId"] != expected_receipt["targetId"]
                    {
                        return Live::Inconclusive;
                    }
                    let Some(current) = observe(ctx, target) else {
                        return Live::Inconclusive;
                    };
                    match classify_presence(&current, Some(expected_receipt)) {
                        Classified::Compatible((live_post, live_receipt)) => {
                            if fingerprint(&live_post) == fingerprint(expected_post)
                                && fingerprint(&live_receipt) == fingerprint(expected_receipt)
                            {
                                Live::Satisfied
                            } else {
                                Live::Drifted
                            }
                        }
                        Classified::Drifted => Live::Drifted,
                        Classified::Inconclusive => Live::Inconclusive,
                    }
                }))
            }
            PolicyKind::Absence { target, .. } => {
                if !single {
                    return Live::Inconclusive;
                }
                let Some((binding, executable_name)) = stored_absence_source(postcondition, receipt, target) else {
                    return Live::Inconclusive;
                };
                let Some(current) = observe(ctx, target) else {
                    return Live::Inconclusive;
                };
                match current_absence_state(&current) {
                    Live::Satisfied => {}
                    other => return other,
                }
                match providers::observe(ctx, &binding) {
                    Observed::Present { .. } => Live::Drifted,
                    Observed::Absent if executable_present(&executable_name) => Live::Drifted,
                    Observed::Absent => Live::Satisfied,
                    _ => Live::Inconclusive,
                }
            }
            PolicyKind::Update { target } => {
                if !single {
                    return Live::Inconclusive;
                }
                let Some(expected) = stored_update(postcondition, receipt, target) else {
                    return Live::Inconclusive;
                };
                match observe_update(ctx, target) {
                    Some(current) => classify_stored_update(&current, &expected, current.receipt.as_ref()),
                    None => Live::Inconclusive,
                }
            }
            PolicyKind::UpdateBatch { targets } => {
                let Some(stored) = stored_batch(postcondition, receipt, targets) else {
                    return Live::Inconclusive;
                };
                let mut expected = Vec::new();
                for target in targets {
                    let (post, receipt) = &stored[target];
                    match stored_update(post, receipt, target) {
                        Some(item) => expected.push(item),
                        None => return Live::Inconclusive,
                    }
                }
                combine_live(
                    expected
                        .iter()
                        .map(|expected| match observe_update(ctx, &expected.agent_target_id) {
                            Some(current) => classify_stored_update(&current, expected, current.receipt.as_ref()),
                            None => Live::Inconclusive,
                        }),
                )
            }
        }
    }
}

fn combine_live(results: impl Iterator<Item = Live>) -> Live {
    let results: Vec<Live> = results.collect();
    if results.contains(&Live::Drifted) {
        Live::Drifted
    } else if results.contains(&Live::Inconclusive) {
        Live::Inconclusive
    } else {
        Live::Satisfied
    }
}

/// v1 `canonicalizeAllOfPostcondition` and `canonicalizeReceiptSet` over per-agent items.
pub fn combine(evidence: Vec<Evidence>) -> Option<Evidence> {
    if evidence.is_empty() {
        return None;
    }
    let (posts, receipts): (Vec<Value>, Vec<Value>) = evidence.into_iter().unzip();
    Some((
        json!({ "items": sorted_by_fingerprint(posts)?, "kind": "all-of" }),
        json!({ "items": sorted_by_fingerprint(receipts)?, "kind": "receipt-set", "schemaVersion": SCHEMA_VERSION }),
    ))
}

/// Per-agent items of a stored batch record, keyed by `agentTargetId`.
fn stored_batch(
    postcondition: &Value,
    receipt: &Value,
    targets: &[String],
) -> Option<std::collections::BTreeMap<String, (Value, Value)>> {
    if postcondition["kind"] != "all-of" || !receipt_set(receipt) {
        return None;
    }
    let posts = postcondition["items"].as_array()?;
    let receipts = receipt["items"].as_array()?;
    if posts.len() != targets.len() || receipts.len() != targets.len() {
        return None;
    }
    // The stored order must be canonical.
    if fingerprint(&json!({ "items": sorted_by_fingerprint(posts.clone())?, "kind": "all-of" }))
        != fingerprint(postcondition)
    {
        return None;
    }
    let index = |items: &[Value]| -> Option<std::collections::BTreeMap<String, Value>> {
        let mut map = std::collections::BTreeMap::new();
        for item in items {
            let id = item["agentTargetId"].as_str().filter(|id| !id.is_empty())?;
            if map.insert(id.to_owned(), item.clone()).is_some() {
                return None;
            }
        }
        Some(map)
    };
    let posts = index(posts)?;
    let receipts = index(receipts)?;
    let mut stored = std::collections::BTreeMap::new();
    for target in targets {
        stored.insert(
            target.clone(),
            (posts.get(target)?.clone(), receipts.get(target)?.clone()),
        );
    }
    Some(stored)
}

fn executable_present(name: &str) -> bool {
    probe::resolve_executable(&[name.to_owned()]).is_some()
}

// --- presence

enum Classified {
    Compatible(Evidence),
    Drifted,
    Inconclusive,
}

fn unique(values: impl IntoIterator<Item = Option<String>>) -> Vec<String> {
    let mut seen: Vec<String> = Vec::new();
    for value in values.into_iter().flatten() {
        if !seen.contains(&value) {
            seen.push(value);
        }
    }
    seen
}

fn provider_succeeded(view: &View) -> bool {
    matches!(
        view.provider_observed,
        Some(Observed::Present { .. } | Observed::Absent)
    )
}

fn path_text(view: &View) -> Option<String> {
    view.executable
        .path
        .as_ref()
        .map(|path| path.to_string_lossy().into_owned())
}

fn indeterminate(view: &View) -> bool {
    matches!(view.kind, Kind::Indeterminate(_)) || matches!(view.drift, Drift::Indeterminate(_))
}

/// v1 `classifyPresenceEvidence`.
fn classify_presence(view: &View, recorded_receipt: Option<&Value>) -> Classified {
    let agent = view.agent;
    if indeterminate(view) || !provider_succeeded(view) {
        return Classified::Inconclusive;
    }
    let (Some(binding), Some(receipt)) = (&view.binding, &view.receipt) else {
        return Classified::Drifted;
    };
    let Some(Observed::Present {
        version: provider_version,
    }) = &view.provider_observed
    else {
        return Classified::Drifted;
    };
    if view.kind != Kind::Present
        || view.drift != Drift::None
        || !view.executable.present
        || receipt["targetId"].as_str() != Some(agent.name.as_str())
        || receipt["providerId"].as_str() != Some(binding.provider.as_str())
        || receipt["providerTargetId"].as_str() != Some(binding.target.id.as_str())
        || receipt
            .get("providerTargetKind")
            .is_some_and(|kind| kind.as_str() != Some(binding.target.kind))
    {
        return Classified::Drifted;
    }
    let live_versions = unique([view.executable.version.clone(), provider_version.clone()]);
    if live_versions.len() > 1 {
        return Classified::Drifted;
    }
    let field = |value: Option<&Value>, key: &str| value.and_then(|value| value[key].as_str()).map(str::to_owned);
    let expected_versions = unique([field(Some(receipt), "version"), field(recorded_receipt, "version")]);
    if expected_versions.len() > 1 {
        return Classified::Drifted;
    }
    let expected_version = expected_versions.first();
    if let Some(expected) = expected_version {
        if live_versions.iter().any(|version| version != expected) {
            return Classified::Drifted;
        }
        if live_versions.is_empty() {
            return Classified::Inconclusive;
        }
    }
    let live_paths = unique([path_text(view)]);
    let expected_paths = unique([
        field(Some(receipt), "executablePath"),
        field(recorded_receipt, "executablePath"),
    ]);
    if expected_paths.len() > 1 {
        return Classified::Drifted;
    }
    let expected_path = expected_paths.first();
    if let Some(expected) = expected_path {
        if live_paths.iter().any(|path| path != expected) {
            return Classified::Drifted;
        }
        if view.executable.path.is_none() {
            return Classified::Inconclusive;
        }
    }
    let verified_path = expected_path.or(live_paths.first());
    let verified_version = expected_version.or(live_versions.first());
    let mut snapshot = Map::new();
    snapshot.insert("agentTargetId".into(), agent.name.clone().into());
    snapshot.insert(
        "executableName".into(),
        receipt["executableName"].as_str().unwrap_or(&agent.binary_name).into(),
    );
    if let Some(path) = verified_path {
        snapshot.insert("executablePath".into(), path.clone().into());
    }
    snapshot.insert("providerId".into(), binding.provider.as_str().into());
    snapshot.insert("providerTargetKind".into(), binding.target.kind.into());
    snapshot.insert("schemaVersion".into(), receipt["schemaVersion"].clone());
    snapshot.insert("targetId".into(), binding.target.id.clone().into());
    if let Some(version) = verified_version {
        snapshot.insert("version".into(), version.clone().into());
    }
    Classified::Compatible((
        json!({
            "agentTargetId": agent.name,
            "kind": "package-present",
            "providerId": binding.provider.as_str(),
            "targetId": binding.target.id,
        }),
        Value::Object(snapshot),
    ))
}

// --- absence

fn verified_absence_source(view: &View) -> Option<AbsenceSource> {
    let receipt = view.receipt.as_ref()?;
    let receipt_binding = Binding::from_receipt(receipt)?;
    let binding = view.binding.as_ref()?;
    if !receipt_binding.same_source(binding, &view.agent.binary_name) || !provider_succeeded(view) {
        return None;
    }
    let executable_name = receipt["executableName"]
        .as_str()
        .map(str::to_owned)
        .or_else(|| receipt_binding.target.binary_name.clone())
        .unwrap_or_else(|| view.agent.binary_name.clone());
    Some(AbsenceSource {
        agent_target_id: view.agent.name.clone(),
        binding: receipt_binding,
        executable_name,
        receipt_schema_version: receipt["schemaVersion"].clone(),
    })
}

fn absence_evidence(source: &AbsenceSource) -> Evidence {
    (
        json!({
            "agentTargetId": source.agent_target_id,
            "kind": "package-absent",
            "providerId": source.binding.provider.as_str(),
            "targetId": source.binding.target.id,
        }),
        json!({
            "agentTargetId": source.agent_target_id,
            "executableName": source.executable_name,
            "providerId": source.binding.provider.as_str(),
            "providerTargetKind": source.binding.target.kind,
            "schemaVersion": source.receipt_schema_version,
            "targetId": source.binding.target.id,
        }),
    )
}

/// The provider id and target kind of stored evidence, when they form a valid pair.
fn stored_binding(provider: &Value, kind: &Value, id: &Value, binary: Option<String>) -> Option<Binding> {
    let provider = catalog::Provider::parse(provider.as_str()?)?;
    let kind = kind.as_str()?;
    let valid = match provider {
        catalog::Provider::Binary => kind == "binary",
        catalog::Provider::Script => kind == "script",
        catalog::Provider::Brew => matches!(kind, "formula" | "cask"),
        catalog::Provider::Winget => kind == "id",
        catalog::Provider::Deno | catalog::Provider::Mise | catalog::Provider::Uv => kind == "tool",
        catalog::Provider::Bun | catalog::Provider::Cargo | catalog::Provider::Npm | catalog::Provider::Pip => {
            kind == "package"
        }
    };
    if !valid {
        return None;
    }
    let mut receipt = json!({ "providerId": provider.as_str(), "providerTargetId": id, "providerTargetKind": kind });
    if let Some(binary) = binary {
        receipt["executableName"] = binary.into();
    }
    Binding::from_receipt(&receipt)
}

fn stored_absence_source(postcondition: &Value, receipt: &Value, target: &str) -> Option<(Binding, String)> {
    let executable_name = receipt["executableName"].as_str().filter(|name| !name.is_empty())?;
    if postcondition["kind"] != "package-absent"
        || postcondition["providerId"] != receipt["providerId"]
        || postcondition["targetId"] != receipt["targetId"]
        || receipt["agentTargetId"].as_str() != Some(target)
        || postcondition["agentTargetId"].as_str() != Some(target)
    {
        return None;
    }
    let binding = stored_binding(
        &receipt["providerId"],
        &receipt["providerTargetKind"],
        &receipt["targetId"],
        Some(executable_name.to_owned()),
    )?;
    Some((binding, executable_name.to_owned()))
}

/// v1 `classifyCurrentAbsenceState`; `Satisfied` stands for "clear".
fn current_absence_state(view: &View) -> Live {
    if indeterminate(view)
        || view.drift == Drift::ConflictingSource
        || (view.provider_observed.is_some() && !provider_succeeded(view))
        || (view.binding.is_some() && !provider_succeeded(view))
    {
        return Live::Inconclusive;
    }
    if view.receipt.is_some()
        || view.installed.is_some()
        || view.persisted_binding.is_some()
        || view.binding.is_some()
        || view.kind == Kind::Present
        || view.executable.present
        || view.path_executable.present
    {
        return Live::Drifted;
    }
    Live::Satisfied
}

// --- update

fn observe_update(ctx: &Context, name: &str) -> Option<View> {
    let agent = catalog::find(name)?;
    let state = load_state(ctx)?;
    Some(lifecycle::observe_lifecycle_with(ctx, agent, &state, None, true))
}

/// The recorded expectation of an update.
#[derive(Debug, Clone)]
pub struct UpdateExpectation {
    pub agent_target_id: String,
    pub expected_version: String,
    pub binding: Binding,
}

fn stored_update(postcondition: &Value, receipt: &Value, target: &str) -> Option<UpdateExpectation> {
    let expected = postcondition["expectedVersion"]
        .as_str()
        .filter(|version| !version.is_empty())?;
    probe::compare_versions(expected, expected)?;
    if postcondition["kind"] != "version-satisfies"
        || receipt["agentTargetId"].as_str() != Some(target)
        || postcondition["agentTargetId"].as_str() != Some(target)
        || postcondition["providerId"] != receipt["providerId"]
        || postcondition["providerTargetKind"] != receipt["providerTargetKind"]
        || postcondition["targetId"] != receipt["targetId"]
    {
        return None;
    }
    let binding = stored_binding(
        &receipt["providerId"],
        &receipt["providerTargetKind"],
        &receipt["targetId"],
        None,
    )?;
    Some(UpdateExpectation {
        agent_target_id: target.to_owned(),
        expected_version: expected.to_owned(),
        binding,
    })
}

/// v1 `classifyStoredUpdateObservation`.
pub fn classify_stored_update(current: &View, expected: &UpdateExpectation, receipt: Option<&Value>) -> Live {
    if indeterminate(current) {
        return Live::Inconclusive;
    }
    if current.agent.name != expected.agent_target_id
        || current.kind != Kind::Present
        || current.drift != Drift::None
        || !current.executable.present
    {
        return Live::Drifted;
    }
    let (Some(binding), Some(persisted), Some(receipt)) = (&current.binding, &current.persisted_binding, receipt)
    else {
        return Live::Inconclusive;
    };
    let exe = current.agent.binary_name.as_str();
    let wanted = &expected.binding;
    if !wanted.same_source(binding, exe)
        || !wanted.same_source(persisted, exe)
        || receipt["targetId"].as_str() != Some(expected.agent_target_id.as_str())
        || receipt["providerId"].as_str() != Some(wanted.provider.as_str())
        || receipt["providerTargetId"].as_str() != Some(wanted.target.id.as_str())
        || receipt["providerTargetKind"].as_str() != Some(wanted.target.kind)
    {
        return Live::Drifted;
    }
    let Some(version) = current.executable.version.as_deref() else {
        return Live::Inconclusive;
    };
    match probe::compare_versions(version, &expected.expected_version) {
        None => Live::Inconclusive,
        Some(std::cmp::Ordering::Less) => Live::Drifted,
        Some(_) => Live::Satisfied,
    }
}

/// v1 `classifyUpdateObservation`: the evidence an update leaves, if `current` shows it.
pub fn update_evidence(current: &View, expectation: UpdateExpectation, receipt: Option<&Value>) -> Option<Evidence> {
    if classify_stored_update(current, &expectation, receipt) != Live::Satisfied {
        return None;
    }
    let receipt = receipt?;
    let version = current.executable.version.clone()?;
    let binding = &expectation.binding;
    let mut snapshot = Map::new();
    snapshot.insert("agentTargetId".into(), expectation.agent_target_id.clone().into());
    snapshot.insert(
        "executableName".into(),
        receipt["executableName"]
            .as_str()
            .unwrap_or(&current.agent.binary_name)
            .into(),
    );
    if let Some(path) = path_text(current) {
        snapshot.insert("executablePath".into(), path.into());
    }
    snapshot.insert("providerId".into(), binding.provider.as_str().into());
    snapshot.insert("providerTargetKind".into(), binding.target.kind.into());
    snapshot.insert("schemaVersion".into(), receipt["schemaVersion"].clone());
    snapshot.insert("targetId".into(), binding.target.id.clone().into());
    snapshot.insert("version".into(), version.into());
    Some((
        json!({
            "agentTargetId": expectation.agent_target_id,
            "expectedVersion": expectation.expected_version,
            "kind": "version-satisfies",
            "providerId": binding.provider.as_str(),
            "providerTargetKind": binding.target.kind,
            "targetId": binding.target.id,
        }),
        Value::Object(snapshot),
    ))
}

/// The update evidence for `agent` with the recorded version expectation `expected`.
pub fn update_expectation(agent: &Agent, binding: &Binding, expected_version: String) -> UpdateExpectation {
    UpdateExpectation {
        agent_target_id: agent.name.clone(),
        expected_version,
        binding: Binding {
            provider: binding.provider,
            target: providers::ProviderTarget {
                id: binding.target.id.clone(),
                kind: binding.target.kind,
                arguments: Vec::new(),
                binary_name: None,
            },
        },
    }
}

// ---------------------------------------------------------------------------
// Runtime

fn invalid_argument(action: &str, target: Option<&Target>, message: String, details: Value) -> Outcome {
    Outcome::failure(
        action,
        target.cloned(),
        CommandError::new(ErrorCode::InvalidArgument, message).details(details),
    )
}

fn invalid_evidence(action: &str, target: Option<&Target>, key: &str, reason: &str) -> Outcome {
    invalid_argument(
        action,
        target,
        format!("Idempotency key {key} contains invalid replay evidence ({reason})."),
        json!({ "idempotencyKey": key, "invalidReason": reason, "reason": "invalid-evidence" }),
    )
}

/// Runs a mutation under `--idempotency-key`: replays a matching record whose
/// postcondition still holds, refuses a key reused for a different request, and
/// records a new success. Without a key, or with `--dry-run`, it just runs.
///
/// `build` derives the request identity (`Err` ends the command with that outcome);
/// `capture` returns the evidence of a successful run.
pub fn guarded(
    ctx: &Context,
    action: &str,
    target: Option<Target>,
    build: impl FnOnce(&Context) -> Result<Policy, Outcome>,
    run: impl FnOnce(&Context) -> Outcome,
    capture: impl FnOnce(&Context, &Policy) -> Option<Evidence>,
) -> Outcome {
    let Some(key) = ctx.idempotency_key.clone().filter(|_| !ctx.dry_run) else {
        return run(ctx);
    };
    let dir = ctx.quantex_dir();
    let target = target.as_ref();
    let loaded = load(&dir, &key);
    if let Loaded::Invalid(reason) = loaded {
        return invalid_evidence(action, target, &key, reason);
    }
    let policy = match build(ctx) {
        Ok(policy) => policy,
        Err(outcome) => return outcome,
    };
    if let Loaded::Valid(record) = &loaded {
        if record["request"]["fingerprint"].as_str() != Some(fingerprint(&policy.request).as_str()) {
            return invalid_argument(
                action,
                target,
                format!("Idempotency key {key} was already used for a different canonical request."),
                json!({
                    "existingAction": record["request"]["payload"]["action"],
                    "idempotencyKey": key,
                    "reason": "request-mismatch",
                }),
            );
        }
        let same_plan =
            record["resolvedPlan"]["fingerprint"].as_str() == Some(fingerprint(&policy.resolved_plan).as_str());
        if same_plan
            && policy.validate_live(ctx, &record["postcondition"]["payload"], &record["receipt"]["payload"])
                == Live::Satisfied
        {
            return Outcome::replayed(record["result"].clone());
        }
    }
    let outcome = run(ctx);
    let dry_run = outcome.warnings.iter().any(|warning| warning.code == "DRY_RUN");
    if !outcome.ok || dry_run || ctx.is_cancelled() {
        return outcome;
    }
    let Some((postcondition, receipt)) = capture(ctx, &policy) else {
        return outcome;
    };
    match load(&dir, &key) {
        Loaded::Invalid(reason) => return invalid_evidence(action, target, &key, reason),
        Loaded::Valid(record)
            if record["request"]["fingerprint"].as_str() != Some(fingerprint(&policy.request).as_str()) =>
        {
            return invalid_argument(
                action,
                target,
                format!(
                    "Idempotency key {key} changed while the command was running; replay evidence was not overwritten."
                ),
                json!({
                    "conflict": "concurrent-request-mismatch",
                    "existingAction": record["request"]["payload"]["action"],
                    "idempotencyKey": key,
                }),
            );
        }
        _ => {}
    }
    let result = protocol::envelope(ctx, &outcome, ctx.output_mode);
    save(&dir, &key, &postcondition, &receipt, &policy, result);
    outcome
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn canonical_strings_sort_keys_and_drop_spaces() {
        let value = json!({ "b": [1, "x"], "a": { "d": null, "c": true } });
        assert_eq!(canonical_string(&value), r#"{"a":{"c":true,"d":null},"b":[1,"x"]}"#);
    }

    #[test]
    fn fingerprints_are_sha256_of_the_canonical_string() {
        assert_eq!(
            fingerprint(&json!({})),
            "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a"
        );
    }

    #[test]
    fn requests_sort_and_dedupe_targets() {
        let request = request("install", json!({}), &["b".into(), "a".into(), "b".into()]);
        assert_eq!(request["targets"], json!(["a", "b"]));
        assert!(canonical_request(&request));
    }
}
