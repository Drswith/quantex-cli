# Design: fix-release-tag-automation

## Approach

Follow the idempotent tag-backstop pattern used by other release-please adopters: after each protected-branch push, if the branch head is already a release commit and `v<version>` is missing, cut the tag once push CI has succeeded, then relabel the merged release PR so release-please can proceed on the next cycle.

Quantex keeps `skip-github-release: true` on release-please; `release.yml` remains the sole publish entry on tag push. The backstop only creates the git tag (and relabels); it does not publish npm or GitHub Release assets.

## Tag timing

`release-seal-contract` requires a successful `ci.yml` push run on the exact release commit before publication. The backstop therefore polls GitHub Actions for a successful CI run on the branch head SHA before pushing the tag, reusing the same workflow/branch/event filter as `release-seal-contract.ts`.

## Idempotency

- Not a release commit → no-op.
- Tag already points at branch head → no-op (still relabel if needed).
- Tag exists at a different SHA → fail closed.

## Relabeling

release-please leaves `autorelease: pending` on merged Release PRs when tagging fails. The backstop removes that label and adds `autorelease: tagged` on the most recently merged pending PR for the branch, unblocking subsequent release-please runs.
