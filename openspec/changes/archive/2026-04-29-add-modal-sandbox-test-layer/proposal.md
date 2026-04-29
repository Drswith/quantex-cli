## Why

The repository's local Vitest suite already protects most CLI logic, but a small set of lifecycle-oriented checks still benefit from running in a clean environment that does not share the contributor's real home directory, PATH, or globally installed tools. We need an opt-in isolation layer now so Quantex can validate host-sensitive flows without turning the default developer loop into a remote-only workflow or requiring every contributor workstation to have Modal installed.

## What Changes

- Add an optional `bun run test:sandbox` maintainer command that runs real Quantex agent lifecycle smoke checks inside a Modal sandbox.
- Add an optional `bun run test:container` maintainer command that runs the same lifecycle smoke checks inside a local Docker container when contributors do not have Modal installed locally.
- Keep `bun run test` as the canonical local suite and document that the Docker and Modal layers are extra isolation passes rather than replacements.
- Add a repository-managed harness that mounts the current checkout into an isolated Bun container, copies it into an internal temporary work directory, installs dependencies inside that environment, and executes real Quantex lifecycle commands for the selected agents.
- Cover preinstalled-agent adoption and Quantex standalone-binary self lifecycle checks in the default isolated smoke set.
- Add a dedicated GitHub Actions workflow for Modal-backed sandbox tests instead of expanding the merge-gating `ci.yml` workflow.
- Document prerequisites, scope, and troubleshooting for the isolation test layer in maintainer-facing docs.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `code-quality-tooling`: Add the optional Docker- and Modal-backed isolation validation contracts and their contributor guidance.

## Impact

- Affected code: `package.json`, `.github/workflows/`, `scripts/`, `src/testing/`, and `test/`.
- Affected docs: `README.md` maintainer guidance and `docs/runbooks/`.
- Affected contract: `openspec/specs/code-quality-tooling/spec.md`.
