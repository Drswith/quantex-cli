## Context

The published Quantex CLI package now runs under Node, so `process.execPath` points to the Node executable for Bun- and npm-managed installs. Managed self-upgrade verification still assumes that `process.execPath` is the Quantex CLI itself, then calls `getInstalledVersion(process.execPath)`. That makes the post-upgrade verification path read `node --version` instead of the upgraded Quantex package version.

The bug is limited to managed self-upgrade verification. Binary installs still need the real executable path for release asset selection and in-place replacement behavior.

## Goals / Non-Goals

**Goals:**

- Verify managed self-upgrades against the installed Quantex CLI package entrypoint.
- Preserve binary self-upgrade executable-path behavior.
- Add regression coverage for Node-runtime managed installs.

**Non-Goals:**

- Redesign the self-inspection output surface.
- Change binary release selection or replacement semantics.
- Introduce a broader command-resolution subsystem for unrelated agent probes.

## Decisions

### Separate managed verification from binary executable-path usage

Managed installs will verify the upgraded version by executing the installed package entrypoint under the current host runtime. That means Quantex will build a version-probe command such as `node <packageRoot>/dist/cli.mjs --version` instead of re-running `process.execPath` directly.

Binary installs will keep using the executable path already stored in `SelfInspection`.

### Keep the fallback narrow

If Quantex cannot resolve a managed package entrypoint from `packageRoot`, it will fall back to the existing executable-path probe. This limits the behavior change to the path that is known to be wrong under the Node runtime while preserving current recovery semantics for unexpected layouts.

## Risks / Trade-offs

- If a managed install layout changes and no longer ships `dist/cli.mjs`, verification falls back to the legacy probe and may still fail conservatively.
- The verification command now depends on `packageRoot` staying aligned with the installed package layout, which is already a core assumption elsewhere in self inspection.
