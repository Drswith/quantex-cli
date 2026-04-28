# Runbook: Release And Self-Upgrade Debugging

## Purpose

Provide a repeatable path for debugging Quantex release artifacts, release metadata, and self-upgrade behavior without rediscovering the release pipeline from source code.

## When to use

- `quantex upgrade` failed and the failure might be in release metadata, download, checksum, verify, or install-source detection
- a release build completed but you are not sure whether the publishable binary for the current platform is actually runnable
- `manifest.json` or `SHA256SUMS.txt` looks suspicious or out of sync with built binaries
- the npm or Bun install package looks much larger than the JS CLI runtime should require
- you need to validate a release candidate locally before trusting the GitHub workflow

## Inputs

- `bun run build`
- `bun run build:bin`
- `bun run release:artifacts`
- `bun run release:smoke`
- `bun run package:check`
- `quantex upgrade --check`
- `quantex doctor`
- `dist/bin/manifest.json`
- `dist/bin/SHA256SUMS.txt`
- `.github/workflows/release-verify.yml`
- `.github/workflows/release.yml`

## Triage order

Prefer this order:

1. Confirm the current self-upgrade view from the CLI.
2. Rebuild the local release artifacts.
3. Verify managed-install package contents.
4. Verify metadata consistency.
5. Smoke-check the current runner binary.
6. Only then debug deeper provider or replacement behavior.

Why this order:

- `upgrade --check` and `doctor` tell you whether the problem is visible from the user surface
- local rebuilds separate release-pipeline bugs from machine-specific state
- package verification catches accidental npm/bun package bloat before you debug release metadata
- metadata validation catches manifest and checksum drift before you inspect binary replacement logic
- smoke validation tells you whether the current platform artifact is actually executable

## Recovery

### 1. Confirm what Quantex thinks about self-upgrade

Run:

```bash
quantex upgrade --check
quantex doctor
```

What to look for:

- `installSource`
- whether `canAutoUpdate` is true
- the reported `latestVersion`
- any warning that the selected registry is behind upstream npm
- any recovery hint shown by `doctor`

Interpretation:

- if `installSource` is `source`, Quantex will not auto-upgrade and the issue is not in release artifacts
- if `installSource` is `bun` or `npm`, first verify package-manager registry state before debugging binary release logic
- if `installSource` is `binary`, continue with artifact and smoke validation

Registry-specific checks for managed installs:

- `qtx upgrade` follows the registry selected for the current Bun/npm self-upgrade path
- `QTX_SELF_UPDATE_REGISTRY` overrides every other managed self-upgrade registry source for the current command environment
- `selfUpdateRegistry` in `~/.quantex/config.json` overrides package-manager defaults without changing your global Bun/npm setup
- a newer version on official npm does not mean that version is installable from your selected mirror yet

### 2. Rebuild the local release outputs from scratch

Run:

```bash
bun run build
bun run build:bin
bun run release:artifacts
bun run package:check
```

Expected outputs:

- platform binaries under `dist/bin/`
- `dist/bin/SHA256SUMS.txt`
- `dist/bin/manifest.json`

If this fails:

- `build:bin` failure usually means the compiled release targets are broken
- `release:artifacts` failure usually means checksum or manifest generation assumptions no longer match produced files

### 3. Verify managed-install package contents

Canonical validator:

```bash
bun run package:check
```

What this should guarantee:

- the npm tarball excludes every `dist/bin/` entry even if standalone release binaries exist locally
- the tarball still contains the runtime CLI files needed by managed installs

Common symptoms and likely causes:

- `dist/bin/...` still appears in the pack output:
  `package.json#files` or another packaging rule started including standalone release artifacts again
- missing `dist/cli.mjs`, `dist/index.mjs`, or `scripts/postinstall.cjs`:
  the packlist was tightened too far and now drops files required by Bun/npm installs

### 4. Inspect manifest and checksum consistency

Canonical validator:

```bash
bun run scripts/verify-release-artifacts.ts
```

What this should guarantee:

- every release binary listed in `manifest.json` exists in `SHA256SUMS.txt`
- every checksum in the manifest matches the checksum file
- asset filenames still match Quantex release naming rules
- the stable release matrix contains all required platform binaries

Common symptoms and likely causes:

- missing checksum entry:
  the build produced a binary that checksum generation or manifest generation did not include
- missing required release asset:
  a target build failed, the filename changed, or stale local outputs hid an incomplete binary matrix
