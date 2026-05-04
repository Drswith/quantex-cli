## Overview

CI should reject prohibited `Co-authored-by:` trailers using the same repository-owned pattern already used for PR body policy and release PR policy:

- GitHub Actions gathers event-specific metadata.
- A local repository script evaluates policy.
- Tests cover the script and a lightweight workflow wiring assertion.

## Design

1. Add `scripts/commit-trailer-policy.ts` as the single source of truth for prohibited trailer detection.
2. Feed the script a JSON array of commit objects with `sha` and `message` fields.
3. In `.github/workflows/ci.yml`, collect commits from:
   - `pull_request`: `pulls.listCommits`
   - `push`: `repos.compareCommits`
4. Run the trailer policy inside the required `lint` job so branch protection cannot bypass the result by ignoring a non-required check.

## Rejected Alternatives

- `pre-commit`: cannot inspect the final commit message.
- `pre-push` only: useful as ergonomics, but still locally bypassable and later than necessary.
- A standalone non-required CI job: would not guarantee merge protection while the branch rules only require `lint`, `classify`, and test-matrix checks.
