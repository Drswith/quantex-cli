## Why

Quantex 1.12 already defaults CLI `install` and `ensure` to in-repo Core.
Product has authorized retiring the soak-era whole-invocation escape
`QUANTEX_INSTALLATION_ENGINE=legacy` so those commands stop selecting a second
engine. Keeping a dormant legacy route after Core-default soak adds operator
and maintenance cost without preserving a frozen user-facing contract.

Work-intake classification: observable CLI routing/behavior, architecture
boundaries, and product-facing Core transition docs. OpenSpec required before
edits.

## What Changes

- Remove the `QUANTEX_INSTALLATION_ENGINE=legacy` whole-invocation escape for
  CLI `install` and `ensure`. Those commands MUST always select in-repo Core
  before observation or mutation.
- Move install/ensure `--dry-run` onto Core's existing `preview` path when it
  already projects the maintained v1 dry-run plan (no mutation, same warning
  codes/messages and data shape). Do **not** silently change dry-run JSON.
- Keep user-facing commands, aliases, `--json` / `--output`, exit codes, and
  state schema version 2 unchanged.
- After Core-only routing, prove the `src/lifecycle` import graph and delete
  only files that become zero-reference. Do not delete modules still used by
  Core or by exec's install-if-missing port.
- Update compatibility-contract / installation-routing (and related product
  docs/runbooks) that currently require the legacy env escape.
- Do **not** expand published `quantex-core` public API.
- Do **not** change YAML / `release-core.yml`.
- Do **not** change `upgrade` / `config` behavior.
- Out of scope: new commands/aliases, state schema migration, 2.x identity,
  rewriting exec's install port onto Core installation, SDK method growth.

## Capabilities

### New Capabilities

- none

### Modified Capabilities

- `installation-routing`: require Core-only whole-invocation routing for
  `install` / `ensure` (including `--dry-run`); remove the env escape and the
  legacy dry-run planning route; retire the rollback-rehearsal requirement that
  depends on the escape.
- `compatibility-contract`: retire the retained install/ensure legacy escape
  and legacy dry-run route requirements; keep Core-only selection, frozen v1
  contracts, and published SDK freeze.
- `product-readme`: update the 1.12 transition narrative so it no longer
  documents the install/ensure env escape or legacy dry-run route.
- `runtime-boundaries`: clarify that install/ensure no longer retain a parallel
  legacy engine route beside Core once the escape is retired.

## Impact

- `src/commands/installation-routing.ts`, `install.ts`, `ensure.ts`, and
  related tests lose legacy engine branching.
- Install/ensure `--dry-run` uses Core `preview` through
  `core-installation-cli`.
- `docs/runbooks/core-installation-routing-rollback.md`, README bilingual
  Core-transition wording, and ADR notes that still describe the escape are
  updated or retired as product memory.
- `src/lifecycle` deletions happen only after an import-graph proof of
  zero references.
- Validation gate: lint, format:check, typecheck, and `--json` contract tests
  including former legacy-env cases (they must not branch to a second engine).
