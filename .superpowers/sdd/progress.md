# Lifecycle Integration Teardown Progress

Base: `origin/main@79a4d098404337f5fea8ea5a442264fbc9b93486`

Plan: `docs/superpowers/plans/2026-07-16-lifecycle-external-teardown.md`

| Task | State | Checkpoint | Evidence |
| --- | --- | --- | --- |
| 1. Complete release closure | complete | release checkpoint | Recovery PR #470 and release PR #471 were manually rebase-merged; main CI runs 29492269104 and 29492768675 passed all platforms; Release run 29492987375 published GitHub Release and npm `quantex-cli@0.29.1` with `latest` pointing to 0.29.1 |
| 2. Add steady-state regressions | complete | red/green checkpoint | Focused tests first failed on six temporary integration behaviors, then passed 3 files/30 tests after the cleanup implementation |
| 3. Implement process-only cleanup | complete | local cleanup checkpoint | CI and Sandbox PR targets restored to `main`/`beta`; temporary multi-commit exceptions and topology inputs removed; runtime/collaboration guidance returned to steady state; temporary runbook removed; support tasks 4.5 and 5.1 recorded complete |
| 4. Validate and deliver cleanup | complete | cleanup merge checkpoint | PR #472 rebase-merged at `main@79a4d098404337f5fea8ea5a442264fbc9b93486`; main CI run 29494534512 and Sandbox Tests run 29494534450 passed; Release run 29494738238 skipped GitHub Release, npm publish, and artifact upload; task 5.2 is complete |
| 5. Remove external integration infrastructure | complete | live teardown checkpoint | Deleted only ruleset `protect-lifecycle-integration` id 18789571 and remote ref `codex/redesign-lifecycle-integration`; live ruleset inventory retains active `protect-main` id 15433431, `git ls-remote` returns no integration head, no open PR targets the deleted base, and `origin/main` remains `79a4d098404337f5fea8ea5a442264fbc9b93486`; task 5.3 is complete |
| 6. Synchronize specs and archive | pending | archive checkpoint | After task 5.3 is delivered, synchronize current specs under 5.4 and complete archive/readiness verification under 5.5–5.6 |

Recovery rule: resume the first incomplete row only after refreshing `main`, active OpenSpec counters, PR/check state, and git state. Never repeat the completed release recovery; retry only interrupted network operations.
