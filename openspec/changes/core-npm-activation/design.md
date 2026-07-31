## Context

The repository currently validates a private, provisional `@quantex/core` workspace in the same version train as `quantex-cli`. The final unscoped npm identity `quantex-core@0.0.0` has now been bootstrapped and configured with an npm GitHub Actions trusted publisher. The existing `release.yml` intentionally owns only the CLI npm package, GitHub Release, and binaries.

## Goals / Non-Goals

**Goals:**

- Publish `quantex-core` independently with least-privilege OIDC and deterministic recovery.
- Retain packed Node.js, Bun, and TypeScript consumer verification before publication.
- Keep CLI runtime bundling and CLI release recovery independent from Core registry availability.

**Non-Goals:**

- Do not add another release-please configuration, automatic publish trigger, GitHub Release, or binary artifact for Core.
- Do not make Core the CLI's default lifecycle engine or add SDK methods.
- Do not require Core publication for any CLI release.

## Decisions

### Core has a separate version line and release workflow

`quantex-core@0.0.0` is a bootstrap reservation; this change promotes the verified API as `0.1.0`. The root uses an exact development-only Core dependency matching the workspace version, but the root CLI's own version remains independent. This keeps local build resolution reproducible without adding a published CLI runtime dependency.

`release-core.yml` is manually dispatched for `main`. It derives the version from `packages/core/package.json`, creates or reuses `core-v<version>` as the immutable source, runs Core-specific build and packed-consumer validation, then verifies/publishes only `quantex-core@<version>`. A retry checks npm first and reuses the tag; it never invokes the CLI resolver, release-please, GitHub Release creation, or binary upload.

### OIDC trust is scoped to the Core workflow

The npm trusted publisher for `quantex-core` names `Drswith/quantex-cli` and the filename `release-core.yml`. The workflow has `id-token: write` and no long-lived npm token. It selects only ordinary npm publish, not staged publish.

### Public name replaces the provisional identity everywhere

All supported SDK imports, TypeScript path aliases, packed-consumer fixtures, and documentation use `quantex-core`. The existing internal subpath remains unsupported.

## Risks / Trade-offs

- [A Core release fails after the tag exists] → retries reuse the same tag and run npm exact-version inspection before publishing.
- [A Core publish fails] → CLI releases stay unaffected because no CLI workflow reads Core registry state.
- [A version is manually reused] → the workflow rejects a tag that points elsewhere and skips only an exact existing npm version.
- [OIDC is misconfigured] → the publish step fails before registry mutation; no token fallback is added.

## Migration Plan

1. Merge the package-name/version, validation, documentation, and independent workflow change.
2. Dispatch `Release Core` for `main` to publish `quantex-core@0.1.0`.
3. Verify the registry package and package tag. CLI releases continue through `release.yml` unchanged.
4. Roll back consumers by pinning the prior Core version; Core publication never requires rolling back CLI.
