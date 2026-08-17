## 1. Catalog entries

- [x] 1.1 Remove the `cargo` method from `src/agents/catalog/codewhale.json`.
- [x] 1.2 Remove the `cargo` method from `src/agents/catalog/vtcode.json`.
- [x] 1.3 Remove the `mise` method from `src/agents/catalog/codex.json`.
- [x] 1.4 Remove the `uv` method from `src/agents/catalog/openhands.json`.
- [x] 1.5 Remove the `uv` and `pip` methods from `src/agents/catalog/vibe.json`, and drop `platforms.windows` entirely because those were its only Windows methods.
- [x] 1.6 Remove `openhands`'s `uv tool upgrade` self-update command. Its official installer downloads a standalone release binary from GitHub rather than registering a uv tool, so the uv upgrade would target a different installation than the one on disk.
- [x] 1.7 Add the `installed-version` probe to the `openhands` and `vibe` script candidates, so their credential-free canaries keep verifying `--version` evidence after losing the uv route that carried it.
- [x] 1.8 Run `bun run agent-catalog:generate` and confirm `src/agents/generated/*` and `src/core/generated/*` regenerate.
- [x] 1.9 Confirm no catalog entry declares `cargo`, `mise`, `pip`, or `uv`, and that every declared platform retains at least one method.

## 2. Tests

- [x] 2.1 Update the `codewhale`, `codex`, `openhands`, `vibe`, and `vtcode` expectations in `test/agents.test.ts`, including the removed mise install-command formatting assertion.
- [x] 2.2 Replace the cargo and uv/pip projections in `test/catalog-normalized-python-rust.test.ts` with a catalog-wide assertion that no ineligible provider is projected. Deno projection coverage stays through `genie`.
- [x] 2.3 Update the Codex package map in `test/catalog-normalized-registry.test.ts`.
- [x] 2.4 Remove the `vtcode` cargo assertion from `test/index.test.ts`.
- [x] 2.5 Update `test/agent-canary-matrix.test.ts` for the `openhands` and `vibe` move to the script provider, asserting `requireVersion` stays true for both.
- [x] 2.6 Repoint the uv-preference case in `test/core/production-observation.test.ts` to assert the surviving behavior: a `defaultPackageManager` preference for a provider no catalog agent exposes leaves candidate order untouched.
- [x] 2.7 Regenerate the v1 command-family goldens and confirm the regeneration touches only `info`, `inspect`, `list`, `resolve`, and the `ls` alias.
- [x] 2.8 Confirm uv and mise ordering stays covered by the synthetic `multiMethodAgent` cases in `test/package-manager/index.test.ts`, which do not read the catalog.

## 3. Docs

- [x] 3.1 Correct the provider list and the `defaultPackageManager` note in `README.md` and `README.zh-CN.md`.
- [x] 3.2 Confirm `docs/agent-support-matrix.md` needs no edit: it lists canonical slugs and required fields, not per-agent providers, and no agent leaves the catalog.
- [x] 3.3 Confirm `docs/generated/agent-provider-support.md` regenerates with `cargo`, `mise`, `pip`, and `uv` at zero agents.

## 4. Validation and delivery

- [x] 4.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`.
- [x] 4.2 Run `bun run test`.
- [x] 4.3 Run `bun run openspec:validate` and `bun run memory:check`.
- [x] 4.4 Run `bun run build` and `bun run package:check`.
- [ ] 4.5 Open the PR with a body validated by `bun run pr:body:check`, declaring a minor release.
- [ ] 4.6 After `remove-niche-agent-catalog-entries` merges, open the follow-up that adds `deno` to the ineligible set.
