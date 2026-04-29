## MODIFIED Requirements

### Requirement: Supported agent catalog entries MUST expose canonical slug and executable command semantics

Quantex SHALL treat the canonical agent slug and the executable command as related but distinct catalog fields. The canonical slug is the stable Quantex identifier for lookup, docs, and catalog review, while the executable command identifies the actual CLI binary Quantex resolves and runs.

#### Scenario: A supported agent uses a product-specific executable

- **WHEN** an upstream CLI executable name is stable, product-specific, and suitable as a user-facing identifier
- **THEN** Quantex uses that executable name as the canonical slug by default
- **AND** the catalog continues to expose the same value as the executable command

#### Scenario: A supported agent uses a generic or ambiguous executable

- **WHEN** an upstream CLI executable name is too generic or ambiguous to serve as the primary Quantex identifier
- **THEN** Quantex keeps a branded canonical slug
- **AND** the catalog exposes the executable command separately
- **AND** Quantex may accept the executable command as a lookup alias when doing so improves discovery without weakening the canonical slug

### Requirement: Support-matrix documentation MUST use stable catalog review fields

Quantex SHALL document agent support reviews with a stable support-matrix field set that separates product naming, canonical identification, executable command naming, and support status.

#### Scenario: Recording a support-matrix row

- **WHEN** Quantex documents a supported, in-progress, candidate, or excluded tool in the support matrix
- **THEN** the row includes the product name, canonical slug, binary command, aliases, status, and notes
- **AND** supported rows derive their canonical slug and binary command from the implemented agent definition
- **AND** in-progress rows reference the active OpenSpec change or implementation tracker when available

#### Scenario: Reviewing an exception to the default naming rule

- **WHEN** the canonical slug does not match the executable command
- **THEN** the support matrix notes that exception explicitly
- **AND** the rationale explains why the executable command is not suitable as the primary Quantex slug
