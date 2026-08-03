## Context

#554 removed VTCode from the source catalog, generated projections, public
exports, compatibility surfaces, documentation, and tests. The current
protected branch still contains that removal, while later unrelated changes
must remain intact.

## Goals / Non-Goals

**Goals:**

- Restore the complete pre-#554 VTCode lifecycle contract.
- Preserve all commits after #554 and retain the historical removal record.
- Regenerate catalog-derived artifacts from the restored source entry.

**Non-Goals:**

- Rewrite `main` history or alter existing release tags.
- Change any non-VTCode agent definition or release workflow policy.
- Migrate or remove users' existing VTCode installations.

## Decisions

### Revert the isolated merge commit through a new PR

Use Git's revert operation for `3cbb98f`, rather than temporarily bypassing
GitHub rules or force-pushing `main`. This restores exactly the removed source
and contract files while preserving later commits and an auditable history.

### Keep catalog projections generator-owned

Restore the `vtcode.json` source entry and use the repository catalog generator
to recreate derived catalog data. This avoids drift between the source catalog
and generated public/Core projections.

### Restore the current agent-catalog contract

Add the supported VTCode requirement back as an OpenSpec delta. The archived
removal change remains historical evidence and is not modified.

## Risks / Trade-offs

- [A later change conflicts with the revert] → Resolve only against the
  restored VTCode contract and verify catalog-derived behavior with focused and
  full tests.
- [Generated artifacts drift] → Run the repository generator and inspect the
  resulting diff before validation.
- [Release planning still includes other `feat:` commits] → This change removes
  the breaking trigger only; release-please may correctly select a minor
  release from the retained feature commits.
