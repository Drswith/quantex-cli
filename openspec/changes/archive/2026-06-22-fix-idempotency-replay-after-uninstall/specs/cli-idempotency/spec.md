## MODIFIED Requirements

### Requirement: Idempotency MUST replay only successful completions

Mutating commands that accept `--idempotency-key` SHALL persist idempotency records only when the primary command result is successful (`ok: true`) and the invocation is not a dry run.

#### Scenario: Successful mutating command is replayed

- GIVEN a mutating command completes with `ok: true`
- AND the caller supplied `--idempotency-key <key>`
- AND the invocation was not a dry run
- WHEN the same command is invoked again with the same key, action, and target before the record expires
- THEN Quantex replays the stored successful result without re-executing the primary command work

#### Scenario: Install replay is skipped after the agent was removed

- GIVEN a successful `install` idempotency record exists for key `<key>` and target agent `codex`
- AND `codex` is no longer installed in `PATH`
- WHEN `install` is invoked again with the same key, action, and target
- THEN Quantex does not replay the stored install success
- AND it executes the `codex` install work

#### Scenario: Uninstall replay is skipped after the agent was reinstalled

- GIVEN a successful `uninstall` idempotency record exists for key `<key>` and target agent `codex`
- AND `codex` is installed in `PATH` again
- WHEN `uninstall` is invoked again with the same key, action, and target
- THEN Quantex does not replay the stored uninstall success
- AND it executes the `codex` uninstall work
