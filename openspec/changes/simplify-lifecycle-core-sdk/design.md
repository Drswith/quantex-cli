## Context

Quantex is intentionally a local-first lifecycle tool for coding-agent CLIs. Its maintained behavior is valuable and already broad enough: discover agents, inspect the local machine, install or adopt an agent, preserve its exact source, update or uninstall it safely, and execute it with transparent standard IO.

The implementation now has more overlapping layers than that mission requires. Catalog entries are projected into legacy agent definitions; package-manager helpers and typed provider adapters both describe lifecycle operations; command modules, lifecycle services, reconciliation, idempotency, and compatibility code each own part of the same decision. Meanwhile the root `quantex-cli` package exposes 117 compatibility exports, but there is no small, deliberate SDK surface for TypeScript consumers.

This is not permission to discard complexity that encodes safety. Previous incidents established that provider observation is tri-state, an executable on `PATH` does not prove Quantex ownership, successful process exit does not prove the lifecycle postcondition, and uncertain evidence must not erase provenance. Cancellation, atomic state, scoped compensation, and Windows replacement behavior are similarly product requirements rather than incidental implementation details.

The current stable line is 1.x and has an installed audience. State schema version 2 rejects future schema versions and normalizes away unknown fields, so adding persisted fields during 1.x would make downgrade and rollback unsafe. The redesign must therefore simplify code behind the existing state and compatibility shell, not through a new state format or a big-bang major release.

Stakeholders are CLI users, automation consuming JSON/NDJSON and exit codes, downstream TypeScript consumers, maintainers of first-party provider adapters, and release operators publishing npm packages and standalone binaries.

## Goals / Non-Goals

**Goals:**

- Publish one intentionally small TypeScript SDK package whose public API is instance-owned, non-interactive, re-entrant, and usable from Node.js or Bun.
- Make the Core application API the eventual single source of lifecycle behavior while retaining the existing CLI and root-library compatibility facade during a measured transition.
- Reduce the internal lifecycle model to the decisions Quantex actually performs without weakening observation, verification, provenance, compensation, state, cancellation, or platform guarantees.
- Keep the existing state schema readable in both directions throughout 1.x, including temporary downgrade to the preceding released CLI.
- Establish measurable promotion, rollback, soak, and removal gates spanning multiple stable minor releases.
- Keep packaging and release recovery understandable with only two artifacts from this repository: the existing CLI package and the new Core package.

**Non-Goals:**

- Do not add workflow DAGs, batch or pipe APIs, apply files, a daemon, an MCP server, remote catalogs, dynamic provider plugins, or browser-runtime support.
- Do not expose provider drivers, recipes, raw plans, receipts, state stores, CLI envelopes, command handlers, or infrastructure ports as SDK API.
- Do not move Quantex self-upgrade or release-artifact behavior into agent Core.
- Do not remove, rename, or re-export through a second identity any maintained `quantex-cli` root export during this change.
- Do not optimize lifecycle lock granularity, introduce a new persisted state schema, or run two mutating engines for one invocation.
- Do not move the root CLI package into a `packages/cli` workspace as part of the extraction.

## Decisions

### Decision: publish one Core package beside the root CLI package

Keep `quantex-cli` at the repository root and add a single workspace package, provisionally `@quantex/core`, in `packages/core`. Both packages use the same repository, version train, protected branches, and release tag. The Core package exposes only `.` and `./package.json`, is ESM-only, includes declarations, and supports Node.js 20 or newer and Bun.

The repository keeps one canonical Core source tree. The root CLI consumes that source through the Core package identity while its published runtime and standalone binaries explicitly inline Core during the 1.x transition. This preserves a real source dependency boundary without making CLI installation depend on a second registry artifact. The package boundary is enforced by import and packed-artifact tests, not by duplicating lifecycle code into two source trees.

Why this over moving the entire CLI into a workspace:

