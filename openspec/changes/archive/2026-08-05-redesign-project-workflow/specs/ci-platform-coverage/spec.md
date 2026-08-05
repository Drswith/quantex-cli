# ci-platform-coverage Delta

## REMOVED Requirements

### Requirement: CI SHALL use honest skip semantics for conditional jobs

**Reason**: Merged into `code-quality-tooling`; the Windows pull-request exclusion no longer exists because Windows now runs on product-impacting PRs.

**Migration**: Follow the same-named requirement in `openspec/specs/code-quality-tooling/spec.md`.

### Requirement: CI SHALL run on consolidated workflow entry points

**Reason**: Merged into `code-quality-tooling`.

**Migration**: Follow the same-named requirement in `openspec/specs/code-quality-tooling/spec.md`.

### Requirement: Windows pull requests SHALL skip the full test job

**Reason**: Reversed by design: Windows coverage now gates product-impacting pull requests instead of skipping them, so the nominally required Windows check is real.

**Migration**: Follow `Windows coverage SHALL gate product-impacting pull requests` in `openspec/specs/code-quality-tooling/spec.md`.

### Requirement: Windows full tests run after integration

**Reason**: Superseded by Windows coverage on both pull requests and protected-branch pushes.

**Migration**: Follow `Windows coverage SHALL gate product-impacting pull requests` in `openspec/specs/code-quality-tooling/spec.md`.
