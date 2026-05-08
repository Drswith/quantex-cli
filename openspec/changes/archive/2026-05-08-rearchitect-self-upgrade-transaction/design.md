## Context

The current self-upgrade implementation flattens too many concerns into `SelfInspection`: local runtime facts, resolved latest version, registry warnings, auto-update capability, and user-facing recommendation strings. The `upgrade` command then performs additional plan-like decisions on top of that flattened object, while providers still infer upgrade intent from fields such as `latestVersion`, `managedRegistry`, and `updateChannel`.

That shape has made recent self-upgrade regressions harder to contain because the system does not freeze an explicit “what are we trying to do?” object before execution. Detection, execution, and verification all read overlapping fields and can disagree about the upgrade target.

## Goals / Non-Goals

**Goals:**

- Introduce a first-class internal self-upgrade plan that separates facts, remote target resolution, status planning, and execution.
- Preserve the existing CLI command surface and structured response schema while reducing internal ambiguity.
- Make provider execution and post-install verification consume the same frozen target information.
- Centralize update-availability decisions so `inspectSelf()`, `quantex upgrade`, and `quantex upgrade --check` do not each re-derive the same semantics differently.

**Non-Goals:**

- Reworking the package-manager backends beyond the inputs they consume.
- Changing self-upgrade channels, cache configuration flags, or the user-visible command catalog in this change.
- Collapsing self-upgrade and agent update into one subsystem.

## Decisions

- Introduce internal phases: `resolveSelfInstallFacts()`, `resolveSelfUpdateTarget()`, `planSelfUpgrade()`, and `executeSelfUpgradePlan()`.
  Rationale: these phase boundaries match the real problem domains and give the code one place to answer each question.

- Keep `SelfInspection` as the public-facing summary object, but derive it from the new planning model.
  Rationale: commands and tests already consume `SelfInspection`, so this change should preserve outward compatibility while relocating the logic behind it.

- Make providers execute against a `SelfUpgradePlan` instead of a bare `SelfInspection`.
  Rationale: a provider should not guess target version or registry from a summary snapshot; it should receive the exact execution inputs already selected by the planner.

- Keep availability semantics unchanged where possible, but move them out of `src/commands/upgrade.ts` into self-upgrade planning.
  Rationale: the command layer should render results, not own the transaction rules.

## Risks / Trade-offs

- [Partial refactor leaves two competing paths] During transition, old and new helpers could coexist and drift. → Mitigation: route `inspectSelf()` and `upgradeSelf()` through the new planner in the same change.
- [Type churn across tests] Self-upgrade tests currently build raw `SelfInspection` literals in many places. → Mitigation: preserve the public inspection shape and add targeted plan tests instead of rewriting every consumer.
- [Behavior-preserving refactor still changes edge cases] Centralizing status logic may shift a few previously implicit edge paths. → Mitigation: keep the existing command tests and add planner-specific regression coverage around stale latest, unresolved latest, and verification target consistency.
