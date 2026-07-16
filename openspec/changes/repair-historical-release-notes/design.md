## Context

`v0.29.1` contains the lifecycle-engine delivery range after `v0.29.0`, but release-please rendered only the two `fix` commits. `v1.1.0` was intentionally triggered by a one-shot `Release-As` footer on a `feat(release)!` commit; the generated entry therefore describes a version-line graduation as a breaking feature. The generated `CHANGELOG.md` sections were copied into both published GitHub Release bodies.

## Goals / Non-Goals

**Goals:**

- Make the historical user-visible notes accurately state the scope of the lifecycle refactor and its preserved v1 compatibility boundary.
- Keep the repository changelog and both GitHub Release pages semantically aligned.
- Preserve the original generated commit index for traceability.

**Non-Goals:**

- Changing release-please configuration, commit classification, resolver logic, workflows, tags, package contents, npm publication, or future release-note automation.
- Rewriting published tags or republishing either version.

## Decisions

### Correct both historical surfaces

`CHANGELOG.md` remains the repository source artifact, while GitHub Release bodies are independent published copies. Both are corrected in the same delivery so a user sees the same explanation whether they browse the repository or the Releases page.

### Preserve generated entries and add curated context

The generated `Features`, `Bug Fixes`, and `Breaking Changes` entries remain as a commit index. Curated release summaries clarify that `v0.29.1` delivered the refactor and that `v1.1.0` graduates the release line without intentionally removing maintained v1 external contracts. This corrects meaning without falsifying release history.

### Keep this repair isolated from future automation

This change documents a historical correction only. A future proposal may change how release-please is triggered or how release summaries are generated, but neither is required to repair these two releases.

## Risks / Trade-offs

- [Repository and GitHub notes diverge] -> use identical compatibility language and verify both remote Release bodies after editing.
- [Historical note is mistaken for a tag rewrite] -> state that tags, package versions, binaries, and npm artifacts remain untouched.
- [A docs commit triggers a release] -> use a `docs` commit; the current resolver classifies it as non-release-worthy.

## Migration Plan

1. Add curated context to the two existing changelog sections.
2. Validate the OpenSpec artifacts and documentation diff, then deliver the docs PR.
3. Update the two existing GitHub Release bodies without moving tags or publishing packages.
4. Verify the remote release bodies and repository source agree; archive the OpenSpec change after the implementation PR merges.
