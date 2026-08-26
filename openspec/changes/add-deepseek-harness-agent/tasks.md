## 1. OpenSpec contract

- [x] 1.1 Record the upstream evidence (npm package, binary name, version flag, entry modes, platform support, release assets, adoption) before proposing catalog metadata.
- [x] 1.2 Write the proposal, design, and `agent-catalog` spec delta for adding DeepSeek Harness.
- [x] 1.3 Confirm `bun run openspec:status -- --change add-deepseek-harness-agent` reports the change ready for apply.

## 2. Catalog implementation

- [x] 2.1 Add `src/agents/catalog/dsh.json` with the `deepseek-harness` alias, the npm candidate on all three platforms, and the `dsh --version` probe, and without a self-update command.
- [x] 2.2 Run `bun run agent-catalog:generate` and commit the regenerated manifests, schema, support JSON, provider-support matrix, and Core catalogs.
- [x] 2.3 Re-export `dsh` from `src/agents/index.ts`, and confirm the frozen v1 root export snapshot stays untouched.

## 3. Docs

- [x] 3.1 Add the DeepSeek Harness row to `README.md` and `README.zh-CN.md`.
- [x] 3.2 Add `dsh` to the supported canonical slugs in `docs/agent-support-matrix.md`.
- [x] 3.3 Add `dsh` to the supported-agent list in `skills/quantex-cli/references/command-recipes.md`.

## 4. Tests

- [x] 4.1 Add focused catalog tests for lookup, alias, metadata, npm install methods on every platform, and the absence of a self-update command.
- [x] 4.2 Assert that `deepseek` and `deepseek-tui` remain unresolved after the entry is added.
- [x] 4.3 Refresh the v1 command-family goldens with `UPDATE_V1_COMMAND_GOLDENS=1`, and confirm only the supported-agent-derived digests moved.

## 5. Validation and delivery

- [x] 5.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`.
- [x] 5.2 Run `bun run openspec:validate` and `bun run memory:check`.
- [x] 5.3 Verify the real lifecycle locally: install `@deepseek-ai/dsh` into a disposable prefix and confirm `dsh --version` reports a version, so the canary's installed-version requirement is met before the entry joins the full matrix.
- [ ] 5.4 Commit, push, and open the PR with a body validated by `bun run pr:body:check`.
- [ ] 5.5 Report validation, OpenSpec, git, commit, remote, PR, release, and archive-closure state at handoff.
