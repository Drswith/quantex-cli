## Context

`astral-sh/setup-uv` defaults `enable-cache` to `auto`, which enables persistence on GitHub-hosted runners. Its default dependency glob searches Python manifests such as `pyproject.toml` and `uv.lock`, but Quantex has no repository-owned Python dependency manifest because uv is used only to exercise external agent installers. The resulting cache key ends in `no-dependency-glob`, is shared by uv-backed matrix entries, and produces one warning per job.

## Goals / Non-Goals

**Goals:**

- Keep uv toolchain setup available for OpenHands, Vibe, and future uv-backed canaries.
- Prevent persistent uv package caches that cannot be invalidated by a checked-in dependency definition.
- Make the no-cache choice explicit and regression-tested instead of suppressing the annotation.

**Non-Goals:**

- Change agent selection, catalog metadata, lifecycle assertions, or uninstall behavior.
- Pin or change the uv version resolved by the existing setup action.
- Disable Quantex's separate Bun runtime and dependency caches.

## Decisions

### Explicitly disable the setup-uv package cache

Pass `enable-cache: false` to the existing SHA-pinned `setup-uv` step. The action still installs uv and adds it to `PATH`; only persistence of uv's package cache is disabled.

Setting `ignore-nothing-to-cache: true` was rejected because it would hide the warning while retaining the same non-invalidating cache. Supplying a Quantex source file as `cache-dependency-glob` was also rejected because repository changes cannot represent an upstream agent's mutable dependency graph.

### Lock the workflow intent with a focused source regression

Extend the existing workflow-classification test to require the pinned setup action and its explicit `enable-cache: false` input. This makes a future action upgrade or YAML cleanup fail locally if it silently restores the hosted-runner default.

## Risks / Trade-offs

- [Risk] OpenHands and Vibe may download more Python artifacts on each isolated run. → Accept the bounded runtime cost because these are advisory disposable canaries whose purpose is to validate a fresh external lifecycle.
- [Risk] The action's input contract could change in a future upgrade. → The action remains SHA-pinned and workflow/actionlint validation will expose an intentional upgrade boundary.

## Migration Plan

Merge the workflow input and regression together, then verify the pull-request canary and a manually dispatched full run. Rollback is the removal of the explicit input, which would restore the current warning-producing cache behavior.

## Open Questions

None.
