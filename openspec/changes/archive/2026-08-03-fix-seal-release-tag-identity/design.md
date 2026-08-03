## Context

`Seal Release` validates a protected-branch release commit and then creates an annotated `v<version>` tag. Fresh GitHub Actions runners do not provide a usable Git committer identity, so `git tag --annotate` fails before the immutable tag can be pushed. The independent Core release workflow already solves the same constraint with a repository-local `github-actions[bot]` identity.

The publication job intentionally downloads the exact candidate without checking out source. That preserves artifact integrity, but `gh release` cannot infer a repository from `.git`; without `GH_REPO`, draft Release creation fails before assets or npm publication.

## Goals / Non-Goals

**Goals:**

- Make annotated release-tag creation deterministic on a fresh runner.
- Make checkout-free GitHub Release operations address the current repository deterministically.
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
- Set `GH_REPO` once at publish-job scope so every current and future `gh release` command uses `${{ github.repository }}` without adding a source checkout. Passing `--repo` to every command was rejected because it is repetitive and easier to omit during recovery changes.

## Risks / Trade-offs

- [Risk] A future refactor could move tag creation ahead of identity setup. → The regression test checks textual ordering.
- [Risk] A future publish step could invoke `gh` without its own token. → `GH_REPO` only selects the repository; existing step-scoped `GH_TOKEN` ownership remains unchanged.
- [Risk] The workflow fix changes `main` after the pending release commit. → Prepare and re-author the 1.8.0 Release PR again so the exact sealed head remains a governed release commit.

## Migration Plan

Merge the workflow fixes and publish a new patch candidate whose immutable tag contains the corrected workflow. The already-created `v1.8.0` tag remains immutable and unpublished; prepare and re-author the `1.8.1` Release PR, merge after checks, then rerun protected-branch CI and Seal Release. Never move a release tag.

## Open Questions

None.