- Moving the root package would unnecessarily disturb current npm publication, binary output, self-upgrade, release-please configuration, and root-export fixtures.

Why this over a `quantex-cli/core` subpath:

- A separate dependency lets SDK consumers avoid Commander, prompts, presenters, self-upgrade, and the accidental 117-symbol compatibility surface.

Why this over several domain/provider packages:

- More packages would turn internal seams into versioned public coordination and increase the release surface without improving the product mission.

The package name is not considered publishable until npm scope ownership and trusted-publisher bootstrap are verified. That operational check may change the provisional public name before the first release, but not the two-package boundary or SDK shape.

### Decision: expose one instance client and add capabilities only when implemented

The public entry point starts with an instance factory rather than static functions or a process-global singleton:

```ts
import { createQuantex } from '@quantex/core'

const quantex = createQuantex({ configDir: '/optional/isolated/path' })
const result = await quantex.inspect('codex', { signal, timeoutMs: 10_000 })
```

The first stable Core release exposes `createQuantex`, `list`, and `inspect`. Mutating methods are added only when their vertical slice has passed the required provider, state, cancellation, differential, and downgrade gates. The intended final client surface is `list`, `inspect`, `install`, `ensure`, `update`, `uninstall`, and `run`; it deliberately does not add `updateAll` or generic workflow primitives.

Expected lifecycle failures return a serializable discriminated `CoreResult<T>` instead of throwing CLI-shaped errors. Inspection is one discriminated union with `missing`, `managed`, `external`, `stale`, `conflict`, and `indeterminate` states, preventing invalid combinations of presence and ownership. Mutations eventually return a compact lifecycle change with before/after observations and source; they do not expose the internal plan graph.

Request options contain explicit cancellation and timeout. Mutation options add only preview versus apply. Run options make install policy and standard IO explicit. CLI-only concerns such as output mode, prompting, color, quiet mode, exit mapping, and client-supplied idempotency keys are excluded.

The 1.3 install and ensure result is deliberately smaller than the CLI command result:

```ts
type AgentMutationDecision = 'already-satisfied' | 'external-preserved' | 'install' | 'reinstall'

type AgentMutation =
  | {
      mode: 'preview'
      decision: AgentMutationDecision
      before: AgentInspection
      source?: AgentSource
      wouldChange: boolean
    }
  | {
      mode: 'apply'
      decision: AgentMutationDecision
      before: AgentInspection
      after: AgentInspection
      source?: AgentSource
      changed: boolean
    }
```

Preview never fabricates an `after` inspection. Apply defaults when mode is omitted and always returns a fresh `after` inspection. PATH-only executables remain `external-preserved` in the public SDK; if the maintained v1 CLI still needs its historical narrowly safe adoption heuristic, that policy stays private to the compatibility adapter and is removed with that compatibility branch rather than becoming an SDK option.

Mutation failures use stable domain codes and include compact `phase` (`decide`, `execute`, `verify`, `record`, or `compensate`) and `sideEffect` (`none`, `compensated`, or `may-remain`) details. They do not publish the provider outcome, internal plan, receipt, state, or compensation interface.

Why this over publishing all current exports:

- The current root is a compatibility facade containing command handlers, mutable CLI context, raw state mutators, package-manager helpers, self-upgrade, and release utilities. Publishing it again would preserve the accidental architecture rather than create a Core.

Why capabilities are added incrementally:

- An unimplemented or weakly verified method would freeze a public contract before its safety semantics are proven. Additive minor releases are safer than placeholder methods returning `unsupported`.

### Decision: isolate every SDK client and invocation from CLI process state

`createQuantex` owns immutable client configuration such as an optional config directory. Each method creates an invocation context with its own cancellation composition, timeout, cleanup registry, process runner, clock, catalog, provider registry, and stores. One invocation cannot cancel or mutate options for another.

