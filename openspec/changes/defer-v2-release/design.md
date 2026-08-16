## Context

`v1.10.0` is the latest published release. The desktop client feature and its removal both landed after that tag, so the net published CLI boundary remains CLI-only. The removal commit was intentionally a history-preserving revert, but its `revert!:` title is interpreted by Release Please as a major release signal. As long as that commit remains after the latest release boundary, Release Please calculates `2.0.0` again on every `main` push.

The repository already has a generic major-version review check. That check keeps an undeclared major PR unmergeable, but it does not prevent the PR from being created and it treats a body-level `Release-As` declaration as sufficient approval. The v2 requirement is stronger: the refactor must merge and stabilize for at least 90 days before stable v2 can become eligible.

## Goals / Non-Goals

**Goals:**

- Stop automatic recreation of the ineligible `2.0.0` Release PR.
- Make stable v2 deny-by-default at Release PR, tag, and publication boundaries.
- Keep the readiness reason and the future removal requirement consistent across those boundaries.
- Preserve protected `main` history and the published `v1.10.0` identity.

**Non-Goals:**

- Do not define or implement the future v2 refactor.
- Do not infer a stabilization start date before the required refactor is identified and merged.
- Do not publish a replacement 1.x release as part of this gate change.
- Do not create, move, or delete tags, GitHub Releases, npm versions, or release assets.
- Do not establish a supported prerelease channel.

## Decisions

- Use the Release Please action's native `skip-github-pull-request` input while the gate is active. This prevents creation and update of Release PRs instead of generating an intentionally failing PR on every push.
- Keep the workflow running on `main` pushes. Its independent tag-recovery job must still be able to finish an already merged eligible 1.x Release PR.
- Centralize stable-v2 eligibility in one release-readiness module and reuse it from Release PR validation, tag planning, and publication identity validation.
- Reject stable `2.x` even when a maintainer adds `Release-As: 2.x.y`; generic major approval is necessary for future majors but is not evidence that this temporary readiness gate has been satisfied.
- Scope the temporary gate to stable `2.x`. The repository still has no supported prerelease channel; the existing prerelease-to-`beta` mapping remains only a defensive publication mapping.
- Lift the gate only through a future reviewed OpenSpec change that records the actual refactor merge evidence and proves at least 90 elapsed days. There is no automatic calendar unlock.

## Risks / Trade-offs

- [Release Please cannot prepare an ordinary 1.x hotfix while PR creation is paused] -> A required 1.x release must first use a reviewed OpenSpec change to define a safe one-shot preparation path; do not bypass the v2 gate by hand-editing version files.
- [A maintainer could remove only the workflow skip] -> Independent PR, tag, and publication checks continue to deny stable v2.
- [A maintainer could bypass the generated Release PR] -> Tag planning and publication identity validation fail before tag mutation or candidate build respectively.
- [The same policy could drift across call sites] -> All three enforcement points import the same readiness predicate and message.

## Migration Plan

1. Confirm all generated `2.0.0` Release PRs are closed and no `v2.0.0` tag or public release exists.
2. Merge the temporary preparation pause and the shared v2 readiness checks.
3. Verify the merge-triggered Release Please run does not create or reopen a `2.0.0` PR.
4. After the required refactor has merged and stabilized for at least 90 days, deliver a new reviewed OpenSpec change that records the evidence and removes or replaces every temporary gate together.
