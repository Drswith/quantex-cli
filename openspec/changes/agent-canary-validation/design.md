## Context

The repository already has deterministic provider conformance tests and a broad lifecycle smoke script that can run in Docker or Modal. Those checks are useful, but they either do not execute a real upstream agent or require a remote transport for every run. A developer workstation is not a safe test matrix: global package managers, PATH entries, credentials, and agent self-updaters can affect unrelated work.

The change therefore adds a small real-agent canary layer on disposable GitHub-hosted runners. It also strengthens the existing smoke assertion and fixes the observation contract exposed by the Pi case: a successful version command with an empty stdout must be parsed from stderr.

## Goals / Non-Goals

**Goals:**

- Keep a quick, reproducible real-agent signal on relevant pull requests.
- Rotate through every catalog agent in a scheduled or manually dispatched run without touching a developer HOME.
- Make installed-version evidence part of the real lifecycle smoke contract so `inspect` and `list` cannot silently regress to `unknown`.
- Preserve deterministic fake-provider coverage for cargo, deno, uv, and the other provider adapters.
- Keep Modal and Docker available for transport, filesystem, and long-running isolation validation.

**Non-Goals:**

- Do not add a workflow-orchestration product surface or a new user-facing CLI command.
- Do not make upstream agent installation a required merge gate; real installers and registries are external dependencies.
- Do not claim that one Linux preferred method replaces platform-specific Windows/macOS coverage or tests every candidate method in one job.
- Do not put credentials, user state, or a developer's global package directory into the canary runner.

## Decisions

### Catalog-driven matrix with two scopes

`agent-canary-matrix.ts` reads the checked-in catalog and emits stable JSON entries containing the agent name, selected provider, installed-version requirement, any explicit pre-install unsupported-runner reason, and any reviewed cleanup-stage exception. The quick scope contains a small maintained anchor set including Pi; the full scope contains every catalog agent with a Linux candidate. The script fails if an anchor disappears or has no candidate, so the fast path cannot silently lose its regression target.

The selector first prefers Bun and then npm because those are the CI-ready providers the existing `defaultPackageManager` contract can actually reorder. When neither exists, it retains the catalog's first Linux candidate. This keeps the matrix provider identical to the provider production routing will select: Deno and uv are provisioned when they are already catalog-first, while script, Cargo, Brew, and other providers are not silently reordered by CI-only wishful metadata. Kimi and MiMo still select npm through the supported product preference; Vibe remains on its catalog-first script.

Amp carries a checked-in npm override because the current Bun package delegates to a nested postinstall that Quantex's deliberately narrow global trust flow does not auto-trust. The override is validated against the catalog at matrix-generation time, is expressible through the existing product preference, and leaves the quick anchors responsible for Bun integration coverage.

An explicit unsupported-runner policy is limited to an agent whose production-selected Linux candidate requires credentials, a login wizard, a terminal device, or installer process behavior that the credential-free non-interactive runner cannot represent honestly. This currently covers Devin and Goose interaction requirements, Junie's external managed shim that fails provider-source verification, and Vibe's catalog-first script updating PATH only for a future shell. Each entry remains in the full matrix and reports its reviewed reason as a skip; it is not deleted from coverage or counted as a pass. This policy is checked in next to the matrix resolver rather than added to product-facing catalog metadata because it describes this runner contract, not whether the agent supports Linux.

Cleanup exceptions use a separate checked-in reason and are evaluated only after install, refreshed inspect/list, and version assertions have passed. Claude currently exercises the full Bun-managed probe, but its version execution can leave a second executable on PATH after `bun remove` succeeds. The probe accepts only the exact structured `UNINSTALL_FAILED` plus `conflicting-source` outcome for that reviewed entry, reports the cleanup phase as skipped, and relies on runner destruction for the remaining external copy. Any other uninstall outcome still fails.

The resolver is a script rather than a workflow-local list so catalog additions are automatically included in scheduled coverage and the same selection can be unit-tested locally. Provider conformance remains the place for exhaustive typed provider behavior; real canaries validate the integration with actual upstream packages.

### Focused `probe` smoke scenario

The existing lifecycle smoke process gains a `probe` scenario. It installs each selected agent, refreshes `inspect`, refreshes `list`, and requires a non-empty installed version whenever the matrix entry marks the candidate as version-probed. It keeps the selected agent in the in-flight cleanup stack until the probe has completed, so an assertion failure reaches the outer cleanup trap. The scenario performs no update or self-upgrade work. The full `managed` scenario remains unchanged for deeper lifecycle coverage.

