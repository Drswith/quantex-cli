## ADDED Requirements

### Requirement: Bun-managed self-upgrade MUST NOT uninstall Quantex on trust failure

Bun-managed self-upgrade SHALL treat trust inspection and trust application failures as upgrade failures without uninstalling an already-present Quantex global package. Because self-upgrade reuses `bun add -g` against an existing install, Quantex MUST remain installed when trust cannot be completed.

#### Scenario: Trust failure after Bun self-upgrade add preserves Quantex

- GIVEN Quantex was installed via Bun global packages
- AND `quantex upgrade` successfully runs `bun add -g` for the selected Quantex package tag
- AND Bun trust inspection or trust application fails afterward
- WHEN the Bun-managed self-upgrade attempt finishes
- THEN Quantex reports the upgrade as failed
- AND it does not run `bun remove -g` against the Quantex package
- AND the previously installed Quantex CLI remains available

#### Scenario: Cancel during Bun self-upgrade trust preserves Quantex

- GIVEN Quantex was installed via Bun global packages
- AND `quantex upgrade` successfully runs `bun add -g` for the selected Quantex package tag
- AND CLI cancellation interrupts Bun trust inspection or trust application
- WHEN the Bun-managed self-upgrade attempt finishes
- THEN Quantex does not run `bun remove -g` against the Quantex package as trust-phase compensation
- AND the previously installed Quantex CLI remains available
