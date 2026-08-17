## ADDED Requirements

### Requirement: A withdrawn catalog entry retains its v1 root export as frozen data

When an agent is withdrawn from the supported catalog and its name is part of the v1 root export snapshot, Quantex SHALL keep that symbol importable from the package root. The retained symbol is frozen data: it holds the agent definition as it stood at withdrawal, and it MUST NOT rejoin the catalog, appear in agent lookup, or be reachable from any lifecycle command.

This satisfies the compatibility facade without pretending the agent is still supported. Withdrawal removes the capability; the export survives only so downstream code that imports the symbol keeps compiling. Retained symbols SHALL be removed together as part of a future approved major change that ends the v1 export window, not individually as each agent is withdrawn.

A retained symbol MUST keep its declared type unchanged. Because the root declaration is pinned by exact bytes and digest, a change that reorders declarations MAY update that pin, but the change MUST record evidence that the declared types and the exported symbol set are unchanged.

#### Scenario: Importing a withdrawn agent

- **GIVEN** an agent has been withdrawn from the catalog
- **AND** its name was part of the v1 root export snapshot
- **WHEN** a downstream consumer imports that symbol from the package root
- **THEN** the import resolves and keeps its declared type
- **AND** the withdrawal is not a breaking change for that consumer

#### Scenario: A withdrawn agent is requested through the CLI

- **WHEN** a user or machine consumer looks up a withdrawn agent by canonical name or alias
- **THEN** Quantex reports it as an unknown agent
- **AND** the retained root export does not make it installable, updatable, or discoverable

#### Scenario: A withdrawn definition is mistaken for a catalog entry

- **WHEN** catalog listings, discovery output, or lifecycle planning enumerate supported agents
- **THEN** no retained withdrawn definition appears among them
- **AND** the retained definition is not the same object as any catalog entry

#### Scenario: Retiring the retained symbols

- **WHEN** a future approved major change ends the v1 root export window
- **THEN** the retained withdrawn symbols are removed together with the rest of that surface
- **AND** no separate deprecation window is required for each withdrawn agent, because the withdrawal already recorded one

#### Scenario: The pinned root declaration shifts without an API change

- **GIVEN** retaining a withdrawn symbol moves declarations within the emitted declaration file
- **WHEN** the change updates the pinned byte count and digest
- **THEN** it records that the declared types and the exported symbol set are unchanged
- **AND** the update is not treated as a v1 surface change
