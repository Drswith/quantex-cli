## Why

Work-intake classification: this change adds maintainer-facing sandbox validation coverage for Quantex self-upgrade behavior, so it modifies a durable workflow contract and requires OpenSpec before implementation.

Recent self-upgrade regressions did not come from one isolated function; they came from the full managed-upgrade chain across package-manager install source detection, registry selection, version resolution, command execution, and post-install verification. The existing sandbox layer only covers standalone-binary self inspection, so Bun-managed self-upgrade bugs can still escape until contributors reproduce them manually.

## What Changes

- Extend the optional lifecycle smoke layer with a managed self-upgrade scenario that runs Quantex from an isolated Bun global install.
- Build a local sandbox-only npm-style registry from repository tarballs so the self-upgrade scenario can seed an older Quantex package version and upgrade it to the current checkout version without depending on public registry timing.
- Make the managed self-upgrade scenario part of the default isolated smoke scenario list so both `bun run test:container` and `bun run test:sandbox` exercise it unless maintainers narrow the scenario set explicitly.
- Update maintainer runbooks to describe the new self-upgrade isolation scenario and how to run it directly while debugging self-upgrade regressions.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `code-quality-tooling`: The optional Docker- and Modal-backed isolation workflow now includes Bun-managed self-upgrade coverage in addition to the existing agent lifecycle and standalone-binary checks.

## Impact

- Affected code: `scripts/lifecycle-smoke.ts`.
- Affected docs: `docs/runbooks/modal-sandbox-testing.md`, `docs/runbooks/release-and-self-upgrade-debugging.md`.
- Affected contract: `openspec/specs/code-quality-tooling/spec.md`.