- manifest checksum mismatch:
  artifact contents changed after checksum generation, or the manifest was generated from stale data
- invalid asset name:
  build target naming changed without updating release-artifact parsing

### 5. Smoke-check the current runner binary

Canonical smoke command:

```bash
bun run release:smoke
```

What it validates:

- the current runner asset exists in both `manifest.json` and `SHA256SUMS.txt`
- manifest version matches the injected `BUILD_VERSION`
- the current runner binary executes with `--version`
- the binary reports the expected version string

Current runner mapping:

- macOS arm64 -> `quantex-darwin-arm64`
- macOS x64 -> `quantex-darwin-x64`
- Linux arm64 -> `quantex-linux-arm64`
- Linux x64 -> `quantex-linux-x64`
- Windows x64 -> `quantex-windows-x64.exe`

If smoke fails:

- missing current runner asset means the build targets or manifest generation no longer match workflow expectations
- checksum mismatch means metadata and binary contents drifted
- `--version` execution failure means the produced binary is not publishable even if metadata looks correct

### 6. Debug binary self-upgrade replacement behavior

If metadata and smoke validation are already green, move into runtime replacement debugging.

Relevant code paths:

- `src/self/index.ts`
- `src/self/providers/binary.ts`
- `src/self/release.ts`
- `src/self/binary.ts`
- `src/self/recovery.ts`
- `src/self/lock.ts`

Focus areas:

- release manifest resolution and channel selection
- asset selection for the current platform
- checksum verification
- lock conflicts during self-upgrade
- permission failures replacing the installed binary
- post-replacement `--version` verification
- rollback from `.bak` when verification fails

### 7. Debug install-source detection and state drift

If the wrong provider is chosen, inspect install-source detection before touching release code.

Relevant code paths:

- `src/self/index.ts`
- `src/self/install-state.ts`
- `src/state/index.ts`

Useful checks:

- whether `state.self.installSource` exists and matches reality
- whether Quantex is running from a package-manager install, source checkout, or standalone binary
- whether postinstall wrote package-manager install source correctly

For managed self-upgrade registry mismatches, also check:

- `~/.npmrc` for `registry=...`
- project-local `.npmrc` in the directory where `qtx upgrade` was run
- `bunfig.toml` / `~/.bunfig.toml` if the install source is Bun
- whether `QTX_SELF_UPDATE_REGISTRY` is set in the current shell
- whether `selfUpdateRegistry` is set in `~/.quantex/config.json`

If Quantex warns that upstream npm is newer than the selected registry:

- the selected registry is the authoritative source for whether `qtx upgrade` can install a newer version right now
- wait for the mirror to sync, or point Quantex self-upgrade at a different registry with `QTX_SELF_UPDATE_REGISTRY` or `selfUpdateRegistry`

If Bun reports success but the installed `qtx --version` does not move:

- inspect `~/.bun/install/global/package.json` for the stored `quantex-cli` range
- inspect `~/.bun/install/global/bun.lock` for the resolved version and tarball registry
- prefer the self-upgrade path that re-declares the direct package target with `bun add -g quantex-cli@<tag>` instead of relying on global `bun update`
- npm has a similar range-sensitive `update` behavior; use `npm install -g quantex-cli@<tag>` when the intent is to replace the direct global package target

### 7. Reproduce the CI release verification path locally

The closest local sequence to the release verification workflow is:

```bash
bun install --frozen-lockfile
bun run lint
bun run format:check
bun run typecheck
bun run build
bun run build:bin
bun run release:artifacts
bun run release:smoke
```

This mirrors the key validation stages in:

- `.github/workflows/release-verify.yml`
- `.github/workflows/release.yml`

## Escalation

Stop and ask for human input when:

- the required fix changes release naming, channel semantics, or publish behavior
- a release artifact can be built locally but fails only in GitHub Actions and you need workflow or runner-policy changes
- the current install source is intentionally unusual and recovery would require reinstalling from a different source
- debugging shows a durable policy change rather than an implementation bug; that should be captured in OpenSpec or an ADR

## Related artifacts

- `openspec/specs/self-upgrade/spec.md`
- `docs/adr/0002-keep-self-upgrade-and-agent-update-separate.md`
- `docs/adr/0003-require-explicit-upgrade-invocation.md`
- `openspec/changes/archive/qtx-0020-add-release-workflow-smoke-validation/proposal.md`
- `openspec/changes/archive/qtx-0021-write-release-and-self-upgrade-debugging-runbook/proposal.md`
