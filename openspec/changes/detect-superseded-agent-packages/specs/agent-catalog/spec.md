## ADDED Requirements

### Requirement: Catalog entries MUST declare superseded package identifiers

When an agent's upstream distribution moves to a different package identifier, the catalog entry SHALL bind its install candidates to the current identifier and SHALL additionally declare the identifiers the agent was previously distributed under. Superseded identifiers SHALL be keyed by the same package-metadata provider keys that resolve current package metadata, so a recorded install can be matched against them without inferring provider identity. A catalog entry MUST NOT declare one identifier as both a current and a superseded package under the same provider key.

#### Scenario: Declaring a superseded package identifier

- **GIVEN** an agent whose upstream package identifier changed
- **WHEN** Quantex defines that agent's catalog entry
- **THEN** the entry's install candidates bind the current package identifier
- **AND** the entry declares the previous identifier as a superseded package under the provider key that resolves it

#### Scenario: Rejecting a contradictory superseded declaration

- **GIVEN** a catalog entry that declares one identifier as both a current package and a superseded package under the same provider key
- **WHEN** Quantex loads the catalog
- **THEN** Quantex rejects the entry rather than resolving an ambiguous package identity

#### Scenario: Entry without a distribution change

- **GIVEN** an agent whose upstream package identifier has not changed
- **WHEN** Quantex defines that agent's catalog entry
- **THEN** the entry declares no superseded packages
- **AND** Quantex treats the absent declaration as an assertion that no identifier is superseded, not as missing information

### Requirement: Pi MUST resolve lifecycle through its current upstream package

Quantex SHALL bind Pi's managed install candidates to `@earendil-works/pi-coding-agent` and SHALL declare `@mariozechner/pi-coding-agent` as a superseded npm package identifier. The superseded identifier is frozen upstream and its published release carries a deprecation notice naming the current package, so Quantex MUST NOT resolve Pi lifecycle versions from it.

#### Scenario: Installing Pi

- **WHEN** Quantex renders or executes install options for Pi
- **THEN** the bun and npm candidates on Windows, macOS, and Linux bind `@earendil-works/pi-coding-agent`
- **AND** the entry continues to identify `pi` as the executable binary

#### Scenario: Recognizing a Pi install recorded under the previous package

- **GIVEN** a recorded Pi install whose package identity is `@mariozechner/pi-coding-agent`
- **WHEN** Quantex resolves Pi's lifecycle metadata
- **THEN** Quantex identifies the recorded package as superseded by `@earendil-works/pi-coding-agent`