Core code MUST NOT import Commander, prompts, color/presenter modules, CLI command modules, `process.exit`, the mutable CLI context, self-upgrade, or release-artifact modules. It neither prints nor prompts. Child-process output is captured or inherited only according to explicit method options.

The CLI remains responsible for parsing, confirmation, human and structured presentation, stdout/stderr routing, exit codes, JSON/NDJSON schemas, client-key replay idempotency, self-upgrade, and standalone binary behavior. Its compatibility adapter maps Core values into the maintained v1 contracts.

The read-only Core slice uses a generated discovery catalog that deliberately omits mutation-only metadata and a small observation-only provider registry. It MUST NOT pull the complete first-party mutation registry, package-manager mutation adapters, cache/network update machinery, Zod-backed catalog source, or CLI context into the public runtime closure. The maintained CLI injects its complete compatibility provider registry and rehydrates legacy-only catalog metadata at the adapter boundary so existing v1 projections remain exact while SDK consumers receive the smaller runtime.

### Decision: simplify the internal lifecycle model without simplifying evidence

The current generic plan model supports dependency edges, effect lists, preconditions, and compensation steps, while production lifecycle plans currently contain at most one operation and do not use a real DAG. Core therefore converges internally on:

1. observe live executable, provider evidence, recorded source, and receipt;
2. decide a single lifecycle action or a fail-closed no-action outcome;
3. resolve a provider-specific recipe;
4. execute once;
5. freshly verify the expected postcondition;
6. record only verified evidence;
7. compensate only resources proven to have been created by this invocation.

Typed first-party provider drivers remain. They own reliable `present | absent | unknown` observation, operation execution, verification evidence, cancellation, and provider-specific platform behavior. Declarative recipes may describe target, argv, and risk, but they do not replace provider observation. This preserves the historical cargo, Deno, pip, winget, npm, Bun, script, and binary lessons while allowing the legacy boolean package-manager facade and duplicate capability tables to disappear after callers migrate.

Install and ensure use a Core-owned narrow decision/execution module instead of importing the legacy `reconcileAgentInstallation`, package-manager facade, or single-step DAG. Apply holds one explicit-config-directory lifecycle lock across fresh observation, decision, the first provider side effect, verification, atomic schema-version-2 recording, and final observation. Preview performs only the required read probes and takes no write lock. Missing agents may try availability probes before selecting one recipe; stale agents may use only their exact recorded source. After a provider side effect starts, no other provider or engine is eligible for that invocation.

The provider process primitive accepts only an invocation-owned operation context, including its signal, timeout, cleanup registration, and explicit output policy. CLI-global stdio and cancellation projection remain in a legacy wrapper that Core cannot import. Lifecycle and state locks similarly gain an explicit configuration-root primitive, with the current global-config helpers reduced to compatibility wrappers around it.

State recording registers a rollback resource before its first asynchronous write and retains the original document. If interruption races with the atomic write, cleanup waits for that write and restores the original document before returning. Provider compensation is automatic only when pre-observation conclusively proves the target absent and the invocation proves it created that resource. Script/binary effects without a reliable uninstall are reported as `may-remain`; Core never guesses at file deletion. Bun trust recovery retains its existing pre-existing-versus-new ownership rule.

Why this over pure command recipes:

- Generating argv is easy; proving ownership and postconditions is the safety boundary. Treating an unsupported or failed probe as absence previously caused successful installations to be rolled back and stale provenance to be mishandled.

Why this over retaining the generic DAG publicly:

- Quantex is not a workflow engine. Exposing unused orchestration concepts would make internal simplification a future breaking change.

### Decision: freeze the persisted state shape for the entire 1.x transition

Core reads and writes the existing state schema version 2 and the current installed-agent and receipt shapes. It does not add required or optional persisted fields, create an authoritative sidecar, or change the state home during 1.x. New decisions must be derived from existing state plus live observation.

