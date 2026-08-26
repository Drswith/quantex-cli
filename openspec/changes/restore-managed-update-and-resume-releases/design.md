## Context

`d92c7bc` reverted four commits in one operation to remove the macOS desktop client. Three of them were desktop work. The fourth, `bb9dcbf feat(desktop): add macOS managed update client (#557)`, carried both the desktop client *and* two additions to the published CLI: the `--managed` option on `update` and `nonInteractive` in that command's global options. Reverting the commit removed all of it.

`v1.10.0` was tagged on 2026-08-14, before the revert, so both options are in the published npm package. `git ls-tree v1.10.0` also carries `apps/desktop/`, but that never reached a user: the package `files` field is `["dist", "!dist/bin", "!dist/bin/**"]`, and the `v1.10.0` GitHub Release carries only CLI archives, a manifest, and checksums. The desktop app shipped in the tag and nowhere else. The two CLI options are the only part of that revert with published reach, and they are the entire reason `main` is a major.

`defer-v2-release` diagnosed this as a commit-title artifact — its Context says the desktop feature "and its removal both landed after that tag". That is incorrect, and it led to a gate that suppresses Release PR creation outright rather than one that addresses why the version is a major.

## Goals / Non-Goals

**Goals:**

- Return the two published v1 surfaces to `main` so it no longer carries an unapproved v1 removal.
- Let Release Please compute `1.11.0` by itself, with no override, pin, or one-shot path.
- Narrow the stable-v2 gate back to denying versions rather than suppressing preparation.
- Keep the v2 readiness requirement exactly as strict as it is today.

**Non-Goals:**

- Do not restore the desktop client, its CI job, its sidecar scripts, or its spec.
- Do not identify the required v2 refactor or start its stabilization clock.
- Do not make any stable `2.x` version eligible, by `Release-As` or otherwise.
- Do not cut the release inside this change; merging it only makes the Release PR possible.

## Decisions

- **Restore `--managed` with its real behavior rather than as a deprecated alias for `--all`.** The distinction is a genuine CLI concept — update only what Quantex has recorded, skip agents it does not manage — and the implementation is a two-line parameterization of the existing batch invocation, not desktop machinery. An accepted-but-no-op flag would keep the option name working while silently widening what it updates, which is a worse compatibility outcome than either restoring or removing it.
- **Restore by taking the six affected files back to their `d92c7bc^1` content.** No commit has touched any of them since the revert, so there is no drift to reconcile and no risk of reverting unrelated work. `test/workflow-classification.test.ts` is excluded: its removed assertions covered the deleted `desktop-macos` job.
- **Remove `skip-github-pull-request` instead of pairing it with a version pin.** Once `main` computes a minor there is no ineligible PR to suppress, so the blunt layer has nothing left to do. Keeping it would leave the repository unable to release for reasons no longer true.
- **Keep the three version-naming denial layers untouched.** `release-readiness.ts` is imported by Release PR validation, tag planning, and publication identity validation, and each still fails on a stable `2.x`. The gate's own design scoped it to stable `2.x`; this restores that scope.
- **Carry a one-shot `Release-As: 1.11.0`.** *(Corrected after delivery. This decision originally read: "Let the version fall out of conventional commits — with the breaking marker no longer describing a real removal, release-please computes 1.11.0 unaided." The first preparation run after merge generated `chore: release 2.0.0` instead.)* Release-please reads commit markers, not whether a marker still describes something real. `d92c7bc revert!:` remains in the `v1.10.0..main` range and keeps its `!`, so a major is computed regardless of how complete the restoration is. The range only stops containing the marker once a release boundary is placed after it, so exactly one release has to name its own version. `docs/runbooks/releasing-quantex.md` already documents `Release-As: <version>` in the merged commit as the supported mechanism for that.
- **`Release-As: 1.11.0` does not weaken the stable-v2 gate.** `major-release-readiness` rejects `Release-As` as a route to a stable `2.x`. This names a version below the deferred major, which the gate has no opinion on, and every stable-`2.x` denial layer stays armed.
- **Minor is the honest version, and the repository's own v1 fixtures prove it.** Between published `v1.10.0` and `main`: `root-exports.json` is byte-identical at 117 names; the v1 command fixture holds 15 commands and 4 aliases on both sides with none added or removed and no exit code changed; and only five digests move — `capabilities`, `list`, and `info`/`inspect`/`resolve` for codex — all explained by the three `feat` catalog commits, including the removal of the `mise` method from codex. `update` is absent from that set, confirming the restoration returned it exactly. No v1 surface is removed, so a minor is correct rather than convenient.

## Risks / Trade-offs

- [`main` briefly computed a major, and a stale Release PR could exist] -> No Release PR is open, and none can be until `skip-github-pull-request` is removed in this change; the first preparation run after merge starts from the current manifest at `1.10.0`.
- [Removing the suppression could let an ineligible `2.0.0` PR appear if the restoration is incomplete] -> Release PR validation rejects a stable `2.x` PR before it can be merged, and tag planning and publication identity validation deny it again. A mistake here produces an unmergeable PR, not a bad release.
- [Restoring `--managed` re-adds a surface tied to a removed feature] -> The option's behavior is defined against persisted lifecycle state, which is a first-class CLI concept that outlived the desktop client. It is covered by restored tests at the command and service layer.
- [A reader may conclude the v2 gate was weakened] -> The proposal, the spec deltas, and `docs/releases.md` all state that the readiness requirement is unchanged and that the pause is lifted because `main` is no longer a stable `2.x` candidate.

## Migration Plan

1. Restore the two CLI surfaces and their tests, and regenerate the v1 command-family goldens.
2. Sync the `agent-update` and `cli-contract-registry` requirements that described them.
3. Remove `skip-github-pull-request: true` and update the `release-workflow` and `major-release-readiness` requirements plus the release docs and runbook.
4. Merge. The push to `main` runs Release Please, which prepares a `1.11.0` Release PR.
5. Review and merge that Release PR; `tag-release` tags it and `release.yml` publishes.
6. Confirm the published `1.11.0` accepts `qtx update --all --managed` and `qtx update --non-interactive`.
