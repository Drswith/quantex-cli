# Design

## Decision

Archive closure is still agent-driven, but the risky parts move from prose instructions into two repository scripts:

- `scripts/pr-body-policy.ts` validates PR body structure, linked artifacts, and release-intent policy.
- `scripts/openspec-archive-closure.ts` verifies completed OpenSpec changes, performs archive state transition, runs OpenSpec validation, and generates a compliant archive PR body file.

## Rationale

Superpowers is best used as the cross-agent routing layer, not as the only enforcement mechanism. The repository still needs executable guardrails for steps that have already failed in real sessions: choosing `openspec archive` flags and producing a PR body that matches governance.

The archive closure wrapper defaults to the post-merge path where accepted spec deltas are already synced into `openspec/specs/`; it archives with `--skip-specs` unless `--apply-specs` is explicitly requested. That makes the common follow-up path idempotent and avoids duplicate-header failures.

## Tradeoffs

- This adds small workflow-support scripts, but it removes much larger inline GitHub Actions logic and agent-specific hand steps.
- The wrapper does not create or merge PRs. Agents still use GitHub CLI or host-specific tooling for delivery, but they no longer hand-write the archive transition or PR body from scratch.
