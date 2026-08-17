## ADDED Requirements

### Requirement: Catalog membership is a maintainer commitment that MAY be withdrawn

The supported agent catalog SHALL represent the set of agents Quantex commits to keeping installable, probeable, updatable, and canary-verified. Membership is not an archival record of every agent that has ever been supported. A maintainer MAY withdraw an entry when its adoption no longer justifies the standing support obligation, provided the withdrawal is recorded in an approved change that states the basis.

A withdrawal SHALL NOT be described as an upstream defect, deprecation, or abandonment unless the change records evidence for that claim. Withdrawing an entry SHALL NOT remove the install provider it used, because provider support is scoped to the provider, not to any catalog consumer. When the withdrawn name is part of the v1 root export snapshot, the symbol is retained as frozen data under `compatibility-contract`, so a withdrawal is not by itself a breaking change.

#### Scenario: Withdrawing an entry whose upstream is healthy

- **GIVEN** a catalog entry whose upstream project is actively maintained
- **WHEN** an approved change withdraws it for adoption reasons
- **THEN** the change records the measured adoption basis and the measurement date
- **AND** the change does not assert that the upstream project is abandoned, deprecated, or defective

#### Scenario: Withdrawing the last consumer of an install provider

- **GIVEN** a catalog entry is the only entry using a given install provider
- **WHEN** that entry is withdrawn
- **THEN** the provider implementation remains supported
- **AND** its behavior remains covered by tests that do not depend on catalog membership

#### Scenario: Looking up a withdrawn entry

- **WHEN** a user or machine consumer looks up a canonical name or alias that has been withdrawn
- **THEN** Quantex reports it as an unknown agent through the same path as any other unrecognized name
- **AND** no partial entry, placeholder, or tombstone appears in catalog listings or discovery output

#### Scenario: A user already installed a withdrawn agent

- **GIVEN** persisted state records an installation of an agent that has since been withdrawn
- **WHEN** Quantex reads that state
- **THEN** it preserves the record without rewriting or deleting it
- **AND** it reports the agent as untracked rather than failing the invocation

## REMOVED Requirements

### Requirement: ForgeCode MUST be a supported lifecycle agent

**Reason**: Withdrawn as part of narrowing the supported catalog to agents with adoption that justifies the standing per-entry support obligation. Measured 2026-08-17, `forgecode` served 2,970 npm downloads in the preceding month, against 18,943 for the lowest retained npm-distributed entry (`codewhale`). The upstream project (`tailcallhq/forgecode`, 7,491 stars, last pushed 2026-08-16) is actively maintained; this withdrawal is a Quantex scope decision, not an upstream defect.

**Migration**: Install ForgeCode directly through its own documented installers at `https://forgecode.dev` (`npm i -g forgecode`, `bun add -g forgecode`, or the official install script). Quantex no longer resolves the canonical name `forgecode` or the alias `forge`. `forgecode` was added after the v1 root-export snapshot and is not a v1 root export, so no downstream import breaks.

### Requirement: VTCode MUST be a supported lifecycle agent

**Reason**: Withdrawn as part of the same catalog narrowing. Measured 2026-08-17, `vtcode` served 2,846 crates.io downloads in the preceding 90 days across a 28,623 all-time total. The upstream project (`vinhnx/vtcode`, 807 stars, last pushed 2026-08-16) is actively maintained; this withdrawal is a Quantex scope decision, not an upstream defect.

**Migration**: Install VTCode directly through its own documented installers at `https://github.com/vinhnx/vtcode` (`brew install vtcode` or the official install script). The `vtcode` root export is retained as frozen data, so downstream code importing it keeps compiling; only Quantex's lifecycle support for the agent ends.
