## MODIFIED Requirements

### Requirement: Supported agent catalog entries MUST stay lifecycle-focused

Quantex SHALL keep supported agent catalog metadata scoped to values that directly support installation, inspection, resolution, execution, update planning, and stable machine-readable contracts.

#### Scenario: Registering a supported agent entry

- **WHEN** Quantex defines or updates a supported agent entry
- **THEN** the entry includes only metadata that is relevant to lifecycle operations or stable identification
- **AND** that metadata may include canonical name, display name, lookup aliases, homepage, package metadata, install methods, binary name, version probe data, and self-update commands
- **AND** Quantex does not require free-form descriptive marketing copy as part of the catalog contract

#### Scenario: Validating catalog data before runtime use

- **WHEN** Quantex loads supported-agent catalog data
- **THEN** it validates every entry with the maintained Zod catalog schema before exposing the entry to CLI behavior
- **AND** invalid platform names, install method types, empty command arrays, or malformed required fields are rejected before the entry reaches lookup, inspection, install, check, update, or run behavior

#### Scenario: Exposing the catalog schema for tooling

- **WHEN** tooling needs the supported-agent catalog contract
- **THEN** Quantex provides a JSON Schema generated from the maintained Zod catalog schema
- **AND** the checked-in schema is verified against the generated schema so schema consumers do not depend on stale catalog contract data

#### Scenario: Keeping executable behavior outside catalog data

- **WHEN** an agent requires behavior that cannot be represented as JSON-compatible data
- **THEN** Quantex keeps that behavior in TypeScript behind an explicit catalog adapter or extension point
- **AND** Quantex does not hide executable behavior inside JSON catalog fields
