## MODIFIED Requirements

### Requirement: Exec install timeout MUST recognize late successful managed installs

When `quantex exec` or shortcut `quantex <agent>` installs a missing agent with `--timeout`, Quantex SHALL wait up to `min(timeoutMs, 250)` after the deadline before cancelling managed install subprocesses. If install completes successfully within that grace window, Quantex SHALL continue to spawn the agent and return exit code `0`.

#### Scenario: Managed install succeeds after deadline without premature cancellation

- GIVEN `quantex exec <agent> --install if-missing --timeout 20s`
- AND the managed install subprocess would complete successfully at 30ms
- AND cancellation handlers would abort the install when invoked
- WHEN the timeout deadline fires at 20ms
- THEN Quantex does not cancel managed install work before the grace window ends
- AND the command returns exit code `0`
- AND the agent binary is spawned
