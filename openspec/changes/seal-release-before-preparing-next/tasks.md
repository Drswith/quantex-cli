## 1. Resolve and publish the branch seal state

- [x] 1.1 Add a pure `resolveBranchSealState` to `scripts/release/tag-release.ts` that reports sealed only when the branch manifest version is a release version and its `v<version>` tag resolves, and carries the reason for every verdict.
- [x] 1.2 Add a pure `parseManifestVersion` that reads the `"."` entry from `.release-please-manifest.json` content and returns `null` for unreadable, non-object, or missing entries rather than throwing.
- [x] 1.3 Extract the existing tagging body into its own function so its early returns cannot skip seal publication, and run the seal read after it on every path that reaches the end of the job.
- [x] 1.4 Re-fetch `origin/<branch>` before the seal read, read the manifest from `origin/<branch>:.release-please-manifest.json`, and log the resolved version, the tag looked for, and the verdict.
- [x] 1.5 Write `sealed=true|false` to `$GITHUB_OUTPUT`, tolerating an absent `GITHUB_OUTPUT` for local runs.

## 2. Reverse the workflow job order

- [x] 2.1 In `.github/workflows/release-please.yml`, move `tag-release` first, drop its `needs: release-please`, give its script step an `id`, and expose `outputs.sealed`.
- [x] 2.2 Give `release-please` `needs: tag-release` and `if: needs.tag-release.outputs.sealed == 'true'`, and record in a comment why preparation is gated rather than reordered alone.

## 3. Tests

- [x] 3.1 Cover `resolveBranchSealState` in `test/tag-release.test.ts`: sealed, untagged manifest version, unreadable manifest version, and a non-release manifest version.
- [x] 3.2 Cover `parseManifestVersion` for a valid manifest, malformed JSON, and a missing `"."` entry.
- [x] 3.3 Assert the reversed job order and the seal gate in `test/workflow-classification.test.ts`, so a later edit cannot restore the original order silently.

## 4. Documentation

- [x] 4.1 Record the precondition and the skipped-preparation signal in `docs/runbooks/releasing-quantex.md`, including how to read the sealing job log when a Release PR does not appear.
- [x] 4.2 Update the release-flow description in `docs/releases.md` if it states the job order.

## 5. Validation and delivery

- [x] 5.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`.
- [x] 5.2 Run `bun run openspec:validate` and `bun run memory:check`.
- [x] 5.3 Run `bun run release:dry-run`, because this change edits `release-please.yml`.
- [x] 5.4 Open the PR with a body validated by `bun run pr:body:check`: [#678](https://github.com/Drswith/quantex-cli/pull/678).
- [ ] 5.5 After merge, confirm on the next protected-branch push that `tag-release` runs first, reports the branch sealed, and release-please resolves `v<version>` as its boundary instead of replaying the full history.
