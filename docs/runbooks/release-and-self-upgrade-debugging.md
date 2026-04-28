# Runbook: Release And Self-Upgrade Debugging

## Purpose

Provide a repeatable path for debugging Quantex release artifacts, release metadata, and self-upgrade behavior without rediscovering the release pipeline from source code.

## When to use

- `quantex upgrade` failed and the failure might be in release metadata, download, checksum, verify, or install-source detection
- a release build completed but you are not sure whether the publishable binary for the current platform is actually runnable
- `manifest.json` or `SHA256SUMS.txt` looks suspicious or out of sync with built binaries
- you need to validate a release candidate locally before trusting the GitHub workflow

## Inputs

- `bun run build`
- `bun run build:bin`
- `bun run release:artifacts`
- `bun run release:smoke`
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
3. Verify metadata consistency.
4. Smoke-check the current runner binary.
5. Only then debug deeper provider or replacement behavior.

Why this order:

- `upgrade --check` and `doctor` tell you whether the problem is visible from the user surface
- local rebuilds separate release-pipeline bugs from machine-specific state
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
- any recovery hint shown by `doctor`

Interpretation:

- if `installSource` is `source`, Quantex will not auto-upgrade and the issue is not in release artifacts
- if `installSource` is `bun` or `npm`, first verify package-manager state before debugging binary release logic
- if `installSource` is `binary`, continue with artifact and smoke validation

### 2. Rebuild the local release outputs from scratch

Run:

```bash
bun run build
bun run build:bin
bun run release:artifacts
```

Expected outputs:

- platform binaries under `dist/bin/`
- `dist/bin/SHA256SUMS.txt`
- `dist/bin/manifest.json`

If this fails:

- `build:bin` failure usually means the compiled release targets are broken
- `release:artifacts` failure usually means checksum or manifest generation assumptions no longer match produced files

### 3. Inspect manifest and checksum consistency

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

### 4. Smoke-check the current runner binary

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

### 5. Debug binary self-upgrade replacement behavior

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

### 6. Debug install-source detection and state drift

If the wrong provider is chosen, inspect install-source detection before touching release code.

Relevant code paths:

- `src/self/index.ts`
- `src/self/install-state.ts`
- `src/state/index.ts`

Useful checks:

- whether `state.self.installSource` exists and matches reality
- whether Quantex is running from a package-manager install, source checkout, or standalone binary
- whether postinstall wrote package-manager install source correctly

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
