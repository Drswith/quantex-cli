# Design: Add Auggie CLI support

## Decision

Add Auggie CLI as a managed npm/bun agent on macOS and Linux, using the canonical Quantex slug `auggie`, the executable binary `auggie`, `auggie --version` for version probing, and `auggie upgrade` for explicit self-update metadata.

## Agent Definition

| Field | Value |
|---|---|
| name | `auggie` |
| lookupAliases | (none) |
| displayName | `Auggie CLI` |
| homepage | `https://docs.augmentcode.com/cli/overview` |
| packages | `@augmentcode/auggie` |
| binaryName | `auggie` |
| selfUpdate | `auggie upgrade` |
| versionProbe | `auggie --version` |

## Install Methods

| Platform | Method | Command |
|---|---|---|
| macOS | bun | `bun add -g @augmentcode/auggie` |
| macOS | npm | `npm install -g @augmentcode/auggie` |
| Linux | bun | `bun add -g @augmentcode/auggie` |
| Linux | npm | `npm install -g @augmentcode/auggie` |

## Rationale

- Auggie is published as the npm package `@augmentcode/auggie` and exposes the `auggie` binary; both npm and Bun execution were validated against the published package metadata and CLI entrypoint.
- Upstream documents explicit manual upgrades through `auggie upgrade`, so Quantex should record that command as lifecycle metadata even though Auggie also auto-updates during interactive sessions.
- Upstream documents support for macOS, Linux, and Windows WSL rather than native Windows. Quantex already treats WSL as `linux`, so this change should not advertise a native `windows` install method.
- The upstream docs currently document a stricter Node requirement than the published package metadata, but Quantex does not yet model engine requirements inside the agent catalog. This change keeps scope to supported lifecycle metadata.

## Non-Goals

- Model Auggie authentication, account setup, or workspace-indexing behavior in Quantex metadata
- Add native Windows support that the upstream docs do not currently claim
- Expand Quantex's catalog schema to capture runtime prerequisites such as Node version requirements