The selected provider also defines cleanup semantics. When the provider supports uninstall, the probe normally requires `uninstall` to report a change and refreshed inspection to report the executable absent. A checked-in cleanup exception can accept only an exact structured source-conflict failure after the provider removal ran; it is reported as a skip rather than a pass. For script or binary providers without uninstall capability, Quantex can only clear its tracking record; the probe asserts that operation but does not claim that the upstream binary was physically removed. The fresh hosted runner is then destroyed, which is the only honest physical cleanup boundary for remaining files.

### Stderr fallback in both observation paths

The legacy version utility and Core production observation use the same precedence rule: parse stdout when it contains output; otherwise parse stderr; preserve the existing parser and non-zero-exit behavior. This is intentionally generic instead of a Pi-only catalog exception, because a CLI's output stream is an integration detail shared by future agents.

### Successful empty uv inventory is absent

`uv tool list` exits zero on a fresh tool directory, writes no tool entries to stdout, and emits `No tools installed` on stderr. Treating every empty stdout as unknown prevents a safe fresh install before the upstream package is even contacted. Both the legacy package-manager probe and Core's read-only provider registry therefore classify only that exact successful empty-inventory marker as absent. A non-zero command, an unexpected warning, or empty output without the marker remains unknown or indeterminate; the change does not broaden mutation authority from ambiguous evidence.

### GitHub-hosted runner as the default real environment

The new workflow runs the quick matrix for relevant pull-request paths and the full matrix on a weekly schedule or manual dispatch. Each matrix job gets a fresh `ubuntu-latest` runner, a temporary HOME/Bun install root, and no external credentials. Bun/npm selections are made effective through the existing default-package-manager contract; catalog-first uv and Deno entries receive their required toolchain without writing unsupported values into product config. The canary can use a newer Bun than the repository build pin when a current real-agent package declares that runtime minimum. The workflow is advisory and is not added to required branch protection. Modal remains in `sandbox-tests.yml` for explicit remote transport and sandbox scenarios rather than being invoked on every edit.

### Documentation and taxonomy stay executable

The path taxonomy marks the canary script and workflow as sandbox-relevant. Workflow tests assert the event split, matrix command, temporary HOME, and non-required status. The isolation runbook describes when to use local Docker, Modal, the quick real canary, and the scheduled full sweep.

## Risks / Trade-offs

- [External registry or installer outage] -> Keep the canary advisory, print the exact matrix entry, and retain deterministic provider tests as the merge-gating signal.
- [Full Linux sweep is slow or flaky] -> Run jobs in parallel with a bounded timeout and reserve the full scope for schedule/manual dispatch; pull requests use only anchors.
- [Catalog provider ordering changes] -> Emit provider metadata in the matrix and test deterministic output; treat provider ordering as catalog-owned behavior rather than duplicating it in YAML.
- [An agent does not support a version command] -> Carry the catalog probe capability into the matrix and only require a version for entries that declare it; still assert installation and cleanup for every entry.
- [An official installer requires login or a TTY] -> Keep the agent in the matrix with a checked-in skip reason; do not inject credentials or a pseudo-terminal into the credential-free canary.
- [A catalog-first installer cannot complete in the current process] -> Keep the agent visible with a reviewed runner reason instead of claiming CI selected a provider that product routing cannot select.
- [A managed provider removes its package but leaves another executable] -> Accept only the reviewed structured source-conflict outcome after semantic assertions and report the cleanup phase as skipped.
- [An install-only provider cannot remove its binary] -> Assert Quantex untracking, keep failure cleanup best-effort, and let runner destruction provide physical isolation instead of asserting a capability the provider does not have.
- [Runner state leaks between steps] -> Set HOME and BUN_INSTALL to runner-temporary paths and run one agent per job; the smoke `finally` block performs best-effort uninstall cleanup.
- [uv changes its empty-inventory output] -> Match only the successful explicit marker and keep every unrecognized empty result indeterminate until the contract is reviewed.

## Migration Plan

1. Land the matrix resolver, probe assertions, stderr regression tests, and the advisory workflow together.
2. Run the quick matrix on the first relevant pull request and inspect failures by `(agent, provider)` before enabling the scheduled full sweep.
3. Keep the existing Modal workflow unchanged as a separate manual/scheduled transport check; contributors can migrate high-frequency real checks to the quick canary without installing Modal locally.
4. Rollback is a workflow-only revert: remove the canary workflow and script invocation. The version fallback and smoke assertions are backward-compatible and can remain independently.

## Open Questions

- Platform-specific full matrices (macOS and Windows) should be added when runner time and installer availability are measured; this change deliberately establishes the Linux disposable-runner baseline first.
