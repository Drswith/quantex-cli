## ADDED Requirements

### Requirement: Install candidates MUST bind provider and package identity once

Each install candidate in the supported agent catalog MUST bind one provider identity to the exact provider-specific package, tool, formula, cask, script, or binary reference used by that candidate. Quantex SHALL preserve that binding through candidate selection and lifecycle receipts so later inspection, update, and uninstall work does not reconstruct identity from unrelated catalog fields.

#### Scenario: Selected candidate carries one bound lifecycle identity

- **GIVEN** an agent offers separate npm and Homebrew install candidates
- **AND** each candidate binds its own provider and provider-specific package identity
- **WHEN** Quantex selects the npm candidate for installation
- **THEN** the resulting lifecycle receipt identifies the npm provider and the npm package bound to that candidate
- **AND** later lifecycle planning does not substitute the Homebrew identity or infer a package from another candidate

### Requirement: Install candidates MUST expose declarative lifecycle probes

Each install candidate SHALL declare the provider and executable probes available for observing package presence, executable presence, installed version, and available target version. Quantex MUST treat an undeclared probe as an unsupported capability rather than inventing agent-specific probe behavior outside the catalog binding.

#### Scenario: Lifecycle observation uses candidate probe declarations

- **GIVEN** an install candidate declares provider-package presence and installed-version probes
- **WHEN** Quantex observes lifecycle state for an installation associated with that candidate
- **THEN** Quantex invokes the declared probes against the candidate's bound provider and package identity
- **AND** it does not infer live provider state solely from a receipt or executable presence in `PATH`

#### Scenario: Missing target-version probe remains explicit

- **GIVEN** an install candidate does not declare an available-target-version probe
- **WHEN** Quantex inspects the candidate's update capabilities
- **THEN** Quantex treats target-version discovery as unsupported for that candidate
- **AND** it does not fabricate a target version from unrelated package metadata
