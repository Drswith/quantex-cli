## Context

Quantex already has a managed installer abstraction for Bun, npm, Homebrew, Cargo, pip, uv, and winget. mise can install and activate CLI tools globally through `mise use --global`, supports npm backend tool references such as `npm:prettier`, and exposes installed tool data through `mise ls --json`. That maps cleanly to Quantex's agent lifecycle layer without making Quantex manage project-local mise config.

Issue 280 asks for mise capability probing, install-source recording, and update strategy parity with existing package-manager integrations. The change therefore touches catalog metadata, package-manager execution, structured output, config normalization, and docs.

## Goals / Non-Goals

**Goals:**

- Model mise as a managed agent lifecycle install type.
- Preserve recorded install source semantics for install, ensure, update, update-all grouping, uninstall, inspect, doctor, and capabilities.
- Allow users to prefer mise through `defaultPackageManager` when the selected agent exposes a mise method.
- Add a verified mise-managed Codex CLI path through mise's npm backend.

**Non-Goals:**

- Do not manage project-local mise configuration, tasks, environments, or arbitrary toolchain workflows.
- Do not add Quantex self-upgrade through mise.
- Do not install mise automatically.
- Do not redefine unrelated package-manager precedence for agents that do not expose mise methods.

## Decisions

### 1. Represent mise as a managed install type

Add `mise` to `ManagedInstallType`, installer capabilities, catalog schema, state-compatible install sources, and structured installer availability maps. This matches how Cargo, pip, and uv were added and lets existing lifecycle flows use recorded state without a parallel code path.

Alternative considered: render mise as an unmanaged command hint. That would show users a command but would not satisfy source recording, update-all grouping, or diagnostic parity.

### 2. Store complete mise tool references in `packages.mise`

For Codex CLI, the mise package reference is `npm:@openai/codex`. Quantex treats the mise package name as a mise tool reference rather than deriving it from `packages.npm`, because future agents may use mise registry aliases or other mise backends.

Alternative considered: derive `npm:<packages.npm>` automatically for every npm agent. That would change many catalog entries at once and make support claims before each agent path is verified.

### 3. Target global mise configuration

Quantex-managed mise installs SHALL use global mise state:

- install: `mise use --global <tool-ref>`
- update: `mise use --global --force <tool-ref>`
- uninstall: `mise unuse --global <tool-ref>`

This keeps lifecycle operations independent of the user's current project directory. Update uses `mise use --global --force` rather than `mise upgrade` because the latter is oriented around active config scopes, while Quantex needs to target the recorded global install source deterministically.

### 4. Add best-effort installed-version inspection

Quantex SHALL run `mise ls --installed --json <tool-ref>` for mise-managed installed-version lookup and parse the first string `version` from the matching tool entry. If the JSON shape is unknown or the tool is missing, Quantex returns `undefined` and falls back to the agent binary version probe.

### 5. Scope `defaultPackageManager` expansion to mise

Allow `defaultPackageManager` to normalize to `mise` in addition to Bun and npm. This only reorders install methods when a current-platform agent definition exposes a mise method, preserving existing fallback behavior otherwise.

## Risks / Trade-offs

- [mise JSON shape changes] -> The parser is best-effort and returns `undefined` for unknown shapes; lifecycle correctness does not depend on it.
- [mise tool reference ambiguity] -> Catalog entries store complete mise refs, and tests cover scoped npm refs such as `npm:@openai/codex`.
- [Project-local config interference] -> Install, update, and uninstall explicitly use `--global`.
- [Overbroad catalog support] -> Initial catalog migration covers one verified agent path; future agents can add mise metadata intentionally.

## Migration Plan

1. Add mise types, schema, detection, installer execution, command rendering, config normalization, structured output, and tests.
2. Add Codex CLI mise metadata and generated catalog/schema updates.
3. Update README and OpenSpec deltas.
4. Validate with OpenSpec status/validation plus lint, format check, typecheck, and tests.
