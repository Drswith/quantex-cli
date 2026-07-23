## Context

PR #500 introduced coordinated Core+CLI release publication and a hard Core npm bootstrap gate. Release Please still creates the public GitHub Release before that gate runs. On the first Core-era publish (`v1.2.0`), bootstrap was incomplete, the gate failed, and artifact upload was skipped. GitHub `releases/latest` therefore points at an empty release, which breaks stable binary self-upgrade manifest discovery.

## Goals / Non-Goals

**Goals:**

- Fail closed on incomplete Core bootstrap before any public GitHub Release create/refresh when `core_required` is true.
- Preserve Core-before-CLI npm publish ordering and artifact upload after npm closure.
- Keep recovery possible after maintainers complete the one-time Core bootstrap and rerun Release.

**Non-Goals:**

- Do not delete or rewrite the already-published empty `v1.2.0` GitHub Release from CI (maintainer owns live recovery).
- Do not change binary self-upgrade client URL strategy in this slice.
- Do not bypass or weaken the Core bootstrap requirement to unblock CLI-only publication.
- Do not archive the active `simplify-lifecycle-core-sdk` umbrella change.

## Decisions

### Decision: run a self-contained early Core bootstrap gate after checking out the release commit and before Release Please GitHub Release

Move the bootstrap validation earlier than GitHub Release creation. The early step reads `core_required`, `CORE_NPM_TRUSTED_PUBLISHING_READY`, and registry existence for `@quantex/core` directly, instead of depending on the later full npm publication-state resolver that currently sits after build.

Why this over uploading binaries even when Core bootstrap fails:

- Specs and docs require repository npm closure before artifact upload; attaching binaries to an unfinished Core-era release would advertise a half-closed release train.

Why this over draft GitHub Releases:

- Release Please's current publish path creates a normal release; switching to drafts is a wider workflow redesign than needed to stop empty `latest` advertisements when bootstrap is known-incomplete.

### Decision: keep the later publish/verify/upload sequence unchanged after a successful early gate

Once bootstrap passes, create the GitHub Release, then build, publish/verify Core then CLI, and upload artifacts last. Idempotent recovery for an already-created empty release remains: after maintainer bootstrap, a rerun can publish packages and upload assets to the existing tag.

## Risks / Trade-offs

- [Risk] Live `v1.2.0` stays empty until maintainer action → Mitigation: document remaining owner clearly; recovery path already selects the release commit when npm packages are missing.
- [Risk] Early gate needs Node/npm for registry inspection before full install → Mitigation: reuse `actions/setup-node` with the npm registry URL before the gate; no repository install is required for `npm view`.
- [Risk] Overlap with active umbrella release-workflow delta → Mitigation: keep this change narrowly additive about GitHub Release ordering; do not archive or rewrite the umbrella milestone set.

## Migration Plan

1. Land the workflow ordering fix on `main`.
2. Maintainer completes Core npm bootstrap per `docs/releases.md` and sets `CORE_NPM_TRUSTED_PUBLISHING_READY=true`.
3. Rerun Release to publish `@quantex/core@1.2.0`, `quantex-cli@1.2.0`, and upload binaries onto `v1.2.0`.
4. Archive this change after merge and spec sync.

## Open Questions

- None for this narrow slice.
