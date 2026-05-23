## Context

Deep Code CLI is published at `lessweb/deepcode-cli` with a documented npm install path (`npm install -g @vegamo/deepcode-cli`) and a stable runtime command (`deepcode`). The CLI help output documents `deepcode --version`, but does not publish a dedicated self-update subcommand.

Quantex should add Deep Code as a lifecycle-focused catalog entry without inventing unsupported install methods or synthetic update commands.

## Goals / Non-Goals

**Goals:**

- Add `deepcode` as a first-class supported lifecycle agent.
- Record upstream-verified install and version-probe metadata.
- Keep implementation aligned with existing catalog, tests, and supported-agent documentation patterns.

**Non-Goals:**

- Adding new package-manager types or changing Quantex lifecycle architecture.
- Inventing a dedicated Deep Code self-update command when upstream docs do not provide one.
- Modeling Deep Code runtime configuration, model routing, or TUI behaviors outside lifecycle metadata.

## Decisions

- Use `deepcode` as both canonical slug and executable name because upstream CLI usage documents that command as the user entrypoint.
- Use `Deep Code CLI` as display name and `https://github.com/lessweb/deepcode-cli` as homepage so the catalog points to the upstream source-of-truth repository.
- Record npm package metadata as `@vegamo/deepcode-cli` and expose npm-managed install on Windows, macOS, and Linux.
- Use `deepcode --version` as version probe because upstream help documents that flag explicitly.
- Omit `selfUpdate` metadata because upstream docs currently do not publish a stable dedicated upgrade subcommand.

## Risks / Trade-offs

- [Managed-source dependency] Deep Code install/update lifecycle depends on npm availability. -> Mitigation: keep install metadata explicitly npm-managed across all platforms.
- [Update expectation gap] Users may expect `deepcode update` parity with other agents. -> Mitigation: leave `selfUpdate` unset and rely on managed package-manager update flows that Quantex already supports.
- [Doc drift] Upstream install or CLI help text may change. -> Mitigation: tie metadata to documented npm package and CLI help output so future refreshes can re-verify quickly.

## Migration Plan

- Add `src/agents/catalog/deepcode.json` and regenerate catalog exports.
- Add tests covering lookup, metadata, install methods, and version probe behavior.
- Update supported-agent tables in product-facing README files.
- Validate with lint, format check, typecheck, tests, and OpenSpec validation.

## Open Questions

- None.
