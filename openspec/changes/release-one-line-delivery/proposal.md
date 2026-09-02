## Why

Delivery simplification step 4 collapses the self-biting release state machine into a single forward path. Today a branch can be "sealed" (and therefore eligible for the next Release PR) as soon as the version tag exists, while `release.yml` is still building, verifying, and publishing that version — so preparation can race ahead of a release that has not finished. Separately, `verify-installers` runs against the already-public GitHub Release and npm package; a smoke failure cannot roll back an immutable npm publish. Steps 1–3 already reduced advisory noise and Release PR governance friction; this step removes the two remaining release-order failure modes without inventing a new versioning scheme or touching Core dual-publish.

## What Changes

- Treat a branch as sealed only when the manifest version's tag exists **and** that tag's `Release` workflow has succeeded, so release-please cannot prepare the next version against an unfinished current release.
- Re-trigger Release Please preparation after a successful `Release` run (in addition to pushes to `main`) so the next Release PR is prepared once publication actually completes, without waiting for an unrelated follow-up push.
- Move `verify-installers` ahead of npm publish: smoke the documented installers against the uploaded release-candidate artifact (via a local download base) before the package becomes public.
- Keep `qtx` / `quantex` v1 publish behavior: GitHub Release + npm for the CLI, same versioning.
- Update the release runbook, releases overview, OpenSpec `release-workflow` contract, and a short ADR note so the documented order matches the enforced order.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `release-workflow`: Seal means tag + successful Release workflow; installer smoke is a pre-npm candidate gate rather than a post-public gate; Release Please may resume preparation after Release success.

## Impact

- `.github/workflows/release-please.yml`, `.github/workflows/release.yml`
- `scripts/release/tag-release.ts`, `scripts/release/release-seal-contract.ts`
- `install.sh`, `install.ps1` (optional `QUANTEX_DOWNLOAD_BASE` for candidate smoke only)
- `test/tag-release.test.ts`, `test/release-target-resolution.test.ts`, `test/workflow-classification.test.ts`, installer script tests
- `docs/runbooks/releasing-quantex.md`, `docs/releases.md`, `docs/adr/0009-workflow-v2.md`
- `openspec/specs/release-workflow/spec.md` (via this change's delta)

## Non-Goals

- Delivery simplification steps 5–6 (Core independent publish freeze; OpenSpec/memory lint gates).
- Dual Core publishing, new versioning, catalog/product features, Windows/canary/sandbox policy beyond what installer smoke already covers.

## Intake classification

Non-trivial release-contract / durable workflow change; OpenSpec required.
