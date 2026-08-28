## Why

`Release Please` prepares the next Release PR before the current release is sealed, and on 2026-08-28 that produced a Release PR proposing to release `1.11.0` *after* `1.11.1` had already been released ([#677](https://github.com/Drswith/quantex-cli/pull/677)).

The workflow runs `release-please` first and the `tag-release` sealing job second. Because `skip-github-release: true` means release-please never tags, the tag for the version recorded in `.release-please-manifest.json` does not exist while release-please is running on the push that merged that release. Release-please resolves its release boundary by matching the manifest version against GitHub Releases and then, as a fallback, against git tags; with `v1.11.1` published by neither, both lookups miss:

```text
⚠ Expected 1 releases, only found 0
❯ looking for tagName: v1.11.1
✔ No latest release found for path: ., but a previous version (1.11.1) was specified in the manifest.
❯ Set(0) {}
```

With no boundary SHA, `commitsAfterSha(commits, undefined)` returns the whole history — `Considering: 554 commits`, capped by the 500-commit search depth. That range still contains the one-shot `Release-As: 1.11.0` footers from the 1.11.0 boundary work, which are a hard version assignment, so release-please concluded `updating from 1.11.1 to 1.11.0` and rewrote the Release PR to move the manifest *backwards* and replay the entire project changelog. The tag it had been looking for was pushed by `tag-release` 3 minutes and 21 seconds later, in the same run.

Nothing shipped: `release-pr-policy` rejected the PR with `Release PR version "1.11.0" must be greater than the current main version "1.11.1"`. But the guard is the last line rather than the contract, and every release reaches that guard the same way.

Work-intake classification: durable release-process contract. That requires an OpenSpec change before edits.

## What Changes

- Reverse the job order in `release-please.yml`: `tag-release` runs first, and `release-please` gains `needs: tag-release`. Sealing the release that just merged is a precondition for preparing the next one, not a follow-up to it.
- Add a `sealed` output to `tag-release`, resolved from the branch tip rather than the pushed commit: true when the tag for `main`'s current manifest version exists. `release-please` runs only when that output is `true`.
- The branch-tip reading is what makes the reversal sufficient. Two pushes 12 seconds apart produce two serialized runs, and the first run's checkout predates the release commit; without reading the tip, that run would seal `v1.11.0`, then hand release-please a `main` whose manifest already says `1.11.1`, and reproduce the defect from the other side.
- Record the precondition in the `release-workflow` contract so a later edit cannot reorder the jobs back without failing spec validation.

**Not changing** (deliberately):

- `skip-github-release: true` stays. Handing tagging back to release-please would make the boundary self-consistent, but it would also bypass the seal contract — `tag-release` waits for protected-branch push CI on the release commit before tagging, which is the gate that makes a tag mean "validated".
- No change to how `Release-As` is parsed or verified. `release:verify-release-as` already checks a declared override at merge time; the defect is that a *settled* override re-entered scope, which the boundary fix removes.
- No change to `release.yml`, publication, or the dispatch path.
- The `release-pr-policy` monotonic-version guard stays exactly as is. It caught this and remains the backstop for anything the boundary fix does not anticipate.

## Capabilities

### Modified Capabilities

- `release-workflow`: release-please preparation gains an explicit precondition — the current manifest version must already be tagged — and the `tag-release` job moves from after release-please to before it.

## Impact

- `.github/workflows/release-please.yml`: job order and the `needs`/`if` wiring.
- `scripts/release/tag-release.ts`: resolve and emit the seal state from the branch tip.
- `test/release/tag-release.test.ts`: coverage for the seal-state resolution.
- `test/workflow-classification.test.ts`: the workflow shape assertions that pin job order.
- No runtime, CLI surface, or published artifact is affected.