State remains fail-closed and atomically written. Corrupt state is not replaced by an empty document. Legacy installed-agent projection and lifecycle receipts retain their current meaning. A successful new release mutation must remain readable and safely mutable by the immediately preceding released CLI; the new release must then read the result again.

Why this over an additive schema version:

- The current parser rejects future versions and normalizers discard unknown fields, so nominally additive fields are not downgrade-compatible. A schema change requires a separate major-version migration design.

### Decision: preserve ownership, verification, cancellation, and compensation as Core invariants

Core keeps these non-negotiable rules:

- A recorded exact provider, target, install source, and executable identity is preferred over catalog candidates and must be rechecked against live evidence.
- A PATH-only executable is external unless provider evidence proves a safely adoptable global installation; external agents are not updated or uninstalled by default.
- Provider `unknown`, rejection, timeout, conflicting evidence, or an unresolved recorded source yields `indeterminate` or `conflict`, never synthetic absence.
- Process exit success is insufficient. Install, update, and uninstall succeed and write state or receipts only after a fresh postcondition observation.
- Ghost state is cleared only after conclusive absence; uncertainty retains provenance.
- Cancellation is sticky. Every Core-owned resource registers cleanup immediately after acquisition and before the next asynchronous boundary. Caller signals, Core deadlines, and provider-originated cancelled or timed-out outcomes all trigger the same bounded cleanup path; later success cannot overwrite interruption and interrupted work writes no success record.
- Compensation removes only resources proven to have been created by the current invocation, including Bun trust handling.
- Update is no-downgrade, and script/binary self-update retains recorded provenance and requires a freshly observed version increase.
- Windows `.cmd`/PATHEXT execution, bounded process-tree termination (including a bounded `taskkill` helper with direct-signal fallback), file-lock handling, delayed binary replacement, backup/restore, and both executable entry points remain covered even though self-upgrade stays outside agent Core.

### Decision: select one engine before an invocation and never fall back after mutation starts

During transition the CLI may choose legacy or Core once, before invoking lifecycle work. Before the maintained read commands route through Core, differential fixtures compare the canonical resolved observation for managed, alias, external, missing, stale, conflict, indeterminate, provider-timeout, corrupt-state, and future-state cases. A mutating invocation runs exactly one engine. After either engine starts a side effect, it MUST NOT silently call the other implementation on error, because that can install, update, or uninstall twice.

Rollback is an explicit whole-invocation route selected before work begins. The route and its release gate are internal compatibility controls, not a new public workflow surface. Test-only differential harnesses compare observation, decision, typed result, state delta, receipt, and CLI projection without production shadow side effects.

### Decision: keep request-key replay in the CLI compatibility decorator

Core `ensure` is semantically idempotent through observation and postcondition verification. The maintained `--idempotency-key` contract remains in the CLI adapter because it is a client/protocol replay feature coupled to normalized CLI requests and v1 results. Its stored request fingerprints, live replay validation, expiry, and no-record-on-dry-run/failure/cancellation semantics remain unchanged throughout 1.x.

### Decision: publish Core and CLI on one coordinated version train

Release-please continues to manage the root release version and one GitHub tag. It synchronizes the Core package version and the root's exact same-version development dependency. CLI npm and standalone binary builds explicitly inline Core; the published CLI has no runtime registry dependency on Core during the 1.x transition.

Publishing runs Core first, verifies the registry version, then publishes the CLI and uploads standalone artifacts. Recovery is idempotent per package and treats a Core-era release as npm-complete only when both repository-owned packages exist at that version. Releases whose source predates `packages/core/package.json` remain CLI-only and MUST NOT be misclassified as missing Core or backfilled with a package they never contained. Release PR policy checks that the title, root version, Core version, and root Core development dependency are equal and rejects workspace protocols.

