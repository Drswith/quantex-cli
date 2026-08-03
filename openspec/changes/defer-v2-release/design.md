## Context

`2.0.0` is an unsealed source candidate on `main`. The public release surfaces remain at `1.7.1`, but release-please will reproduce the v2 proposal because the breaking source history remains reachable. The release PR validator and the seal contract are the two independent enforcement points before a public release.

## Goals / Non-Goals

**Goals:**

- Restore the source-controlled version to the last published release.
- Make v2 ineligible until a future reviewed OpenSpec change confirms the required refactor and its 90-day stabilization window.
- Reject both release-please PR merge and direct sealing if the readiness contract is absent or invalid.

**Non-Goals:**

- Do not define or implement the future refactor.
- Do not create, move, or delete any release tag, GitHub Release, npm version, or binary asset.
- Do not change ordinary 1.x or beta release planning.

## Decisions

- Use a deny-by-default v2 gate. This avoids treating a calendar date chosen today as evidence of a refactor.
- Require the future owner to remove the gate only through a reviewed OpenSpec change after documenting the actual refactor and 90-day evidence.
- Reuse the Release PR policy and seal contract for enforcement. The first blocks merging a generated v2 candidate; the second blocks manual workflow dispatch if source state is somehow advanced outside the usual PR path.

## Risks / Trade-offs

- [A future refactor may need a different completion marker] -> The future owner can supply the exact refactor commit in the reviewed readiness record; no current commit is assumed to qualify.
- [A maintainer could remove the gate in a later PR] -> The gate, readiness record, policy tests, and OpenSpec contract are all reviewable protected-branch artifacts.
- [The emergency revert changes source version history] -> The revert occurs only before sealing; no public v2 identity exists to migrate.

## Migration Plan

1. Revert the unsealed 2.0.0 release candidate to 1.7.1.
2. Merge the deny-by-default v2 readiness gate after all checks pass.
3. After the real refactor is merged and has stabilized for 90 days, create a reviewed OpenSpec change that documents the evidence and removes the temporary gate.
4. Prepare, merge, seal, and publish v2 only after the gate accepts the record.
