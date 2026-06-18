## Why

Fresh Codex environments should start from the committed lockfile and have the repository CodeGraph index ready before an agent begins structural code exploration. The current setup only runs `bun install`, which allows lockfile drift and leaves CodeGraph initialization as a manual follow-up.

## What Changes

- Run `bun install --frozen-lockfile` in the Codex environment setup script.
- Initialize CodeGraph during Codex environment setup with `codegraph init -i`.
- Add Codex environment cleanup for transient `.tmp` files and local package tarballs.
- Ignore CodeGraph runtime PID and socket files so local indexing state does not pollute git status.
- No CLI behavior, published package surface, or runtime user command changes.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `code-quality-tooling`: define the Codex environment setup and cleanup contract for repository validation tooling and CodeGraph readiness.

## Impact

- Affected files: `.codex/environments/environment.toml`, `.codegraph/.gitignore`, and the `code-quality-tooling` OpenSpec delta for this change.
- Validation: repository baseline validation, OpenSpec validation, project-memory validation, and direct execution of the new setup commands.
