## Why

Quantex 1.4/1.5 made Core the CLI apply default for `install` and `ensure`, but `update` and `uninstall` still live as thick CLI/legacy command modules. The 1.12 first slice continues the staged Core rebuild behind the frozen v1 shell: move the same-repo lifecycle engines for `install` / `update` / `uninstall` / `list` / `ensure` under thin CLI facades, without growing the published `quantex-core` SDK or cutting a 2.x identity.

Work-intake classification: observable CLI behavior, architecture boundaries, catalog/lifecycle routing, and product-facing Core transition docs. OpenSpec required before edits.

## What Changes

- Make CLI `install`, `ensure`, `update`, `uninstall`, and `list` thin facades over in-repo Core lifecycle engines while freezing package identity (`quantex-cli`), binaries (`qtx` / `quantex`), state schema version 2, command names/aliases, `--json` / `--output`, exit codes, and v1 root exports.
- Promote in-repo Core as the pre-invocation default engine for CLI `update` and `uninstall` (in addition to the already promoted `install` / `ensure`), keeping whole-invocation legacy escape and no post-side-effect fallback.
- Keep `list` on the existing Core read observation path; do not wrap a second CLI-shaped list over the public SDK `list()` method.
- Keep `run` / `exec` and the remaining frozen stable commands on their current implementations for this slice.
- Do **not** add `update` or `uninstall` to the published `quantex-core` public API (`createQuantex` surface).
- Do **not** change `release-core.yml` or Core's independent publish cadence.
- Do **not** add commands or aliases.
- Update compatibility, routing, and product-readme contracts so 1.12 correctly describes CLI Core ownership without implying a public SDK expansion or a 2.x break.

## Capabilities

### New Capabilities

- none

### Modified Capabilities

- `compatibility-contract`: expand the Core-default CLI promotion to include `update` and `uninstall` while freezing the published SDK surface and remaining v1 contracts.
- `installation-routing`: route CLI `update` and `uninstall` through the same whole-invocation Core/legacy selection rules used by `install` / `ensure`, still excluding `run`.
- `runtime-boundaries`: record that new lifecycle mutation behavior for this slice belongs in in-repo Core modules consumed by a thin CLI, not in a thicker CLI wrapper or a published SDK expansion.
- `product-readme`: correct the staged Core transition narrative for 1.12 (CLI Core for update/uninstall; SDK still omits those methods).
- `agent-update`: clarify that the maintained update behavior is executed by the in-repo Core engine behind the frozen CLI contract (no command/JSON/exit change).
- `agent-uninstall`: clarify that the maintained uninstall behavior is executed by the in-repo Core engine behind the frozen CLI contract (no command/JSON/exit change).

## Impact

- `src/core/` gains internal update/uninstall engine modules used by the CLI only.
- `src/commands/{install,ensure,update,uninstall,list,installation-routing}.ts` and related CLI adapters become thin Core facades.
- `openspec/specs/{compatibility-contract,installation-routing,runtime-boundaries,product-readme,agent-update,agent-uninstall}` receive deltas.
- `README.md` / `README.zh-CN.md` / `README.en.md` update the 1.12 Core transition wording.
- Tests under `test/core/`, `test/commands/`, and existing `--json` contract suites remain the regression gate.
- Out of scope: public SDK method expansion, Core npm publish workflow changes, rewriting remaining stable commands, new aliases, state schema migration, 2.x identity.
