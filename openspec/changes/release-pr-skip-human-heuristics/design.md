# Design: release-pr-skip-human-heuristics

## Context

`ci.yml` job `governance` already special-cases `release-please--branches--*` heads for `ci:release-pr-policy` and skips `release:verify-release-as` on those heads. It still always runs `pr:body:check` and `ci:commit-policy`. Those scripts are human-PR heuristics over free-form text; generated Release Please bodies/commits repeatedly trip them even when `ci:release-pr-policy` would accept the PR. Delivery simplification step 3 removes that double gate.

Human PRs, Windows/canary/sandbox policy, and later delivery-simplification steps (collapse release pipeline, Core publishing, OpenSpec/memory lint gates) are out of scope.

## Goals / Non-Goals

**Goals:**

- Automated Release Please PRs keep `ci:release-pr-policy` as their merge-gating governance validator.
- Those PRs no longer fail `governance` because of `pr:body:check` or `ci:commit-policy`.
- Human PRs keep body check, commit policy, and Release-As verification.
- Document the split in workflow comments and align specs/docs/tests.

**Non-Goals:**

- Rewriting `scripts/ci/pr-body-policy.ts` or `commit-policy.ts` exemption logic beyond what CI routing requires.
- Changing Release Please templates, release tagging, or publication workflows.
- Delivery-simplification steps 4–6.
- Further Windows/canary/sandbox changes.

## Decisions

1. **Gate the two human-heuristic steps with step-level `if`.** Use the same `startsWith(..., 'release-please--branches--')` predicate already used for release-PR policy and Release-As verification. Skip `Validate PR body` and `Validate PR commit policy` on release-please heads; leave `Validate release PR policy` as the release-PR gate. Alternatives considered: teaching the scripts to no-op on release-please heads without workflow `if` (still spends a step and keeps a false impression that human heuristics apply), or removing body/commit checks from CI entirely (rejects human-PR governance).
2. **Stop wiring `PR_IS_VALIDATED_RELEASE_PR` into the body-check step.** Once body check does not run on release-please heads, that env flag is unused in CI. Keep the script flag and unit coverage for local/scripted validation; CI no longer needs the validated-release exemption path.
3. **Keep generated governance headings in the Release Please header.** The template may still include human-oriented sections for readability/review, but merge gating for those PRs is `ci:release-pr-policy`, not heading heuristics.
4. **Amend ADR 0009 lightly.** Record that `governance` splits human heuristics from dedicated release-PR policy for release-please heads.

## Risks / Trade-offs

- [Risk] A malformed Release Please body that would have failed heading heuristics merges → Mitigation: `ci:release-pr-policy` still validates branch, title, generated marker, file scope, version monotonicity, and major/readiness gates.
- [Risk] A future edit removes the `if` and re-blocks releases → Mitigation: workflow contract tests assert the skip conditions and that `ci:release-pr-policy` still runs on release-please heads.
- [Risk] Docs still imply every PR runs `pr:body:check` in CI → Mitigation: update collaboration/runbook wording in the same change.

## Migration Plan

1. Land the `ci.yml` `if` gates plus comments.
2. Update OpenSpec deltas, docs, ADR amendment, and contract tests.
3. Next automated Release Please PR should pass `governance` without body/commit heuristic failures while still executing release-PR policy.

## Open Questions

None for step 3; later delivery-simplification steps remain deferred.
