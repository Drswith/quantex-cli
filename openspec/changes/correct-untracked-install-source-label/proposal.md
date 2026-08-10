## Why

`formatInstalledSource` returns the literal string `detected in PATH` whenever an agent has no tracked install state. That string was accurate while `PATH` membership was the only definition of availability. The `resolve-agent-executables-beyond-path` change (PR #614) widened executable resolution to `PATH` first, then a deterministic set of known install directories, so Quantex now routinely reports an agent as `detected in PATH` while its own `binaryPath` field points at a directory that is demonstrably absent from `PATH`:

```
HOME=<fresh home with a chmod +x binary at $HOME/.local/bin/goose>
bun run src/cli.ts --json --non-interactive inspect goose
# → binaryPath: "<home>/.local/bin/goose", sourceLabel: "detected in PATH"
```

The same falsehood reaches `list` (which maps the label to a literal `PATH` column value), `info`, `resolve`, `doctor`, and the `update --all` untracked-agent hint. Source evidence that contradicts the path printed beside it is worse than no evidence: it sends a user debugging a shell-profile problem to inspect a `PATH` that never contained the binary.

This request changes observable CLI behavior and human-readable output, so it is classified as requiring an OpenSpec change before code edits.

## What Changes

- Replace the untracked source label `detected in PATH` with `detected on disk`, which is true whether the executable resolved through `PATH` or through a known install directory.
- Change the `list` Source column value for that label from `PATH` to `detected`, so the column stops asserting a location Quantex did not verify.
- Correct the two untracked-agent warning strings that carry the same claim: the `doctor` `AGENT_UNTRACKED_IN_PATH` message and the `update --all` untracked-agent hint in `src/agent-update/messages.ts`.
- Update the pinned compatibility expectations (`test/compatibility/agent-inspection.test.ts`), the command suites, the read-only lifecycle smoke baseline, and the `list` v1 command-family output goldens to the corrected label, recording here that these fixture changes are an intended correction rather than an incidental edit.
- Update `docs/runbooks/quantex-troubleshooting.md`, which documents the old phrasing.

**Not changing** (deliberately — see `design.md`):

- The machine-readable `installSource` discriminator value `detected-in-path` in `resolve` output.
- The `inPath` boolean field on the v1 inspection projection.
- The `doctor` issue code `AGENT_UNTRACKED_IN_PATH`.
- The `isBinaryInPath` / `getBinaryPath` root exports.
- The `doctor` `SELF_INSTALLER_MISSING` message, which is a genuine statement about a package manager's `PATH` membership and remains correct.

These are machine identifiers that consumers key on; renaming them would be the breaking change that renaming prose is not.

## Capabilities

### Modified Capabilities

- `human-readable-output`: install-source evidence rendered to humans must describe the evidence Quantex actually holds, and must not name a resolution mechanism it did not use.
- `compatibility-contract`: pin the boundary between free-form human-readable label prose (correctable) and machine-readable identifiers (frozen), so the corrected label does not read as a v1 machine-contract break and so the frozen identifiers are not "corrected" alongside it later.

### New Capabilities

- None. This corrects the wording of existing evidence.

## Impact

- Affected code: `src/utils/install.ts`, `src/commands/list.ts`, `src/commands/doctor.ts`, `src/agent-update/messages.ts`.
- Affected output: the `Source` field of `inspect`, `info`, and `resolve`; the `Source` column of `list` and `doctor`; the `sourceLabel` string in the corresponding JSON payloads; two warning messages.
- Affected tests and baselines: `test/compatibility/agent-inspection.test.ts`, `test/commands/inspect.test.ts`, `test/commands/resolve.test.ts`, `test/commands/list.test.ts`, `test/commands/update.test.ts`, `test/commands/doctor.test.ts`, `test/utils/install.test.ts`, `scripts/smoke/read-only-lifecycle-smoke.ts`, and the `list` `json`/`ndjson` goldens in `test/fixtures/compatibility/v1/command-families.json`. The `list` `human` golden is unchanged, because the golden environment has no installed agent and therefore renders no Source value.
- Affected docs: `docs/runbooks/quantex-troubleshooting.md`.
- No CLI flags, schema field names, schema types, requiredness, persisted state formats, agent catalog entries, or root exports change. `sourceLabel` remains a free-form `{ type: 'string' }` field in `src/command-contract/schemas.ts`, so no schema edit is required and `package:check` is unaffected.
