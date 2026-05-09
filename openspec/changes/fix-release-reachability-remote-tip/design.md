## Context

The release-target resolver is a Bun script that must run before the workflow knows whether it will publish, create a Release PR, or skip. The first implementation only installed Bun after a successful publish path had already started, so fresh runners failed before resolution. The resolver also filters GitHub Actions runs whose `head_sha` must be an ancestor of the branch tip. That first implementation used `HEAD` after a `git fetch` that only moved `refs/remotes/origin/<branch>`, so `HEAD` could lag the remote tip.

## Decision

Bootstrap Bun immediately after checking out the protected branch source so every subsequent resolver, validation, and publish step shares the same runtime installation.

Compare each candidate `head_sha` to `origin/<protected_branch>` via `git rev-parse` and `git merge-base --is-ancestor`, with fallback to `HEAD` if the remote ref is absent.

## Workflow

After fetch, run `git reset --hard origin/<branch>` so the checked-out branch matches the reconciled remote tip for any subsequent git operations in the job.
