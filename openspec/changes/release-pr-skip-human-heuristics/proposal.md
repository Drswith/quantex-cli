# Proposal: release-pr-skip-human-heuristics

## Why

Automated Release Please PRs repeatedly fail the shared `governance` job because human PR heuristics (`pr:body:check`, `ci:commit-policy`) treat generated release text as ordinary contributor text. Delivery simplification step 3 keeps the dedicated Release PR validator while stopping those human-oriented heuristics from blocking automated release PRs.

## What Changes

- On `release-please--branches--*` pull requests, `.github/workflows/ci.yml` `governance` continues to run `ci:release-pr-policy` (and its base-version setup).
- On those same branches, `governance` skips `pr:body:check` and `ci:commit-policy` so human PR-body / commit-policy heuristics cannot fail the job.
- Human (non-release-please) pull requests keep the current body, commit-policy, and Release-As verification checks unchanged.
- Document the human-vs-release governance split in workflow comments and align living contracts, docs, and workflow classification tests.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `release-workflow`: Automated Release PRs are governed only by the dedicated Release PR validator in merge-gating CI; human body/commit heuristics and Release-As verification remain for non-release-please PRs.
- `code-quality-tooling`: The consolidated `governance` job routes release-please heads to release-PR policy and skips human PR body/commit policy steps for those heads.

## Impact

- `.github/workflows/ci.yml`
- `test/pr-governance.test.ts`, `test/commit-policy.test.ts`, and related workflow contract coverage
- `docs/runbooks/releasing-quantex.md`, `docs/github-collaboration.md`
- `docs/adr/0009-workflow-v2.md` (short amendment note)
- `openspec/specs/{release-workflow,code-quality-tooling}/spec.md` (via this change's deltas)

No CLI behavior, catalog, Windows/canary/sandbox, release-pipeline collapse, Core publishing, or OpenSpec/memory lint-gate changes (steps 4–6 stay out of scope).

## Intake classification

Durable GitHub Actions / release-PR governance process contract change; OpenSpec required.