The existing `quantex` alias repository remains outside this repository's release coordination. Core package bootstrap requires confirmed npm namespace ownership before publication. npm requires a package to exist before a trusted publisher can be configured, so the first Core version is a deliberate two-stage operation: an authorized maintainer publishes the already validated package once with 2FA, then configures `release.yml` as its trusted publisher and marks the repository gate ready. Automated Core-first publication starts only after that bootstrap; a missing scope, uncertain registry response, or unconfirmed gate fails closed before CLI publication.

Builds use explicit CLI and Core tsdown configurations rather than experimental workspace auto-discovery. Packed-package tests install real tarballs into clean temporary consumers, compile under TypeScript NodeNext, and execute with Node.js 20 and Bun. The Core tarball contains no CLI binary, prompts, command modules, source, tests, or release binaries. Its initial read-only runtime entry stays below an 80,000-byte uncompressed budget and is scanned for high-signal mutation, cache/network, CLI-context, self-upgrade, and release fragments. A TypeScript import-closure test independently enforces the allowed source boundary. Package validation also proves the CLI tarball and standalone binary work without Core installed and contain no unresolved Core package import.

Mutation methods are loaded through an internal build chunk so importing the Core root or using read-only methods does not initialize mutation providers. The root entry retains its read-only size budget. Package validation allowlists emitted internal chunks by verified build output rather than broad globs and scans every chunk for CLI, presentation, self-upgrade, release, and unsupported infrastructure leakage.

Repository installation disables lifecycle scripts through Bun configuration. This prevents a default-trusted dependency postinstall from running against Bun's workspace store layout and keeps install behavior fail-closed; hook setup, builds, tests, and publication are explicit commands rather than ambient install side effects. CI caches Bun's download store only and recreates `node_modules` on every job, because archived Windows workspace links can restore as an incomplete dependency graph even when a frozen install reports no changes.

### Decision: require four stable minor stages and a time soak

The minimum transition is:

| Stable line | Default routing | Required evidence |
|---|---|---|
| 1.2.x | Publish stable read-only Core; CLI mutation remains legacy | Packed SDK consumer and purity tests, v1 fixtures unchanged, N-1 state/idempotency read, integration-branch Linux/macOS/Windows CI and Sandbox coverage |
| 1.3.x | Core mutations only on beta or explicit whole-invocation opt-in | Differential lifecycle matrix, all first-party provider conformance, no post-side-effect fallback |
| 1.4.x | Core is stable default; legacy remains an explicit pre-invocation escape route | All platforms, packed packages, sandbox, cancellation, timeout, ghost state, corrupt state, and Windows smoke gates; no known critical or important regression |
| 1.5.x | Core remains default for a second stable minor; legacy is frozen but runnable | Rollback drill, downgrade matrix, migration docs, deprecation inventory, and unchanged v1 contracts |

Removal is permitted only in a later major release through a separate deprecation OpenSpec change, after Core has been default for at least two stable minors and at least 90 days from stable default. The version and time requirements take the later date. Removal gates cannot be satisfied by deleting old tests or refreshing compatibility goldens without explicit contract review.

## Risks / Trade-offs

