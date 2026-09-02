# Core installation routing rollback rehearsal

> **Retired in 1.12.** CLI `install` and `ensure` are Core-only. The former
> `QUANTEX_INSTALLATION_ENGINE=legacy` whole-invocation escape and this
> rehearsal procedure are no longer supported operator recovery steps.

## Current guidance

- Diagnose install/ensure regressions on the single in-repo Core route.
- Capture CLI version, platform, target agent, options, stdout/stderr, exit
  code, provider, lock, state, cancellation, and timeout evidence.
- Preserve state schema version 2; do not edit or delete the state file to
  change engines.
- Do not set `QUANTEX_INSTALLATION_ENGINE` expecting a second install/ensure
  engine. The value is ignored for routing.
- `--dry-run` for install/ensure uses Core preview and makes no lifecycle
  mutation; it is not mutation evidence.
