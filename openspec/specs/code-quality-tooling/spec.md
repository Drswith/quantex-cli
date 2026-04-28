# Code Quality Tooling Specification

## Purpose

Define the current observable repository contract for linting, formatting, pre-commit enforcement, IDE defaults, and contributor-facing validation guidance.

## Requirements

### Requirement: Repository code quality toolchain

The repository SHALL use `oxlint` as the only linter and `oxfmt` as the only formatter for JavaScript, TypeScript, JSON, YAML, and other repository-managed code/config sources that are explicitly included in formatter configuration. Markdown sources MUST remain outside the default oxfmt surface unless a future OpenSpec change expands that scope. ESLint, `@antfu/eslint-config`, Prettier, and Biome MUST NOT be reintroduced as parallel lint or format tools without superseding this requirement through a new OpenSpec change.

#### Scenario: Contributor inspects the toolchain

- **WHEN** a contributor or coding agent inspects the repository's lint or format toolchain
- **THEN** the only lint binary invoked by repository scripts and CI is `oxlint`
- **AND** the only format binary invoked by repository scripts and CI is `oxfmt`
- **AND** there is no `eslint`, `@antfu/eslint-config`, `prettier`, or `biome` entry in `package.json` dependencies or devDependencies
- **AND** there is no `eslint.config.*`, `.eslintrc*`, `.prettierrc*`, or `biome.json` configuration file in the repository

### Requirement: Lint and format npm script entry points

The repository SHALL expose `bun run lint`, `bun run lint:fix`, `bun run format`, and `bun run format:check` as the canonical entry points for lint and format operations, regardless of the underlying binary.

#### Scenario: Coding agent runs validation per AGENTS.md

- **GIVEN** an agent or contributor follows the validation triggers documented in `AGENTS.md`
- **WHEN** they run `bun run lint`
- **THEN** the script invokes `oxlint` against the repository
- **AND** `bun run lint:fix` invokes `oxlint --fix`
- **AND** `bun run format` invokes `oxfmt` to write formatted files
- **AND** `bun run format:check` invokes `oxfmt --check` and exits non-zero on any unformatted file

### Requirement: Lint and format configuration files

The repository SHALL keep an `.oxlintrc.json` file at the repository root that configures lint behavior, and SHALL keep a single oxfmt configuration file (`.oxfmtrc.json` or another file format supported by the installed oxfmt version) at the repository root.

The lint configuration SHALL disable stylistic rules that overlap with `oxfmt` so that `oxlint` and `oxfmt` do not produce conflicting fixes.

The lint configuration SHALL require `@ts-ignore` comments to include a description explaining why the ignore is needed.

The lint configuration SHALL allow `console` usage inside `src/commands/**` and `src/cli.ts`, preserving the previous behavior that the user-facing CLI surface may emit diagnostic output.

#### Scenario: Stylistic rules conflict with formatter

- **WHEN** an oxlint rule and oxfmt would compete for the same range of source code
- **THEN** the oxlint configuration explicitly disables that rule so that oxfmt remains the single source of truth for formatting

#### Scenario: Contributor uses @ts-ignore

- **WHEN** a contributor adds an `@ts-ignore` comment
- **THEN** the comment includes a human-readable description explaining the reason

#### Scenario: CLI surface emits console output

- **WHEN** code under `src/commands/**` or `src/cli.ts` calls `console.log`, `console.warn`, or `console.error`
- **THEN** `bun run lint` does not flag the call as a violation

### Requirement: Formatter-driven import and package.json ordering

The oxfmt configuration SHALL enable import sorting to keep import ordering stable and minimize churn.

The oxfmt configuration SHALL enable `package.json` script sorting to minimize merge conflicts and keep scripts easy to scan.

#### Scenario: Contributor formats the repository

- **WHEN** a contributor runs `bun run format`
- **THEN** import statements are reordered deterministically according to the oxfmt configuration
- **AND** the `scripts` field in `package.json` is sorted deterministically according to the oxfmt configuration

### Requirement: Pre-commit lint and format enforcement

