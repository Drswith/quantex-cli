## Context

Release automation is intentionally driven by the final commit metadata that lands on `main` or `beta`. Because PRs are squash-merged, the PR title is effectively the release trigger unless the merge subject is overridden.

## Goals / Non-Goals

**Goals:**

- Catch product-impacting PRs whose title would not trigger release automation.
- Preserve an explicit escape hatch for product-adjacent changes that are not release-worthy.
- Keep Release PR automation compatible with PR Governance.

**Non-Goals:**

- Change release-please versioning rules.
- Infer exact SemVer level from file paths.
- Block docs/process-only changes from using non-release metadata.

## Decisions

- Use changed-file paths to detect product-impacting PRs.
  - Alternative considered: inspect source diffs semantically. Rejected because it is brittle and harder to maintain in GitHub Actions.
- Require an explicit `## Release Intent` section in all PR bodies.
  - Alternative considered: infer intent from `Scope Check`. Rejected because release intent is important enough to deserve a dedicated, searchable section.
- Allow `Release: not applicable - <reason>` as an override for product-impacting non-release PRs.
  - Alternative considered: require release-worthy titles for every product-impacting file. Rejected because some product-path edits can be test-only, refactors with no shipped behavior, or release-maintenance work.
- Skip the product-impacting release-intent check for release-please branches.
  - Alternative considered: force Release PRs through the same check. Rejected because Release PRs have their own dedicated scope validator.

## Risks / Trade-offs

- File-path detection may be conservative -> Mitigation: provide an explicit not-applicable escape hatch with a reason.
- Contributors may write vague no-release reasons -> Mitigation: reject empty or placeholder no-release values.
