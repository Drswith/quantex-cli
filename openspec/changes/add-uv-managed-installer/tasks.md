## 1. Core Implementation

- [x] 1.1 Add uv to managed install types, package metadata, install-method helpers, and installer capability classification.
- [x] 1.2 Add uv availability detection and uv installer implementation for install, update, batch update, uninstall, and best-effort installed-version parsing.
- [x] 1.3 Wire uv into managed installer lookup, install/update/uninstall execution, latest-version inspection fallback, and batch update grouping/order.
- [x] 1.4 Render uv install commands and expose uv availability in `capabilities`, `doctor`, and doctor schema output.

## 2. Agent Migration

- [x] 2.1 Migrate OpenHands CLI from unmanaged uv binary hints to managed uv tool install metadata while preserving script fallback and platform scope.
- [x] 2.2 Migrate Mistral Vibe from unmanaged uv binary hints to managed uv tool install metadata while preserving pip and script methods.
- [x] 2.3 Add Kimi CLI uv package metadata and managed uv tool install methods for supported platforms while preserving existing script and self-update behavior.

## 3. Tests

- [x] 3.1 Add or update unit coverage for uv installer commands, installed-version parsing, command rendering, update planning, grouped updates, uninstall, diagnostics, and schema output.
- [x] 3.2 Add or update catalog coverage for OpenHands, Mistral Vibe, and Kimi CLI uv metadata and platform install methods.

## 4. Validation and Delivery

- [x] 4.1 Run `bun run openspec:status -- --change add-uv-managed-installer`.
- [x] 4.2 Run `bun run openspec:validate`.
- [x] 4.3 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`.
- [x] 4.4 Commit, push, and create a PR with a body file validated by `bun run pr:body:check`.
