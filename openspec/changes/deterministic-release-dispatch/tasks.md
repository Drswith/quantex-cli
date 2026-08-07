## 1. Release trigger contract

- [x] 1.1 Amend the release-workflow spec so dispatch is the declared trigger after tagging and record why the bot's tag push does not fire `on: push: tags`.

## 2. Tag-release implementation

- [x] 2.1 Dispatch `release.yml` directly after the tag push and delete the polling grace period, its helper, and `RELEASE_TAG_DISPATCH_GRACE_MS`.
- [x] 2.2 Update `test/tag-release.test.ts` so it asserts the direct dispatch and fails if the grace period returns.

## 3. Workflow hygiene

- [x] 3.1 Replace the deprecated `app-id` input with `client-id` in `release-please.yml` and `release.yml`.
- [x] 3.2 Point that input at the pre-existing `RELEASE_APP_CLIENT_ID` secret instead of `RELEASE_APP_ID`, and record in the runbook which secret is authoritative.

## 4. Documentation and validation

- [x] 4.1 Correct the release runbook's account of the tag trigger and the dispatch path.
- [x] 4.2 Run lint, format check, typecheck, test, OpenSpec validation, memory check, and the release dry run.
- [ ] 4.3 Mark completed tasks and report local, repository, PR, release, and archive-closure status.
