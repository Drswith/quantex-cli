## ADDED Requirements

### Requirement: Bun-managed self-upgrade MUST NOT uninstall Quantex on trust failure

Bun-managed self-upgrade SHALL continue to install the selected package tag with `bun add -g`, and SHALL fail closed when Bun trust verification cannot complete. When Quantex was already present in Bun globals before that self-upgrade `add`, Quantex SHALL NOT remove the package with `bun remove -g` after trust verification fails.

#### Scenario: Trust probe failure after Bun self-upgrade add leaves Quantex installed

- GIVEN Quantex was installed via Bun and is present in Bun globals
- AND a Bun-managed self-upgrade runs `bun add -g` for the selected Quantex package tag
- AND that `add` exits successfully
- AND `bun pm -g untrusted` exits non-zero or cannot be executed
- WHEN Quantex evaluates the managed self-upgrade outcome
- THEN Quantex reports the upgrade attempt as failed
- AND it does not run `bun remove -g` for the Quantex package
- AND the previously installed Bun-managed Quantex package remains present
