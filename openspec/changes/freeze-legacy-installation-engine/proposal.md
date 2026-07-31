## Why

Version 1.4 has promoted Core as the default apply engine for CLI `install` and
`ensure`, while retaining a deliberate whole-invocation legacy escape route.
The second stable-minor soak must now make that boundary operationally clear
without deleting a proven recovery path or expanding Core beyond its verified
surface.

## What Changes

- Define the 1.5 soak contract: Core remains the default for non-dry-run
  `install` and `ensure`; the legacy implementation is frozen rather than
  removed; `--dry-run` and the pre-invocation legacy override remain available.
- Add a narrow regression guard that keeps the promoted routing bounded to
  `install` and `ensure`, and prevents accidental compatibility fallback or
  Core expansion into `update`, `uninstall`, and `run`.
- Document an operator rollback rehearsal that uses the existing
  `QUANTEX_INSTALLATION_ENGINE=legacy` escape route, captures the required
  evidence, and returns to the Core default without changing persisted state.
- Update English and Simplified Chinese transition guidance to identify the
  1.5 soak, the frozen legacy boundary, and the later-major removal gate.

## Capabilities

### New Capabilities

- `core-installation-soak`: Defines the bounded 1.5 Core-default soak,
  legacy-engine freeze, and repeatable rollback rehearsal.

### Modified Capabilities

- `compatibility-contract`: Extends the staged routing contract through the
  second Core-default minor without allowing early legacy removal.
- `product-readme`: Updates product-facing English and Simplified Chinese
  guidance for the 1.5 soak and rollback boundary.

## Impact

- Affected code: installation-routing regression tests and any minimal
  compatibility-boundary metadata needed to make the freeze enforceable.
- Affected documentation: the product READMEs and a focused operator runbook.
- No package identity, state-schema, public Core method, CLI command, output,
  or release-workflow expansion is included. `update`, `uninstall`, and `run`
  remain maintained legacy CLI paths.
