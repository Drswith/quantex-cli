## MODIFIED Requirements

### Requirement: Catalog install methods MUST come from the eligible provider set

Quantex SHALL restrict supported agent catalog entries to install methods drawn from the eligible provider set: `bun`, `npm`, `brew`, `winget`, `script`, and `binary`. These cover the Node ecosystem and native binary distribution, including operating-system package managers that ship native binaries.

Catalog entries MUST NOT declare `cargo`, `deno`, `mise`, `pip`, or `uv` install methods, and MUST NOT carry `packages` metadata whose only purpose is to describe one of those methods. An entry MUST offer at least one eligible install method on every platform it declares; a platform that would be left with no eligible method MUST be dropped from the entry rather than retained as a platform Quantex cannot install on.

Provider ineligibility is a catalog rule, not a provider removal. The `cargo`, `deno`, `mise`, `pip`, and `uv` provider implementations SHALL remain available so an installation already recorded in state continues to resolve its managed update and uninstall path through the provider that produced it.

Ineligibility binds catalog entries only. A frozen definition retained for a withdrawn agent under `compatibility-contract` MAY still declare an ineligible method, because it records what the catalog last offered rather than a route Quantex will execute. Such a definition MUST NOT be edited to satisfy this requirement.

#### Scenario: Declaring an ineligible install method

- **WHEN** a catalog entry declares a `cargo`, `deno`, `mise`, `pip`, or `uv` install method
- **THEN** the entry is rejected as outside the eligible provider set
- **AND** the rejection is independent of whether the upstream agent is genuinely distributed that way

#### Scenario: A platform is left with no eligible method

- **GIVEN** an entry whose only methods on one platform are ineligible
- **WHEN** the ineligible methods are removed
- **THEN** that platform is dropped from the entry
- **AND** the entry does not advertise a platform for which Quantex offers no install route

#### Scenario: Updating an agent installed through a now-ineligible provider

- **GIVEN** persisted state records an installation performed through `cargo`, `deno`, `mise`, `pip`, or `uv`
- **WHEN** Quantex plans an update or uninstall for that agent
- **THEN** it resolves the recorded install type rather than the entry's current catalog methods
- **AND** the managed update and uninstall paths continue to work through the recorded provider

#### Scenario: Installing an agent fresh after its provider became ineligible

- **WHEN** a user installs an agent whose ineligible method was removed
- **THEN** Quantex offers only the entry's remaining eligible methods
- **AND** no ineligible method appears in rendered install options

#### Scenario: A withdrawn agent's frozen definition declares an ineligible method

- **GIVEN** a withdrawn agent's retained definition declares an ineligible install method
- **WHEN** the catalog eligibility rule is applied
- **THEN** the retained definition is out of scope, because it is not a catalog entry
- **AND** the definition keeps the methods it carried at withdrawal
