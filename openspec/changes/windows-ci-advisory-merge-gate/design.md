# Design: windows-ci-advisory-merge-gate

## Context

`ci.yml` runs `test (windows-latest)` whenever the product test matrix runs. That job is currently a merge gate and part of the overall workflow conclusion. A Windows flake therefore fails `ci.yml`, blocks merge when the job is required, and also blocks release tagging because tagging requires a successful `ci.yml` push run on the release SHA.

Ubuntu lint/governance/test and macOS test remain required. Canary/sandbox policy was already adjusted in step 1 and is out of scope here.

## Goals / Non-Goals

**Goals:**

- Windows tests still run on the same matrix trigger as today.
- Windows results remain visible in Checks / Actions.
- A Windows failure does not fail `ci.yml` and does not block merge or release tagging for that SHA.
- Document the policy in workflow comments plus living docs/specs.

**Non-Goals:**

- Removing or skipping the Windows job.
- Rewriting flaky Windows tests unless necessary for this gate change.
- Changing macOS policy beyond any incidental shared assertion updates.
- Delivery-simplification steps 3–6 (governance on release PRs, collapsing release, Core publishing, OpenSpec/memory lint gates).
- Further canary/sandbox changes.

## Decisions

1. **Use job-level `continue-on-error: true` on `test-windows`.** Smallest GitHub Actions lever that keeps the job executing and reporting while preventing a failed Windows job from failing the workflow conclusion. Alternatives considered: deleting the job (rejects product constraint), moving Windows to a separate advisory workflow (larger diff, changes trigger surface), or only asking maintainers to drop the required check without `continue-on-error` (push `ci.yml` would still fail and block release tagging).
2. **Update required-check contracts to four contexts.** Living specs/docs list `lint`, `governance`, `test (ubuntu-latest)`, and `test (macos-latest)`. Windows remains present in `ci.yml` but MUST NOT be a required ruleset context.
3. **Keep the Windows job name and matrix `if` unchanged.** Visibility and trigger parity matter more than renaming; contract tests continue to assert the job exists and still run on product-impacting PRs.
4. **Amend ADR 0009 lightly.** The ADR still influences maintainer ruleset expectations; add a dated amendment rather than rewriting the historical decision narrative.

## Risks / Trade-offs

- [Risk] A real Windows regression becomes non-blocking → Mitigation: job still runs and remains visible; Ubuntu/macOS stay required; flakes stop blocking delivery while signal remains.
- [Risk] Ruleset still lists `test (windows-latest)` as required → Mitigation: `continue-on-error` makes the job conclusion succeed even on step failure, so merge is not blocked; docs/PR notes ask maintainers to drop it from the required set for honesty.
- [Risk] Specs/docs/tests drift from workflow → Mitigation: update deltas, collaboration/runbook text, ADR amendment, and workflow classification assertions in the same change.

## Migration Plan

1. Land the `ci.yml` `continue-on-error` change with comments.
2. Update OpenSpec deltas, docs, ADR amendment, and contract tests.
3. After merge, maintainer removes `test (windows-latest)` from the `main` ruleset required checks if it is still listed.

## Open Questions

None for step 2; later steps are explicitly deferred.
