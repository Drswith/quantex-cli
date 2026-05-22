## Why

Work-intake classification: this change modifies the durable sandbox validation workflow, so it requires OpenSpec before implementation.

Quantex now supports uv as a first-class managed agent installer, but the isolated lifecycle smoke layer only has a package-manager-specific fake scenario for Cargo. That leaves uv lifecycle command routing covered by unit tests and CI, but not by the sandbox isolation layer that catches end-to-end lifecycle regressions.

## What Changes

- Add a deterministic `uv-managed` lifecycle smoke scenario to `scripts/lifecycle-smoke.ts`.
- Use a fake `uv` executable inside an ephemeral sandbox bin directory so the smoke validates Quantex command routing, state handling, and lifecycle sequencing without installing real Python tools or hitting the network.
- Include the uv smoke in the default isolation scenario list and in the trusted pull-request sandbox profile.
- Keep real uv package installation, Python installation policy, virtualenv management, and arbitrary `uv run` workflows out of scope.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `code-quality-tooling`: Optional sandbox/container isolation validation covers uv-managed agent lifecycle routing.

## Impact

- Affected code: `scripts/lifecycle-smoke.ts`, `.github/workflows/sandbox-tests.yml`, and related tests.
- Affected docs: `docs/runbooks/modal-sandbox-testing.md`.
- Affected contract: `openspec/specs/code-quality-tooling/spec.md`.
- No new runtime dependency is required.
