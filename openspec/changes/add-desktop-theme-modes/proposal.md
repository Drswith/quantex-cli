## Why

Quantex Desktop currently ships the default shadcn light and dark tokens but always renders in light mode. Users need an explicit appearance preference that can follow macOS automatically or remain fixed to light or dark.

## What Changes

- Add `system`, `light`, and `dark` appearance modes to Desktop-only preferences, defaulting to `system`.
- Apply the selected mode across the complete Desktop UI and respond to macOS appearance changes while `system` is selected.
- Expose the appearance choice in the header and Desktop settings using default shadcn components.
- Keep browser mock development deterministic while allowing all three modes to be reviewed without Tauri.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `macos-desktop-client`: Add persisted three-mode appearance behavior and browser-preview coverage.

## Impact

- Affects Desktop preference types and persistence, React theme application, settings/header controls, mock data, and Desktop tests.
- Does not change Quantex CLI configuration, lifecycle state, bundled CLI commands, or the default shadcn theme tokens and generated component implementations.