The repository SHALL enforce lint and format on staged files before each commit through `simple-git-hooks` and `lint-staged`. The pre-commit hook MUST run `oxfmt` on staged files supported by the formatter, and MUST run `oxlint --fix` only on staged JavaScript or TypeScript files after formatting, so that the linter sees post-formatter content without being invoked on unsupported file types.

#### Scenario: Contributor commits a staged file

- **GIVEN** a contributor stages files matched by `lint-staged` globs
- **WHEN** the pre-commit hook runs
- **THEN** the hook invokes `oxfmt` on staged formatter-supported files to write formatting fixes
- **AND** then invokes `oxlint --fix` on staged JavaScript or TypeScript files
- **AND** if either step fails, the commit is aborted

### Requirement: CI lint and format gate

CI workflows that gate merges to `main` or `beta` (such as `ci.yml`, `release.yml`, and `release-verify.yml`) SHALL run both `bun run lint` and `bun run format:check`. CI MUST fail when either command exits non-zero.

#### Scenario: Pull request CI runs lint and format checks

- **WHEN** a pull request targets `main` or `beta`
- **THEN** CI executes `bun run lint`
- **AND** CI executes `bun run format:check`
- **AND** the workflow status is `failure` if either command exits non-zero

### Requirement: IDE recommended extensions and settings

The repository SHALL recommend the official oxc VS Code extension (`oxc.oxc-vscode`) through `.vscode/extensions.json` and SHALL configure `.vscode/settings.json` so that the recommended extension provides lint diagnostics and format-on-save behavior for supported code/config languages while leaving Markdown out of automatic formatting. The repository MUST NOT recommend `dbaeumer.vscode-eslint` or any Prettier extension as part of the default contributor experience.

#### Scenario: Contributor opens the repository in VS Code

- **WHEN** a contributor opens the repository in VS Code with default settings
- **THEN** the IDE prompts them to install `oxc.oxc-vscode`
- **AND** the IDE does not prompt them to install `dbaeumer.vscode-eslint` or a Prettier extension
- **AND** auto-fix and format-on-save use the oxc extension when enabled

### Requirement: Documentation alignment for code quality tooling

`AGENTS.md`, the contributor-facing READMEs (`README.md`, `README.en.md`), the release runbooks under `docs/runbooks/`, and `.github/pull_request_template.md` SHALL describe local validation in terms of `bun run lint` and `bun run format:check`. They MUST NOT instruct contributors to invoke `eslint` or `prettier` directly.

#### Scenario: Contributor reads validation guidance

- **WHEN** a contributor or agent reads any current validation guidance under `AGENTS.md`, `README.md`, `README.en.md`, `docs/runbooks/`, or `.github/pull_request_template.md`
- **THEN** the validation guidance references `bun run lint` and `bun run format:check`
- **AND** the guidance does not reference `eslint`, `prettier`, or `@antfu/eslint-config` as a current command

### Requirement: oxc dependency version policy

The repository SHALL pin `oxlint` using a caret range on its current major (allowing automatic 1.x minor and patch upgrades) and SHALL pin `oxfmt` to an exact version while it remains in `0.x`. Upgrades to `oxfmt` MUST be performed in dedicated pull requests that include a fresh run of `bun run format` and a deliberate review of the resulting diff.

#### Scenario: Maintainer upgrades oxfmt

- **GIVEN** `oxfmt` publishes a new `0.x` minor or patch release
- **WHEN** the maintainer chooses to adopt it
- **THEN** the upgrade is delivered through a dedicated pull request that bumps the exact version in `package.json`
- **AND** the pull request includes the format reflow produced by running `bun run format` against the repository
- **AND** the pull request description records the previous and new oxfmt version

#### Scenario: Maintainer upgrades oxlint

- **GIVEN** `oxlint` publishes a new `1.x` minor or patch release
- **WHEN** the package manager resolves the caret range during `bun install`
- **THEN** no manual version bump is required
- **AND** if a regression appears, the maintainer narrows the caret range or pins the version in a dedicated pull request
