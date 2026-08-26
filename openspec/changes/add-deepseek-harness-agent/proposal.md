## Why

DeepSeek ships [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`), a plugin-architecture agent harness with a real CLI launcher: `dsh --profile <name>` boots a profile, `dsh --profile headless "job"` runs one non-interactive session, and `dsh web` starts the browser UI. It is distributed as the npm package `@deepseek-ai/dsh`, which declares `dsh` as its binary. Users expect `quantex install dsh` and `qtx dsh` to manage it like any other supported agent.

The catalog has no DeepSeek-published entry. `codewhale` is a third-party DeepSeek-first agent from `Hmbown/CodeWhale`, and `reasonix` is a third-party DeepSeek-native agent from `esengine/DeepSeek-Reasonix`; neither is this project.

`remove-niche-agent-catalog-entries` narrowed the catalog to the agents users actually reach for, on measured adoption. This entry is the other side of that rule: upstream measured 195,665 stars and 22,150 forks on 2026-08-26, published by the vendor itself.

Work-intake classification: agent catalog fields, install methods, version probing, update planning, and product-facing docs. That requires an OpenSpec change before edits.

## What Changes

- Add DeepSeek Harness to the supported agent catalog under the canonical slug `dsh`, with the lookup alias `deepseek-harness`.
- Record the official npm managed install (`@deepseek-ai/dsh`) on Windows, macOS, and Linux, with the executable `dsh` and the version probe `dsh --version`.
- Declare no self-update command, because the launcher's grammar has no update verb; Quantex plans updates through the recorded npm source.
- Sync the generated catalog manifests, schema, provider-support matrix, README tables, agent-support matrix, and skill recipe list.
- Add focused catalog tests for lookup, metadata, install methods, and the absence of a self-update command.

**Not changing** (deliberately):

- The bare `deepseek` and `deepseek-tui` lookup names stay unresolvable. That is an accepted requirement under `agent-catalog` from the DeepSeek TUI rename, and this entry does not reclaim those names.
- No `bun`, `brew`, `winget`, `script`, or `binary` install method is invented. Upstream documents Node.js plus npm as the only distribution, and its GitHub releases carry no binary assets.
- No root export. The v1 root export snapshot is frozen at 117 names, so a new catalog entry joins `src/agents/index.ts` only, exactly like `amp`, `crush`, `kiro`, and `qwen`. `test/fixtures/compatibility/v1/root-exports.json` and the pinned root declaration are untouched.

## Capabilities

### Modified Capabilities

- `agent-catalog`: add DeepSeek Harness as a supported lifecycle agent.

### New Capabilities

- None.

## Impact

- **Not breaking.** Adding a catalog entry is additive: no command, flag, schema field, exported symbol, or persisted-state format changes shape.
- Affected specs: `openspec/specs/agent-catalog/spec.md`.
- Affected code: `src/agents/catalog/dsh.json`, `src/agents/index.ts`, and the generated outputs of `bun run agent-catalog:generate` (`src/agents/generated/`, `src/agents/catalog.schema.json`, `src/core/generated/`, `docs/generated/agent-provider-support.md`).
- Affected fixtures: `test/fixtures/compatibility/v1/command-families.json` golden digests for `capabilities`, `agents`/`list`, and the `list` aliases, because the supported-agent set is part of that rendered output.
- Affected docs: `README.md`, `README.zh-CN.md`, `docs/agent-support-matrix.md`, `skills/quantex-cli/references/command-recipes.md`.
- Canary: `agent-canary-validation` requires the full scope to cover every catalog agent with a Linux candidate, so `dsh` joins the full matrix through its npm candidate with installed-version evidence required. No selector edit is needed.
- **Known risk, accepted:** upstream is in developer preview and its npm `latest` dist-tag currently resolves to the prerelease `0.1.1-rc.2`. Quantex resolves the `latest` dist-tag without filtering prereleases, so install, target-version, and update all work today; upstream's own README warns of compatibility-breaking changes, and the advisory full canary is the mechanism that surfaces breakage. `design.md` records the alternatives considered.
