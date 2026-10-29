# Rust rewrite

Status: in progress. Tracked in Linear project [Quantex Rust 重写](https://linear.app/drswith/project/quantex-rust-重写-aabfd145a2e1) (P-DRS-5).

## Goal

Re-implement `quantex` / `qtx` from scratch in Rust as a drop-in replacement for the TypeScript release line (v1.13.x). Only the interface a human or an agent can observe is preserved; internals, CI, project process, and agent instructions are rebuilt. The contract itself is described in [`contract/README.md`](../../contract/README.md).

## Baseline (v1.13.6, darwin-arm64)

- The Bun-compiled release binary is 63 MB.
- `--version` takes 51 ms from the Bun binary and 108 ms from the npm/bun-installed JavaScript build; `commands --json` takes 57 ms.
- `list --json` takes 4.3–7.6 s. The time goes to network version lookups and agent probes, not runtime startup.

## Decisions

1. **Scope.** TypeScript internals, the Core/CLI package split, the `quantex-core` SDK, the npm root library exports, and the v1/v2 staged-migration governance are not constraints. The CLI-facing interface is.
2. **Human output is not contract.** Only JSON / NDJSON, exit codes, error codes, and stdout / stderr routing are locked. Human text keeps its meaning; layout may change.
3. **Argument-parse errors become `INVALID_ARGUMENT`.** Exit code 2, and the error envelope in `json` / `ndjson` mode. v1.13.6 prints `error: unknown option '--bogus'` to stderr and exits 1, which contradicts its own error table.
4. **`~/.quantex` formats are kept exactly**, including the lock protocol, so the TypeScript and Rust builds can share one home directory and users can roll back.
5. **OpenSpec is retired.** Contract data plus contract tests replace it. Decisions that need a record go here or in `docs/design/`.
6. **CI, `AGENTS.md`, and agent-instruction files are rewritten from scratch.** One `AGENTS.md`; `CLAUDE.md` imports it.
7. **Releases ship from `Drswith/quantex-cli`.** v1 binaries hard-code `https://github.com/Drswith/quantex-cli` and download `releases/latest/download/<asset>`, so asset names, `SHA256SUMS.txt`, and `manifest.json` keep their v1.13.6 shape.
8. **`skills/quantex-cli/` keeps its path.** Users install it with `npx skills add Drswith/quantex-cli --skill quantex-cli` from the default branch.
9. **After 2.0.0-beta.1, trim instead of matching v1.** `2.0.0-beta.1` is the v1.13.6-compatible baseline. From 2.0.0-beta.2 the aim is a small, light tool: rarely used agents and the providers only they needed are removed, and v1 behaviour is kept only where users depend on it. Reading and writing `~/.quantex` alongside 1.x, the release assets, and the self-upgrade path stay fixed.

## Branch plan

- `main` stays the TypeScript maintenance line and receives only critical fixes.
- This line starts from a deletion commit on top of `main` (not an orphan branch), so the final cutover is an ordinary pull request.
- Contract tests use the published v1.13.6 binary as the reference; no TypeScript source is needed on this line.
- Cutover: once every contract test passes and a real v1.13.6 binary has upgraded itself into a Rust prerelease, one pull request replaces `main` and the line ships as 2.0.0.
- Prereleases are tagged `v2.0.0-beta.N` and marked as GitHub prereleases (so `releases/latest` never selects them). Once npm publishing is on, they go to npm under the `beta` dist-tag, which the beta channel upgrades from. `2.0.0-beta.1` is the build that matches v1.13.6 and is published on GitHub only; later betas trim the product instead of matching v1.

## Architecture

One Cargo workspace:

| Path | Role |
|---|---|
| `crates/quantex` | The binary and its library. Modules below. |
| `tests/contract` | Black-box contract suite. Spawns `QUANTEX_BIN` in a temporary home with fake package managers on `PATH` and a local HTTP stub. |
| `contract/` | Interface data embedded into the binary at build time (`include_str!`). |
| `crates/release` | `quantex-release`: packages built binaries into the GitHub release assets and the npm packages (a `quantex-cli` launcher plus one `quantex-cli-<platform>-<arch>` package per binary). See [`docs/runbooks/releasing.md`](../runbooks/releasing.md). |

Modules inside `crates/quantex`:

- `cli`: argv pre-dispatch for the bare-agent shortcut, then clap, built from `contract/cli/registry.json`.
- `protocol`: result envelope, NDJSON events, error codes, exit codes, stdout / stderr routing.
- `catalog`: the embedded agent catalog and platform method resolution.
- `store`: `state.json`, `config.json`, version cache, idempotency records, directory locks.
- `probe`: executable resolution on `PATH`, version probes, the lenient version comparison from v1.
- `providers`: one module per package manager or installer (npm, bun, brew, winget, script, cargo, deno, mise, pip, uv, binary).
- `lifecycle`: observe, decide, execute, verify, record.
- `commands`: one module per command.
- `selfupdate`: install-source detection and the binary / npm / bun upgrade paths.
- `term`: colour, width, wrapping, prompts.

Key choices:

- **Synchronous code with scoped threads** for parallel probes and lookups; no async runtime. This also fixes the slow `list --json`.
- **`ureq` with rustls** for HTTP, so there is no system TLS dependency.
- **`serde_json` with `preserve_order`**; every envelope field states explicitly whether it is omitted or `null`.
- **Contract JSON is embedded**, and unit tests check that the clap definitions match `registry.json`.
- **Agent launch uses spawn-and-wait** on every platform, so post-run work such as the update notice behaves the same everywhere. Revisit `exec()` on Unix only if a measurement justifies it.

## Milestones

| Milestone | Scope | Linear |
|---|---|---|
| M0 contract baseline | Clean branch, contract data, `AGENTS.md`, Cargo skeleton, CI, contract suite | DRS-160 – DRS-163 |
| M1 read-only commands | Protocol, catalog, store, `commands` `schema` `capabilities` `list` `info` `inspect` `resolve` `doctor` `config` | DRS-164 – DRS-166 |
| M2 launch | `run`, `exec`, bare-agent shortcut | DRS-167 |
| M3 mutation | Providers, `install` `ensure` `update` `uninstall` | DRS-168 – DRS-169 |
| M4 self-upgrade and distribution | `upgrade`, five-target release, npm packages, install scripts | DRS-170 – DRS-171 |
| Cutover | README and product skill rewrite, upgrade verification, replace `main`, 2.0.0 | DRS-172 – DRS-173 |

## Open questions

- Should the parse-error change (decision 3) also land on the TypeScript line before cutover? It would let the reference binary pass the same contract cases.
- Do any external consumers of the npm library exports or `quantex-core` need a replacement?
