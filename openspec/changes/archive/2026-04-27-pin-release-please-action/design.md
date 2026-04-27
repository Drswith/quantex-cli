# Design

## Decision

Use an explicit `googleapis/release-please-action@v4.1.5` tag in the Release workflow, and run release-please in separate phases:

- Release-relevant product merges run the Release PR phase with `skip-github-release: true`.
- Release PR merges run the GitHub Release phase with `skip-github-pull-request: true`.

## Rationale

The `@v4` major tag floated to release-please 17.3.0 in the GitHub Action runtime. That version fails on this repository when querying commit history with nested associated pull requests through GitHub GraphQL. A local dry run with the same repository and token reproduced the failure.

The `release-please@16.18.0 release-pr` dry run completed successfully and produced the expected `0.4.0` Release PR plan. The corresponding action tag is `googleapis/release-please-action@v4.1.5`.

However, the GitHub Action's default mode runs both release and pull-request logic in one invocation, and that path still hits the GraphQL failure. Splitting the workflow into explicit phases makes the Action follow the same successful `release-pr` path for feature merges and reserves GitHub Release creation for `chore: release ...` commits.

## Alternatives Considered

- Keep `@v4` and retry failed runs: rejected because repeated retries and local reproduction showed the failure is deterministic for the current latest package.
- Replace release-please immediately: rejected because the current flow is otherwise aligned with source-visible version PRs, and a smaller phased release-please fix should unblock release closure.
- Build a custom Release PR generator: rejected because it would reintroduce bespoke release automation without first exhausting the standard tool path.

## Follow-up

Revisit the pin only after a dry run against a newer release-please action confirms it can prepare a Release PR for this repository.
