## Context

Quantex stores supported agents as lifecycle-focused JSON catalog entries under `src/agents/catalog/`, then generates deterministic runtime manifests. Antigravity CLI fits the existing catalog model: upstream documents a stable executable (`agy`), script installers, version probe, and self-update command.

## Goals / Non-Goals

**Goals:**

- Represent Antigravity CLI with existing catalog fields only.
- Keep install/update behavior data-driven and test-covered.
- Preserve deterministic generated catalog exports.

**Non-Goals:**

- Do not add new install method types for apt, rpm, or Google-specific package repositories.
- Do not add Antigravity plugin, skill, or multi-agent orchestration support.
- Do not change Gemini CLI behavior.

## Decisions

- Use `antigravity` as the canonical Quantex slug and `agy` as `binaryName`.
  - Alternative considered: use `agy` as the canonical slug. Rejected because Quantex canonical names usually describe the product, while `binaryName` already captures executable identity.
- Add `agy` and `antigravity-cli` as lookup aliases.
  - Alternative considered: no aliases. Rejected because users are likely to search by the executable and the product-qualified name.
- Use upstream script installers for all platforms.
  - Alternative considered: model Linux apt/rpm repositories. Rejected because the current catalog has no apt/rpm install method type, and the official script installer is already cross-platform enough for lifecycle support.
- Include `agy --version` and `agy update`.
  - Alternative considered: omit update metadata until more installer provenance exists. Rejected because upstream exposes a dedicated self-update command and Quantex can use it for self-managed update planning.

## Risks / Trade-offs

- [Risk] Upstream installer URLs or command names may change. -> Mitigation: keep the values isolated in the catalog JSON and covered by exact tests.
- [Risk] Some Linux distributions may expose an `antigravity` binary without `agy`. -> Mitigation: follow the official documented executable for Quantex support; alternate binary probing can be considered later with a separate contract.
