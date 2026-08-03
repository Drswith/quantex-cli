## Context

`qtx ls` currently derives two independent pieces of information: an update
strategy label and an optional latest version. The human table displays only
the strategy under the ambiguous `Update` header, while JSON/NDJSON already
retain both values.

## Goals / Non-Goals

**Goals:**

- Make update management and update availability separately scannable.
- Show a target version only when it is semantically newer than the installed
  version.
- Preserve the current terminal-width degradation and machine output.

**Non-Goals:**

- Do not add a registry refresh or mutate state from `qtx ls`.
- Do not claim an update for missing, unknown, unparseable, or non-newer
  versions.
- Do not change `qtx update` execution semantics.

## Decisions

- Rename `Update` to `Managed`. This keeps the compact existing strategy
  values while making their meaning explicit.
- Add an optional `Available` column. It emits a version only when semantic
  comparison confirms the observed latest version is newer; otherwise it
  emits an em dash. This avoids an overloaded boolean status and preserves
  the useful target version.
- Give `Available` a lower display priority than `Managed` so narrow layouts
  retain the update path before the optional availability detail.
- Reuse the project semantic-version comparison utility rather than raw string
  ordering. Raw ordering would misclassify versions such as `1.10.0`.

## Risks / Trade-offs

- [Latest metadata can be unavailable or stale] → Render `—`; retain the
  existing metadata provenance in structured output rather than fabricating a
  result.
- [An extra column can crowd small terminals] → Keep it optional and lower
  priority in the existing responsive table renderer.
- [Some agents use non-semver versions] → Treat them as unavailable instead
  of inferring ordering.
