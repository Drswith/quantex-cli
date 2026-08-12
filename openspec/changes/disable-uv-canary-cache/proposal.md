## Why

The uv-backed real-agent canaries currently inherit `setup-uv`'s hosted-runner cache default even though this Bun repository has no Python dependency manifest that can invalidate that cache. OpenHands and Vibe therefore restore a shared `no-dependency-glob` cache and emit warnings, weakening the freshness and clarity of the disposable lifecycle signal.

## What Changes

- Disable the persisted uv package cache in the real-agent canary workflow while continuing to install uv and run the selected agent lifecycle.
- Add workflow regression coverage that rejects an implicitly enabled uv dependency cache.
- Record that a disposable real-agent canary without a repository-owned dependency manifest must not persist the tested provider's package cache.
- Keep agent selection, uv version resolution, lifecycle assertions, and the advisory workflow boundary unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-canary-validation`: require uv-backed disposable canaries to avoid a persisted dependency cache when no checked-in dependency manifest can invalidate it.

## Impact

- `.github/workflows/agent-canary.yml`
- `test/workflow-classification.test.ts`
- `openspec/specs/agent-canary-validation/spec.md` through this change's delta
- GitHub-hosted OpenHands and Vibe canary setup time and annotations; no CLI, catalog, or release behavior changes

Work-intake classification: durable GitHub Actions workflow and cache behavior, so OpenSpec is required before implementation.
