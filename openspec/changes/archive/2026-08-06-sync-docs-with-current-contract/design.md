## Context

`origin/main` is now at v1.8.8. The repository release contract has one maintained line, `main`; the former beta branch and npm `beta` dist-tag are retired. The CLI still exposes a `beta` self-upgrade selector for an explicitly published prerelease, so documentation must distinguish that compatibility surface from the repository's normal release process.

The latest uninstall fix also makes an important ownership boundary observable: when the managed provider package is conclusively gone but a different executable remains on `PATH`, Quantex clears its managed receipt and reports a conflicting source instead of restoring stale managed state. The behavior is already implemented and covered by the active uninstall change; this change supplies the missing user-facing recovery guidance.

## Goals / Non-Goals

**Goals:**

- Make current release and branch guidance say `main` only, with the defensive prerelease-to-`beta` mapping clearly labeled as a fail-safe.
- Make README upgrade examples and configuration language accurate without removing the existing CLI `beta` selector.
- Explain managed uninstall ownership and residual `PATH` recovery in both product languages and the troubleshooting runbook.
- Keep current OpenSpec contracts, runtime instructions, and project-memory statements internally consistent.

**Non-Goals:**

- Do not change release workflows, npm dist-tags, CLI flags, uninstall logic, state schema, or provider behavior.
- Do not rewrite historical ADRs or past session evidence; only correct a session's current-status follow-up where it now claims a still-open maintainer action.
- Do not add a new preview-release mechanism or turn Quantex into a workflow orchestration platform.

## Decisions

1. **Use current contracts as the source of truth.** Update current OpenSpec specs, the central runtime, and active runbooks; leave superseded ADR decisions intact as historical records. This avoids erasing why the beta design was retired while preventing agents from following it as current policy.

2. **Retain but qualify the self-upgrade selector.** The source and compatibility surface still accept `qtx upgrade --channel beta`, so the README will not claim that the flag was removed. It will say that stable is the normal line and beta is only an explicit selector for a prerelease that actually exists; no beta release is maintained by this repository.

3. **Document ownership, not implementation details.** The README and troubleshooting runbook will state that Quantex removes tracked managed packages, does not delete an independently owned `PATH` executable, and reports the residual as a conflicting source when the managed package is gone. Recovery points users to `inspect`/`resolve` and the owner of the remaining executable.

4. **Avoid hardcoding a version in onboarding docs.** The live npm registry was checked as part of the audit and currently reports only `latest: 1.8.8`; docs will describe the stable/latest relationship rather than embedding `1.8.8`, so the next release does not immediately make README text stale.

5. **Keep the release identity fail-safe comment aligned.** The release-seal comment will describe the beta mapping as defensive publication routing, matching the current release spec, without changing executable code.

## Risks / Trade-offs

- [Risk] A future maintainer may reintroduce a beta branch without updating all current docs → keep branch scope in release, CI, and project-memory specs and validate OpenSpec/memory checks together.
- [Risk] Users may interpret the retained beta selector as a guaranteed available release → explicitly state that no beta channel is maintained and that the selector can have no matching release.
- [Risk] A residual executable may still be mistaken for a failed managed uninstall → document the distinct `conflicting-source` case and the `inspect`/`resolve` diagnostic path.
- [Trade-off] Historical ADRs will still contain old beta wording → label the audit scope and preserve them as historical decisions rather than editing archaeology.

## Migration Plan

1. Add the proposal, design, delta specs, and task list.
2. Update current README, runbook, runtime, spec, session, and release-comment text.
3. Run formatting, lint, typecheck, tests, OpenSpec validation, and project-memory checks.
4. Commit and push the documentation change from its dedicated branch; no runtime migration or rollback is required. Reverting the commit restores the previous wording without changing user state.

## Open Questions

None. The CLI behavior and current registry state are known; this change only aligns the written contracts with them.
