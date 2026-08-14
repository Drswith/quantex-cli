## 1. OpenSpec Contract

- [x] 1.1 Record the Issue #645 motivation, scope, work-intake classification, and affected release-workflow capability in `proposal.md`.
- [x] 1.2 Record the post-publish matrix design, exact-tag pinning, scratch-directory isolation, and no-retag failure policy in `design.md`.
- [x] 1.3 Add the release-workflow delta requirements and scenarios for Linux, macOS, Windows, failure identification, and post-publish recovery.

## 2. Release Workflow Implementation

- [x] 2.1 Add a non-cancelling `release.yml` matrix job that depends on public GitHub Release closure and covers Ubuntu, macOS, and Windows hosted runners.
- [x] 2.2 Check out the immutable release tag and pass the exact repository, tag, and scratch installation directory to every installer leg.
- [x] 2.3 Invoke the real `install.sh` on POSIX runners and `install.ps1` on Windows, failing with the installer and runner name when installation, verification, extraction, or execution fails.
- [x] 2.4 Verify both documented entry points and the expected release version in every matrix leg without changing the installers or release asset matrix.

## 3. Regression Coverage and Documentation

- [x] 3.1 Add static regression assertions for the release workflow dependency, runner matrix, exact release identity, scratch path, installer commands, and failure ordering.
- [x] 3.2 Update `docs/runbooks/releasing-quantex.md` with the post-publish installer gate, failure interpretation, and same-tag recovery policy.

## 4. Validation

- [x] 4.1 Run `bun run openspec:validate` and `bun run memory:check` after the OpenSpec and runbook changes.
- [x] 4.2 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`.
- [x] 4.3 Review the final git diff and report local implementation, OpenSpec, commit, remote, PR, release, and archive-closure states separately.
