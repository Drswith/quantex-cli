# Design

## Decision

Use an explicit `googleapis/release-please-action@v4.1.5` tag in the Release workflow.

## Rationale

The `@v4` major tag floated to release-please 17.3.0 in the GitHub Action runtime. That version fails on this repository when querying commit history with nested associated pull requests through GitHub GraphQL. A local dry run with the same repository and token reproduced the failure.

The `release-please@16.18.0` dry run completed successfully and produced the expected `0.4.0` Release PR plan. The corresponding action tag is `googleapis/release-please-action@v4.1.5`, so pinning the action restores deterministic release behavior while keeping the release-please Release PR model.

## Alternatives Considered

- Keep `@v4` and retry failed runs: rejected because repeated retries and local reproduction showed the failure is deterministic for the current latest package.
- Replace release-please immediately: rejected because the current flow is otherwise aligned with source-visible version PRs, and a smaller pinned-version fix is enough to unblock release closure.
- Build a custom Release PR generator: rejected because it would reintroduce bespoke release automation without first exhausting the standard tool path.

## Follow-up

Revisit the pin only after a dry run against a newer release-please action confirms it can prepare a Release PR for this repository.
