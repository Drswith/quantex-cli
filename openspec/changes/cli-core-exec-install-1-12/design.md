## Context

CLI `exec` / shortcut already observe and launch through
`executeAgentLifecycle` in in-repo Core. The production bridge
(`lifecycle-execution-production`) still implements the `install` port by
calling `reconcileAgentInstallation` from `src/lifecycle/agent-installation.ts`.
CLI `install` / `ensure` already use `createCoreInstallationCompatibilityExecutor`
/ `createCoreInstallationCliSession`. Product authorized the ninth 1.12 slice:
move that exec install port onto the same Core install/ensure path, then delete
lifecycle files that become zero-reference.

Frozen contracts that must not drift:

- Public `--install` enum: `never` / `if-missing` / `always` (default `never`
  on the public flag surface)
- `prompt` is interactive-only, not a JSON policy value
- `--json` payloads unchanged and must not expose engine/route fields
- Human/interactive agent launch keeps inherited stdio
- Exit codes unchanged

## Goals / Non-Goals

**Goals:**

- Route exec/shortcut install-before-launch through Core install/ensure.
- Preserve frozen exec/shortcut user-facing contracts listed above.
- Prove and delete only zero-reference `src/lifecycle` files.
- Keep CI and `package.json` scripts.

**Non-Goals:**

- Expanding published `quantex-core` API or changing `release-core.yml` / YAML.
- Changing `upgrade` / `config` / `capabilities` / `commands` / `schema`.
- Changing install/ensure `--dry-run` planner ownership.
- Expanding SDK methods or adding a published `run` / `exec` API.
- Deleting lifecycle modules still used by Core update/uninstall/observation.

## Decisions

### 1. Reuse the Core installation compatibility bridge

The production execution bridge replaces `reconcileAgentInstallation` with
`createCoreInstallationCompatibilityExecutor` (same internal bridge CLI
install/ensure use). Exec install requests use `mode: 'apply'` and
`operation: 'install'` when a missing agent must be installed before launch.
Adoption resolution mirrors the CLI session helper so untracked-but-adoptable
cases stay aligned with Core install/ensure.

**Alternatives considered:** Call `createCoreInstallationCliSession` and map
`CommandResult` — rejected because that path owns CLI event emission and dry-run
projection shaped for management commands. Call published `createQuantex().install`
— rejected because it would couple exec to the SDK surface and risk expanding
or reshaping published API expectations. Keep `reconcileAgentInstallation` as a
thin wrapper over Core — rejected because it preserves a zero-value second
engine boundary.

### 2. Map Core outcomes onto the existing LifecycleOutcome install port

`executeAgentLifecycle` keeps its `install: (...) => Promise<LifecycleOutcome<void>>`
port. The bridge maps Core invocation/execution outcomes to that type
(success / failed / cancelled / timed-out / indeterminate) so the Core
execution engine and frozen exit projection stay unchanged. Timeout wrapping
(`withInstallTimeout` + cancel) remains for the frozen install-phase timeout
contract.

### 3. Delete only proven zero-reference lifecycle files

After the bridge stops importing `reconcileAgentInstallation`, run an
import-graph proof over `src/lifecycle/*`. Expected deletions when production
importers drop to zero: `agent-installation.ts`, and any modules only reachable
through it (`mutation-planner.ts`, `reconcile.ts`). Update the barrel export.
Delete or rewrite tests that only existed for those modules. Update the receipt
writer contract suite so it no longer requires a legacy install writer.
Do not delete modules still used by Core or other production paths. Keep
CI/`package.json` scripts.

### 4. Freeze presentation and policy surfaces

Do not change `ExecInstallPolicy`, command-contract `--install` flags,
`--json` field names, human stdio inherit wiring, or exit-code mapping. Ownership
tests assert the production bridge no longer imports
`reconcileAgentInstallation` and does import the Core installation bridge.

## Risks / Trade-offs

- [Risk] Core install failure taxonomy projects differently than legacy
  reconcile → Mitigation: map outcomes explicitly; pin existing exec `--json`
  and exit tests; fail the slice on payload drift.
- [Risk] Over-deletion of lifecycle modules still used by Core → Mitigation:
  import-graph proof; delete only zero-ref files (lesson from #692 / #694).
- [Risk] Receipt contract still requires a legacy writer → Mitigation: update
  agent-canary-validation and the contract suite in the same change.
- [Trade-off] Exec continues to re-observe after install through the existing
  execution engine rather than returning Core's post-install observation
  directly; keeps launch path unchanged.

## Migration Plan

1. Land OpenSpec deltas for exec install Core routing and receipt-writer update.
2. Rewire `lifecycle-execution-production` install port onto Core install/ensure.
3. Prove lifecycle import graph; delete only zero-ref files; update tests.
4. Validate lint / format:check / typecheck / exec `--json` / `--install` /
   stdio tests.
5. Ship via normal PR; no Core npm publish required.

## Open Questions

- None.
