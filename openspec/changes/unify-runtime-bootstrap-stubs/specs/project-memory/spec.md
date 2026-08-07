## ADDED Requirements

### Requirement: Agent bootstrap entries SHALL be single-sourced regular files

Every checked-in agent-specific runtime bootstrap entry SHALL be a regular file whose content is byte-identical to the one canonical template `skills/quantex-agent-runtime/bootstrap-stub.md`. An agent directory SHALL NOT reach the central runtime skill through a symbolic link, and SHALL NOT expose a different bootstrap body from the other supported agents. The project memory check SHALL enumerate every checked-in bootstrap entry, so no agent integration is exempt from parity enforcement.

#### Scenario: Maintainer adds a bootstrap entry for a new agent directory

- **WHEN** a new agent integration needs a discoverable runtime entry in the repository
- **THEN** the entry is a regular file copied byte-for-byte from `skills/quantex-agent-runtime/bootstrap-stub.md`
- **AND** its path is added to the stub set enumerated by `bun run memory:check`
- **AND** it is not created as a symbolic link to the central runtime skill or its directory

#### Scenario: A bootstrap entry drifts from the template

- **WHEN** any checked-in bootstrap entry stops matching the canonical template byte-for-byte
- **THEN** `bun run memory:check` fails and names the diverging path
- **AND** the repository test suite fails on the same parity assertion

#### Scenario: Maintainer changes the bootstrap routing text

- **WHEN** the text that routes an agent to the central runtime needs to change
- **THEN** the maintainer edits `skills/quantex-agent-runtime/bootstrap-stub.md`
- **AND** propagates the identical content to every enumerated bootstrap entry in the same change
- **AND** the full workflow body remains only in `skills/quantex-agent-runtime/SKILL.md`
