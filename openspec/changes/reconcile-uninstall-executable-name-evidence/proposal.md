## Why

`qtx uninstall <agent>` fails closed with `Recorded sources disagree for <agent>.` for every package-provider agent whose lifecycle receipt was written by `qtx update`. Reproduced against a real user state file: `opencode`, `claude`, and `codex` are all unremovable, while `cursor` (a `script` install) and `pi` (no receipt) still uninstall normally.

The two records do not actually disagree. They differ only in whether the agent's default executable name is spelled out:

- `resolveStateProviderBinding` sets `target.binaryName` only for `binary`, `script`, and `deno` providers (`src/lifecycle/provider-binding.ts:30`), so a `bun`/`npm` package state binding carries no executable name.
- `resolveReceiptProviderBinding` sets `target.binaryName` whenever the receipt has an `executableName` (`src/lifecycle/provider-binding.ts:48`).
- `qtx update` writes `executableName: after.agent.binaryName` unconditionally (`src/services/lifecycle-updates.ts:775`), while both install engines write it through a conditional spread that is empty for package providers (`src/core/installation-production.ts:213`, `src/lifecycle/agent-installation.ts:74`).

The canonical comparator `providerBindingsEqual` exists precisely to absorb that asymmetry: it takes a `defaultExecutableName` and compares `left.binaryName ?? default` against `right.binaryName ?? default` (`src/lifecycle/provider-binding.ts:97`). `src/commands/uninstall.ts:275` carries a private copy of that comparator that dropped the fallback, so `undefined !== "opencode"` is reported as a conflicting source.

The defect survived every validation layer:

- The canary lifecycle smoke does run `install → update → uninstall` for `opencode`, but the update it runs is always a no-op: the agent was just installed at the registry's newest version, so `decideUpdate` returns `up-to-date` (`src/lifecycle/update-planner.ts:70`) and `createReceipt` is never reached (`src/services/lifecycle-updates.ts:460`). The receipt-writing branch of `update` is unreachable inside a single CI job.
- `test/commands/uninstall.test.ts` is the only suite in the repository whose lifecycle-receipt fixture omits `executableName`; every other suite pins `executableName: 'test-bin'`. Both sides of the comparison were `undefined`, so the mismatch could not appear.
- The legacy/Core differential gate only covers `install` and `ensure` (`test/compatibility/core-installation-differential.test.ts:381`), so neither `update` (writer) nor `uninstall` (reader) is inside it.

This changes observable CLI behavior, so it is classified as requiring an OpenSpec change before code edits.

## What Changes

- `uninstall` evidence reconciliation treats an omitted executable name as the agent's declared `binaryName`. Recorded state and receipt evidence that differ only by that default are the same source, not a conflicting one.
- Replace the private comparator in `src/commands/uninstall.ts` with the canonical `providerBindingsEqual`, passing `agent.binaryName` as the default, so there is one definition of binding equality rather than two.
- Correct the `managedReceipt` fixture in `test/commands/uninstall.test.ts` to carry `executableName`, matching every other receipt fixture and the shape `qtx update` actually persists.
- Add regression coverage pinning both persisted receipt shapes — with and without `executableName` — as the same source, and keeping a genuinely different executable name a conflict.

**Not changing** (deliberately — see `design.md`):

- The unconditional `executableName` write in `qtx update`, and the conditional writes in both install engines. Normalizing the writers would not heal the receipts already on users' disks, and the reader has to tolerate both shapes regardless.
- The `conflicting-source` failure classification itself. It stays for real conflicts, including a receipt that names a genuinely different executable.

## Capabilities

### Modified Capabilities

- `agent-uninstall`: add the default-executable-name equivalence rule to uninstall evidence reconciliation, so recorded evidence that omits the agent's default executable name is not reported as a conflicting source.

### New Capabilities

- None. This corrects how existing evidence is compared.

## Impact

- Affected code: `src/commands/uninstall.ts`.
- Affected behavior: `qtx uninstall <agent>` for package-provider agents (`bun`, `npm`, `cargo`, `pip`, `uv`, `mise`, `brew`, `winget`) that have been updated at least once. These currently return `UNINSTALL_FAILED` with `details.lifecycle = "conflicting-source"` and will now proceed to normal managed uninstall.
- Affected tests: `test/commands/uninstall.test.ts`.
- No CLI flags, schema fields, error codes, persisted state formats, agent catalog entries, or root exports change. `conflicting-source` remains a valid `details.lifecycle` value, emitted by the unchanged code paths at `src/commands/uninstall.ts:108`, `:209`.
