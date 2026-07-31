# Core installation routing rollback rehearsal

Use this procedure only for a suspected 1.4/1.5 routing regression in CLI
`install` or `ensure`. It exercises the retained legacy engine for one new
invocation; it is not an in-flight fallback and does not roll back a provider,
filesystem, or state side effect already started by Core.

## Preconditions

- Record the CLI version, platform, target agent, command options, and the
  failing Core-default result.
- Choose one non-production fixture or an agent whose normal installation
  policy permits a deliberate retry. Do not use `--dry-run` as mutation
  evidence: it always stays on legacy planning by contract.
- Preserve the state file before and after the rehearsal. State schema must
  remain version 2; do not edit or delete it to change engines.

## Rehearsal

1. Run one explicit legacy invocation and preserve stdout, stderr, exit code,
   and the resulting state evidence:

   ```bash
   QUANTEX_INSTALLATION_ENGINE=legacy qtx ensure <agent>
   ```

2. Confirm debug stderr, when enabled with `--log-level debug`, reports
   `engine=legacy source=compatibility-escape`. JSON and NDJSON payloads must
   not gain routing fields.
3. Start a separate invocation without `QUANTEX_INSTALLATION_ENGINE`:

   ```bash
   qtx ensure <agent>
   ```

4. Confirm debug stderr reports `engine=core source=stable-default`, then
   compare the command result and state evidence with the legacy invocation.

## Decision and escalation

- A successful legacy invocation does not authorize retrying the original
  Core invocation inside the same process. Let the selected engine finish its
  verification or scoped recovery first.
- If the legacy route also fails, capture provider, lock, state, cancellation,
  and timeout evidence; do not attribute the failure to Core routing alone.
- Keep the per-invocation override only for the affected recovery. Removing
  the legacy route requires two Core-default stable minors, at least 90 days
  from default enablement, and a separately approved later-major change.
