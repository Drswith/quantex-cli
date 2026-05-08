## Context

Quantex keeps the expensive `self-managed` self-upgrade scenario in the protected-branch Modal workflow, not in the merge-gating PR profile. That scenario stages two local package tarballs, serves them from a sandbox-local registry, installs the older version through Bun, and verifies that `qtx upgrade` reaches the current checkout version.

The current harness makes two unrealistic assumptions:

- The mocked registry can publish only `name`, `version`, and tarball URLs.
- A Bun-managed install rooted at an arbitrary `bun-global` directory behaves the same as a real `$HOME/.bun` install.

In practice, Bun uses the version metadata from the registry packument to decide whether to create global shims and link runtime dependencies. The incomplete packument therefore installs `quantex-cli` without a runnable `qtx`. Even after that is fixed, Quantex would mis-detect the install source because its Bun detection logic expects `/.bun/install/global/` in the package root.

## Goals / Non-Goals

**Goals:**

- Make the sandbox-local registry resemble a real published package closely enough for Bun global installs to be runnable.
- Make the self-managed smoke environment match Quantex's Bun install-source detection rules.
- Preserve the current seeded-version and upgrade-check behavior of the scenario.

**Non-Goals:**

- Expanding the PR merge-gating sandbox profile.
- Changing production self-upgrade provider logic.
- Reworking Modal transport or non-self-managed lifecycle scenarios.

## Decisions

### Derive registry version entries from staged package manifests

The local registry will reuse the staged `package.json` manifests for each tarball and only override the tarball URL under `dist`. This preserves fields such as `bin`, `dependencies`, `type`, and exports without having to maintain a hand-written allowlist.

Alternative considered: add only `bin` and `dependencies` to the current minimal metadata. Rejected because it still leaves future package-manager-sensitive fields implicit and fragile.

### Run the scenario under an isolated `HOME` with `.bun`

The self-managed smoke will create `HOME=<sandbox>/home` and `BUN_INSTALL=$HOME/.bun`, then execute the seeded install and upgrade checks through `$HOME/.bun/bin/qtx`. That matches the layout already assumed by self-install detection and by the broader isolation workflow.

Alternative considered: broaden Bun install-source detection to arbitrary custom roots. Rejected because the smoke harness should mimic production first; widening detection would change product behavior for a test-only workaround.

## Risks / Trade-offs

- [Risk] Reusing most staged package manifest fields makes the mocked registry payload larger. → Mitigation: the payload stays local to the sandbox and is simpler than maintaining a partial schema by hand.
- [Risk] Future `package.json` changes could add fields that a mocked packument does not need. → Mitigation: that is acceptable; the goal is realism, and unit tests will cover the fields the harness depends on.
- [Risk] The isolated `.bun` home could expose additional Bun-specific issues. → Mitigation: that is desirable for the protected-branch full sandbox profile.

## Migration Plan

1. Update the self-managed sandbox metadata helper and its unit tests.
2. Update the lifecycle smoke harness to return staged manifests and run the Bun-managed scenario under an isolated `.bun` home.
3. Re-run the targeted self-managed smoke locally, then the normal repository validation suite.

No data migration is required. Rollback would be a straightforward revert of the harness and helper changes.

## Open Questions

- None.
