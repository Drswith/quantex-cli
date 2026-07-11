## ADDED Requirements

### Requirement: Self-upgrade MUST remain a separate bounded context

Quantex MUST keep CLI self-upgrade observation, planning, execution, verification, and persisted evidence separate from the agent lifecycle engine. Agent lifecycle commands MUST NOT model Quantex itself as an agent or include a CLI self-upgrade unless the user invokes the explicit self-upgrade surface.

#### Scenario: Updating all agents does not upgrade Quantex itself

- **GIVEN** updates are available for one or more managed agents and for the Quantex CLI
- **WHEN** the user runs `quantex update --all`
- **THEN** Quantex plans and executes updates only for agents in the agent lifecycle catalog
- **AND** it does not replace or upgrade the Quantex CLI binary
- **AND** the CLI update remains available through the explicit `quantex upgrade` surface

### Requirement: Ordinary commands MUST NOT perform implicit self-update network checks

Commands that do not explicitly declare a self-update network effect MUST NOT contact a package registry, release service, or other remote source to discover a Quantex CLI update. Explicit self-upgrade checks, self-upgrade execution, and explicitly network-aware diagnostics SHALL perform fresh checks only when their command contract declares that network effect. If Quantex emits a passive self-update notice, it MUST derive the notice exclusively from already cached self-upgrade metadata, and evaluating that notice MUST NOT refresh the cache or otherwise perform network I/O.

#### Scenario: Ordinary command with no cached metadata stays offline

- **GIVEN** no cached self-upgrade metadata is available
- **WHEN** a successful ordinary command finalizes its output
- **THEN** Quantex does not make a network request to discover a CLI update
- **AND** it does not fabricate a passive self-update notice

#### Scenario: Passive notice uses cached metadata without refreshing it

- **GIVEN** already cached self-upgrade metadata reports an installable version newer than the running CLI
- **WHEN** a successful ordinary human-mode command evaluates a passive self-update notice
- **THEN** any notice Quantex displays is derived exclusively from that cached metadata
- **AND** it does not contact a remote source or refresh the cached metadata
