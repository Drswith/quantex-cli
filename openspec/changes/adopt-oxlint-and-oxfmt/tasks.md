## 1. Dependencies and configuration

- [x] 1.1 Remove `eslint` and `@antfu/eslint-config` from `package.json` devDependencies and delete `eslint.config.js`.
- [x] 1.2 Add `oxlint` (caret-pinned on its current 1.x major) and `oxfmt` (exact-pinned on its current 0.x release) to `package.json` devDependencies.
- [x] 1.3 Run `bun install` to refresh `bun.lock`.
- [x] 1.4 Create `.oxlintrc.json` with the project's lint defaults: rely on oxlint default `correctness` plugins, disable any stylistic categories that overlap with oxfmt, and allow `no-console` overrides for `src/commands/**`, `src/cli.ts`, `src/output/**`, and `src/command-runtime.ts`.
- [x] 1.5 Create the oxfmt configuration file at the repository root (`.oxfmtrc.json`) with project defaults (`singleQuote`, `semi: false`, `trailingComma: all`, `arrowParens: avoid`, `printWidth: 120`).

## 2. Scripts and pre-commit

- [x] 2.1 Update `package.json` scripts to:
  - `lint` -> `oxlint`
  - `lint:fix` -> `oxlint --fix`
  - `format` -> `oxfmt`
  - `format:check` -> `oxfmt --check`
- [x] 2.2 Update the `lint-staged` config so that staged JavaScript/TypeScript files run `oxfmt --write` first and then `oxlint --fix`, while other supported code/config files run `oxfmt --write` only; keep Markdown excluded.
- [x] 2.3 Verify `simple-git-hooks` pre-commit still wires through `bun install --frozen-lockfile && npx lint-staged`; no shape change required for the new `lint-staged` array form.

## 3. CI and release workflows

- [x] 3.1 Update `.github/workflows/ci.yml` lint job to run `bun run lint` followed by `bun run format:check`.
- [x] 3.2 Update `.github/workflows/release.yml` lint step to also run `bun run format:check`.
- [x] 3.3 Update `.github/workflows/release-verify.yml` lint step to also run `bun run format:check`.
- [x] 3.4 Confirmed `.github/workflows/openspec-archive.yml` requires no change (template text only references the `bun run lint` script entry that still exists).

## 4. IDE configuration

- [x] 4.1 Update `.vscode/extensions.json` recommendations to `oxc.oxc-vscode` and add `dbaeumer.vscode-eslint` plus `esbenp.prettier-vscode` to `unwantedRecommendations`.
- [x] 4.2 Update `.vscode/settings.json` to disable ESLint and Prettier extensions, set the default formatter to `oxc.oxc-vscode`, enable `source.fixAll.oxc`, and apply per-language formatter bindings for JS/TS/JSON/JSONC/YAML while keeping Markdown out of format-on-save.

## 5. Project memory and documentation

- [x] 5.1 Update `AGENTS.md` Validation section to list `bun run format:check` alongside `bun run lint`, add a trigger reminder to use `bun run lint:fix` and `bun run format` for fixes, add a tooling pointer for `.oxlintrc.json` / `.oxfmtrc.json`, and add a trigger-based pointer for the new `code-quality-tooling` spec.
- [x] 5.2 Update `docs/runbooks/releasing-quantex.md` to mention `bun run format:check` next to `bun run lint` in the post-release validation list and the local validation list.
- [x] 5.3 Update `docs/runbooks/release-and-self-upgrade-debugging.md` to mention `bun run format:check` in the local CI reproduction sequence.
- [x] 5.4 Update `README.md` agent bootstrap prompt and Local validation snippet to include `bun run format:check`.
- [x] 5.5 Update `README.en.md` agent bootstrap prompt and Local validation snippet to include `bun run format:check`.
- [x] 5.6 Update `.github/pull_request_template.md` validation checklist to include `bun run format:check`.
- [x] 5.7 Update `openspec/config.yaml` project context to record the toolchain change (`Lint: oxlint. Format: oxfmt.`).

## 6. Validation and closure

- [x] 6.1 Ran `bun run lint`, `bun run format`, and `bun run format:check`. Format reflow output kept as a single deliberate commit boundary for supported code/config files, and Markdown remains excluded via `.oxfmtrc.json`.
- [x] 6.2 Ran `bun run typecheck` (clean) and `bun run test` (40 files / 297 tests passing).
- [x] 6.3 Ran `bun run openspec:validate` (8/8 passing) and `bun run memory:check` (passed).
- [x] 6.4 Ran `bun run build` (130 KB output, complete in <1s).
- [ ] 6.5 Stage, commit, push, and open a pull request documenting the toolchain versions, the format reflow commit boundary, and the expected archive follow-up after merge.
