## Context

Kimi Code CLI's current upstream documentation says the CLI is written in TypeScript, distributed through npm, and runs on Node.js. The official recommended install path is still the Kimi install script, but the script URL has moved from the old `https://code.kimi.com/install.*` path to the current `https://code.kimi.com/kimi-code/install.*` path. The old Python/uv `kimi-cli` lifecycle is deprecated and is now a migration source rather than the supported fresh-install target.

The npm registry currently exposes `@moonshot-ai/kimi-code` with a `kimi` binary. The official CLI docs describe `kimi upgrade` as the built-in update entrypoint and also list package-manager upgrade commands for npm installs.

## Goals / Non-Goals

**Goals:**

- Keep Quantex's Kimi catalog entry aligned with the current official Kimi Code CLI lifecycle.
- Prefer the official install scripts in rendered install options while allowing npm-managed lifecycle operations.
- Remove stale uv package metadata and uv managed install methods from Kimi.
- Keep aliases stable so users can still find Kimi through `kimi-code` and the legacy `kimi-cli` search name.

**Non-Goals:**

- Remove uv support from Quantex or from agents that still document uv installation.
- Add Kimi-specific runtime behavior outside catalog metadata.
- Model pnpm as a managed installer; Quantex does not currently expose pnpm as a managed install type.
- Enforce Kimi's Node engine requirement inside the agent catalog.

## Decisions

### 1. Use `@moonshot-ai/kimi-code` as package metadata

The current npm package is the lifecycle package Quantex can install, update, and uninstall through the existing npm provider. Keeping `packages.uv = kimi-cli` would route managed operations to the deprecated Python toolchain, so the Kimi entry should only identify the npm package.

### 2. Keep script installers first

Kimi's current docs call script installation the recommended path because it does not require a preinstalled Node.js runtime and installs a verified executable into `PATH`. Quantex should list those script methods before npm so interactive users see the upstream-recommended path first.

### 3. Add npm managed methods, not Bun methods

Although Quantex can install many npm packages through Bun, Kimi's current upstream docs name npm and pnpm, not Bun. This change adds npm managed install methods only, avoiding an unsupported lifecycle claim.

### 4. Use `kimi upgrade` for self-update

The current CLI exposes `kimi upgrade` and chooses the appropriate update path for the detected install source. That is a better self-update command than the old `uv tool upgrade kimi-cli --no-cache`, which is tied to the deprecated distribution.

## Risks / Trade-offs

- [Existing uv-managed Kimi state may remain in user state files] -> Quantex keeps generic uv update/uninstall support, so existing recorded uv installs can still be handled by install state, while fresh catalog guidance moves to the current source.
- [npm package engine requirements can drift] -> The catalog records lifecycle methods, not engine enforcement; npm will surface engine/runtime issues when users choose npm-managed installation.
- [Legacy `kimi-cli` alias now points to a different package than the old uv tool] -> Keep the alias for lookup discoverability, but package metadata and install methods intentionally point at the current Kimi Code CLI.
