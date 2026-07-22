# Lifecycle Integration Teardown Plan

Base: `origin/main@fedea8d8b1efe65b3481607256309d3a0af731dd`

## Goal

Return repository workflows and collaboration policy to steady state after the lifecycle redesign promotion and `v0.29.1` release completed. Remove only the temporary integration delivery surface while keeping the accepted redesign, release branch allowlists, ordinary single-commit governance, active OpenSpec deltas, and archive work intact.

## Intake and earned state

This milestone implements active `support-integration-branch-delivery` tasks 4.5 and 5.1. Release evidence is complete: PRs #470 and #471 rebase-merged, main CI runs 29492269104 and 29492768675 passed, Release run 29492987375 published `v0.29.1`, GitHub assets are present, and npm `latest` resolves to `0.29.1`. Task 5.2 remains unchecked until this cleanup PR itself merges; tasks 5.3-5.6 remain later closure milestones.

## Task 1: Establish steady-state regressions first

- Require CI and Sandbox Tests pull-request bases to be exactly `main` and `beta`.
- Require every multi-commit PR, including the former main-sync and final-promotion shapes, to fail the ordinary single-commit policy.
- Require the merge-policy workflow step to stop passing temporary topology fields.
- Require the temporary runbook and its runtime/collaboration pointers to be absent.
- Retain tests proving Release accepts only `main`/`beta` and rejects the former integration ref and other unknown branches.

Run the focused tests before implementation and record the expected failures.

## Task 2: Remove the temporary delivery surface

- Remove `codex/redesign-lifecycle-integration` from CI and Sandbox Tests pull-request filters.
- Simplify PR merge policy to the ordinary one-commit rule plus the existing validated release-bot exception; remove temporary topology parsing and workflow inputs.
- Delete `docs/runbooks/lifecycle-integration-delivery.md` and remove its pointers from the central runtime skill and collaboration guide, retaining generic active-change/archive closure guidance.
- Update only genuinely earned OpenSpec tasks 4.5 and 5.1.

Do not delete the remote integration ref or ruleset in this PR. Those external changes belong to task 5.3 after this cleanup merges.

## Task 3: Validate and deliver

Run focused workflow/governance tests, the full suite with at most two local workers, lint, format check, typecheck, OpenSpec validation, memory check, and diff check. Obtain independent review, normalize to one conventional process-only commit, validate a template-based PR body, push, and create a Ready PR to `main`. Keep auto-merge disabled and merge manually with rebase first only after required checks pass.

## Closure boundary

This PR is process-only and must not trigger a product release. After merge, task 5.2 can be recorded as earned; only then may task 5.3 remove the live ruleset/ref, followed by spec synchronization and archive closure tasks 5.4-5.6.
