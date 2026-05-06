## Context

`jcode` is distributed from `1jehuang/jcode` with official shell and PowerShell installers plus a documented Homebrew tap for macOS. The install script downloads the latest GitHub release artifact and can replace an existing installation, but upstream user-facing docs do not publish a stable dedicated `jcode update` subcommand or a single cross-platform upgrade command that fits Quantex's current `selfUpdate.command` model.

Quantex should add `jcode` as a distinct supported lifecycle agent without inventing package metadata or upgrade semantics that upstream has not documented as a stable CLI contract.

## Goals / Non-Goals

**Goals:**

- Add `jcode` as a supported lifecycle agent.
- Record only upstream-documented install methods and stable version-probe behavior.
- Keep the implementation aligned with existing catalog/test/documentation patterns.

**Non-Goals:**

- Adding first-class managed package metadata beyond the documented Homebrew tap.
- Inventing a synthetic self-update command for `jcode`.
- Modeling source builds, provider login flows, browser setup, or other upstream feature areas unrelated to lifecycle metadata.

## Decisions

- Use `jcode` as both the canonical Quantex slug and executable name because the upstream binary and project branding are both `jcode`.
- Use the GitHub repository URL as the homepage because the upstream repository README is the primary published installation reference.
- Model the macOS Homebrew option as `brew install 1jehuang/jcode/jcode`, which preserves the documented tap source while fitting Quantex's managed Homebrew metadata shape.
- Model the shell and PowerShell one-liners from the upstream installation docs as script install methods for macOS, Linux, and Windows.
- Use `jcode --version` as the version probe because the official install script checks the existing installation with that command before replacing it.
- Omit `selfUpdate` metadata because upstream documentation currently publishes install paths, not a stable dedicated upgrade subcommand or a single portable command array that Quantex can safely execute across platforms.

## Risks / Trade-offs

- [Managed lifecycle gap] Homebrew is only documented for macOS, so Linux remains script-only. → Mitigation: record only the install methods upstream actually documents.
- [Upgrade expectation gap] The installer can update an existing install, but there is no single stable cross-platform update command in docs. → Mitigation: leave `selfUpdate` unset instead of encoding shell-specific pipelines into a global command array.
- [Doc drift] Upstream install snippets can change quickly. → Mitigation: keep the catalog scoped to canonical installer URLs and validate against the current repository docs when refreshing the entry.

## Migration Plan

- Add the `jcode` agent definition and register it in the catalog and root exports.
- Add tests that verify lookup, install methods, version probing, and the absence of `selfUpdate`.
- Update supported-agent tables to list `jcode`.
- Validate with lint, format check, typecheck, tests, and OpenSpec validation.

## Open Questions

- None.
