## Context

The release workflow builds both the JS package (`bun run build`) and standalone binaries (`bun run build:bin`) before running `npm publish --ignore-scripts`. Because `package.json` currently publishes the whole `dist/` tree, the managed-install tarball includes `dist/bin/manifest.json`, `SHA256SUMS.txt`, and every standalone binary for macOS, Linux, and Windows.

That behavior is not needed for Bun/npm installs. Managed installs execute `dist/cli.mjs`; standalone binaries are distributed separately through GitHub Releases and used by the binary self-upgrade path. The problem is therefore in package distribution boundaries, not in binary compilation itself.

## Goals / Non-Goals

**Goals:**

- Keep the npm package for Bun/npm installs limited to the JS CLI runtime and required install scripts.
- Preserve the existing standalone release binary workflow under `dist/bin` for release metadata, smoke checks, and GitHub Releases.
- Add a regression check that catches package bloat if `dist/bin` is accidentally re-included later.

**Non-Goals:**

- Changing standalone binary filenames, manifest structure, or self-upgrade download behavior
- Reworking the release workflow order or removing `build:bin`
- Optimizing Bun-compiled binary size itself

## Decisions

### Use `package.json` packlist exclusions as the source of truth

The published package should be fixed where npm determines package contents: `package.json#files`. This keeps the release workflow intact while ensuring that even if `dist/bin` exists locally, it is omitted from the tarball shipped to npm and then consumed by `bun add -g` / `npm i -g`.

Alternative considered:

- Move standalone binaries outside `dist/`: works, but creates broader churn across release scripts and docs for no user-facing gain.
- Publish before `build:bin`: avoids the issue in CI, but leaves local `npm pack` and any future workflow changes fragile.

### Verify the packed tarball directly

The regression check should inspect the actual npm pack output instead of only asserting config strings. That makes the validation reflect the real managed-install artifact boundary and catches mistakes in glob semantics.

Alternative considered:

- Test only the `files` array in `package.json`: cheaper, but it would not prove the packlist behaves as intended.

### Keep release-binary docs focused on maintainers

This change does not alter user-facing install commands, so product README updates are unnecessary. The durable knowledge belongs in release/debug runbooks used by maintainers when both publishable package assets and standalone binaries exist in the same working tree.

## Risks / Trade-offs

- [Packlist negation behaves differently than expected] -> Validate with `npm pack --json` in automated checks and local validation.
- [Future release tooling starts depending on `dist/bin` inside the npm tarball] -> Keep the new package-distribution spec explicit so regressions are treated as contract changes.
- [Extra validation makes release checks slightly slower] -> Scope the verification to pack metadata inspection, not full install smoke tests.
