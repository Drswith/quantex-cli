## Context

`Seal Release` validates a protected-branch release commit and then creates an annotated `v<version>` tag. Fresh GitHub Actions runners do not provide a usable Git committer identity, so `git tag --annotate` fails before the immutable tag can be pushed. The independent Core release workflow already solves the same constraint with a repository-local `github-actions[bot]` identity.

## Goals / Non-Goals

**Goals:**

- Make annotated release-tag creation deterministic on a fresh runner.
- Reuse the established bot identity used by Core publication.
- Lock ordering with a narrow workflow regression test.

**Non-Goals:**

- Change version selection, release commit validation, tag naming, or publication credentials.
- Move, replace, or overwrite an existing tag.
- Change CLI or package behavior.

## Decisions

- Configure `user.name` and `user.email` locally in the checkout immediately before the create-or-verify tag logic. Repository-local configuration limits scope to the workflow checkout and avoids dependence on runner image defaults.
- Use `github-actions[bot]` and its public noreply address, matching `Release Core`, instead of introducing another release identity.
- Test both required configuration lines and assert they occur before annotated tag creation. A generic YAML parse test would not catch the missing runtime prerequisite.

## Risks / Trade-offs

- [Risk] A future refactor could move tag creation ahead of identity setup. → The regression test checks textual ordering.
- [Risk] The workflow fix changes `main` after the pending release commit. → Prepare and re-author the 1.8.0 Release PR again so the exact sealed head remains a governed release commit.

## Migration Plan

Merge the workflow fix, regenerate the 1.8.0 Release PR, re-author it as one maintainer commit, merge after checks, then rerun protected-branch CI and Seal Release. If sealing fails before tag creation, fix and retry; never move a release tag.

## Open Questions

None.