- [The transition temporarily adds a package and adapters before deleting layers] → Land vertical slices, prohibit new legacy behavior, track a deletion owner for each migrated path, and measure source/dependency surface at every promotion gate.
- [The Core package accidentally republishes CLI or internal APIs] → Keep two allowed exports, run packed-tarball allowlist and dependency-boundary tests, and compile a clean downstream consumer.
- [Two implementations disagree] → Use test-only differential fixtures before routing changes; never shadow mutations in production; promote one command family at a time.
- [A fallback performs a mutation twice] → Bind engine selection before invocation and allow only explicit whole-invocation rollback.
- [A state change makes downgrade destructive] → Freeze schema version 2 and run released N/N-1 bidirectional mutation tests before promotion.
- [Provider abstraction is simplified past its evidence boundary] → Preserve typed tri-state driver conformance and remove only duplicate projections and boolean facades.
- [A broad SDK surface becomes another compatibility burden] → Publish only implemented vertical slices, expose domain results rather than infrastructure, and add capabilities additively.
- [Coordinated npm publication becomes partially complete] → Publish and verify Core first, then CLI; resolve and recover each package independently while using one tag; treat pre-Core releases as CLI-only.
- [npm cannot configure trusted publishing for a package that does not exist] → Stop the first Core release before any automated publish, bootstrap the validated package once with an authorized 2FA maintainer, configure trust, and only then enable automatic publication.
- [The provisional npm scope cannot be published] → Verify ownership and trusted publishing before enabling publication; choose the final public name before the first package release.
- [Windows regressions are hidden by Linux-heavy PR CI] → Include the integration branch in workflows and make Windows shim, cancellation, and replacement smoke tests promotion gates. Cancellation smoke tests preserve typed provider outcomes before the v1 boolean compatibility projection so an interruption that settles during the late-completion grace cannot become a platform-dependent `INSTALL_FAILED`.
- [Long-lived compatibility code becomes permanent] → Require a 1.5 deprecation inventory and a separately approved major removal change after the soak, while forbidding new features in the legacy engine.

## Migration Plan

1. **Contract and delivery foundation**
   - Add this umbrella OpenSpec change and an ADR for the two-package boundary.
   - Freeze state schema version 2 for 1.x and capture the historical invariants as contract tests.
   - Include the integration branch in Linux, macOS, Windows, package, and sandbox validation.
   - Establish semantic root-export tests before changing declaration generation; do not refresh existing compatibility fixtures merely to make the refactor pass.

2. **Core package and read-only vertical slice (1.2)**
   - Add the workspace package, explicit build, packed consumer, purity, re-entrancy, and cancellation-isolation tests.
   - Implement only `createQuantex`, `list`, and `inspect` as the first stable surface.
   - Make legacy inspection adapters consume the same canonical observation implementation without changing CLI output or state.
   - Verify previous-release state/idempotency input and bidirectional state compatibility.

3. **Install and ensure vertical slice (1.3 beta/opt-in)**
   - Move decision, recipe, verification, receipt, and scoped compensation behind Core.
   - Compare legacy and Core results, state deltas, receipts, cancellation, timeout, and provider faults.
   - Route only one engine per invocation; retain legacy as the stable default.

4. **Update, uninstall, and run vertical slices (1.3)**
   - Migrate exact-source update, ghost-state cleanup, external ownership refusal, script/binary self-update, and transparent run semantics.
   - Complete the first-party provider conformance matrix and remove each duplicate legacy path only after the Core contract test exists.
   - Keep CLI `update --all` as compatibility-side composition rather than a new Core batch API.

5. **Stable-default promotion (1.4)**
   - Make Core the default only after cross-platform, package, sandbox, fault, and downgrade gates pass.
   - Retain an explicit pre-invocation legacy escape route and perform a documented rollback drill.

6. **Soak and deprecation preparation (1.5)**
   - Keep Core default for a second stable minor, freeze the legacy engine, publish migration guidance, and inventory every compatibility export or branch that may later be removed.
   - Keep this umbrella change active until all accepted milestones and current-spec synchronization are complete.

7. **Later major cleanup**
   - After both the version and 90-day gates, create a separate deprecation OpenSpec change.
   - Remove only surfaces with stable replacements and completed telemetry/test evidence; preserve state migration and self-upgrade guarantees independently.

Rollback before Core becomes default means selecting legacy for the next whole invocation. Rollback after stable-default promotion means changing the pre-invocation route through a patch release; no rollback may switch engines after a side effect or rewrite state into a new schema.

## Open Questions

- Does the maintainer control the `@quantex` npm scope and can it be configured for trusted publishing? If not, choose and reserve an unscoped name before the 1.2 publication PR.
- Which exact integration-branch name should remain in CI after this initial branch, if future milestone branches are cut from it?
- Which real Windows environment will own the delayed-replacement and process-tree smoke gate before 1.4 promotion?
