## Context

`quantex-cli` is the primary published package. The current Release workflow publishes that package, uploads GitHub Release binaries, and then optionally sends a `repository_dispatch` event to `Drswith/quantex` so the separate alias package can publish a matching dependency wrapper.

That coupling is now undesirable. The alias package creates a visible npm dependent relationship from `quantex` to `quantex-cli`, and keeping a cross-repository dispatch in this workflow makes the primary release path depend on alias-package infrastructure.

## Decision

Remove alias-package synchronization from this repository's Release workflow entirely.

The primary release path should end after:

1. release-please creates the GitHub Release,
2. validation/build/package checks pass,
3. `quantex-cli` is published to npm,
4. generated binary artifacts are uploaded to the GitHub Release.

The workflow should not read `QUANTEX_SYNC_TOKEN`, derive alias npm tags, or call `https://api.github.com/repos/Drswith/quantex/dispatches`.

## Boundaries

- Keep package-local bin names `qtx` and `quantex` in `package.json`; they are user-facing command shims for `quantex-cli`, not npm package dependencies.
- Do not change self-upgrade, install docs, package metadata, or command examples in this change unless they mention the external alias-package sync.
- Do not attempt to unpublish or rewrite npm's existing `quantex` package from this repository. Removing the npm dependent relationship requires changing or deprecating the separate package.

## Risks

- Users who install the separate `quantex` npm package may stop receiving synchronized versions unless the alias repository is updated independently.
- Existing npm registry metadata may continue to show `quantex` as a dependent until the alias package removes its dependency on `quantex-cli` or is otherwise retired.

## Validation

- `bun run openspec:validate` confirms the release-workflow delta is valid.
- `bun run lint`, `bun run format:check`, and `bun run typecheck` cover repository baseline validation for workflow/docs/spec edits.
- `bun run test`, `bun run build`, `bun run build:bin`, and `bun run release:artifacts` provide full release-adjacent confidence because this change touches publishing automation.
