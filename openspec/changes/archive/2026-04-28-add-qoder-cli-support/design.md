## Context

Quantex's agent catalog is defined as typed `AgentDefinition` entries under `src/agents/definitions/` and exported through `src/agents/index.ts`. Qoder CLI is lifecycle-compatible with this model because its official documentation exposes stable install, version, launch, and update commands.

## Goals / Non-Goals

**Goals:**

- Register Qoder CLI as a first-class supported agent.
- Preserve the existing agent catalog structure and lookup behavior.
- Cover the new entry with tests that validate metadata and install method shape.

**Non-Goals:**

- Do not add Qoder-specific workflow orchestration, command automation, or subagent behavior.
- Do not introduce a new package-manager provider.
- Do not change global CLI rendering or structured output schemas beyond the existing catalog item.

## Decisions

- Use canonical name `qoder` with display name `Qoder CLI`.
- Use binary name `qodercli`, matching official launch and version examples.
- Use npm package `@qoder-ai/qodercli` for Bun and npm managed installs.
- Include Homebrew as a cask install for macOS and Linux with package name `qoderai/qoder/qodercli`, matching the official tap/cask command.
- Include the official curl installer as a script fallback on macOS and Linux.
- Use `qodercli update` as the self-update command because official documentation lists it as the built-in update feature.

## Risks / Trade-offs

- Qoder's Homebrew package is installed with `--cask`, including on Linux per official docs; this depends on Homebrew cask support in the user's environment.
- The curl installer is macOS/Linux only, so Windows relies on managed npm/Bun installation.
- Qoder's automatic updates may already be enabled by default, but Quantex still records explicit update metadata for stable lifecycle planning.
