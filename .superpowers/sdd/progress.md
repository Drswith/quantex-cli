# Observation and Read-Only Milestone Progress

Base: `origin/codex/redesign-lifecycle-integration@7b1dcf5b0caf8750f073a5252b4798548a9a1296`

| Task | State | Checkpoint | Evidence |
| --- | --- | --- | --- |
| 1. Live lifecycle observer | complete | `2a7218d` + `68704c5` | 44 focused tests; controller gate passed; independent re-review approved |
| 2. Deterministic observation planning | complete | `00f12a7` + `bcf9ad9` | 88 focused tests; controller gate passed; independent re-review approved |
| 3. Read-only application and v1 projection | complete | `7500245` + `879c29f` | 47 focused tests; controller gate passed; independent re-review approved |
| 4. list/info migration | complete | `7aa8645` + `c864132` | 27 focused tests; controller gate passed; independent re-review approved |
| 5. inspect/resolve migration | complete | `f7e059f` + `be27468` | 37 focused tests; controller gate passed; independent re-review approved |
| 6. capabilities/doctor migration | complete | `a3d815d` + `2323960` | 58 controller tests; independent re-review approved |
| 7. Real-environment and OpenSpec closure | complete after sixth fix wave | prior checkpoints + `f6fa654` + `4066817` | Invocation interruption wins request transport rejection before headers |
| 8. Review and integration PR | whole-branch review approved | pending | No Critical, Important, or Minor findings; normalization in progress |

Recovery rule: resume the first row that is not `complete`; inspect its brief/report and `git status` before running commands.
