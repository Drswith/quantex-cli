## 1. Managed Package Boundary

- [x] 1.1 Exclude standalone release binaries under `dist/bin` from the published npm package while keeping the runtime CLI files publishable.
- [x] 1.2 Add a regression check or automated test that validates the actual packed tarball does not contain `dist/bin` entries.

## 2. Maintainer Guidance

- [x] 2.1 Update release/debug runbooks to document how to validate managed-install package contents when `build:bin` has also been run locally.

## 3. Validation

- [x] 3.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`.
- [x] 3.2 Run a pack verification command that proves the npm tarball excludes `dist/bin`.
