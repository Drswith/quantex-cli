## ADDED Requirements

### Requirement: Untracked single-agent update MUST NOT invent a preferred managed installer

When Quantex has no recorded install state for an agent that is already in `PATH`, explicit single-agent update MUST choose a managed installer only when the binary path identifies that managed source or the agent exposes exactly one updateable managed method. Quantex MUST NOT fall back to the preferred package manager among multiple managed candidates for an untracked install.

#### Scenario: Untracked npm-path install prefers npm over Bun

- GIVEN an agent binary is detected in `PATH`
- AND Quantex has no recorded install state for that agent
- AND the agent declares both Bun and npm managed install methods
- AND the resolved binary path identifies a global npm layout
- WHEN the user runs `quantex update <agent>`
- THEN Quantex selects the npm managed update path
- AND it does not run a Bun managed update for that agent

#### Scenario: Ambiguous untracked multi-managed install falls through safely

- GIVEN an agent binary is detected in `PATH`
- AND Quantex has no recorded install state for that agent
- AND the agent declares multiple updateable managed install methods
- AND the binary path does not identify a managed install source
- AND the agent exposes a self-update command
- WHEN the user runs `quantex update <agent>`
- THEN Quantex does not select a preferred managed installer such as Bun by method order alone
- AND it uses the self-update command instead

### Requirement: Managed update MUST fail closed when the package is absent

Managed package updates SHALL NOT report success for a package that the selected package manager confirms is absent from its global store. Quantex MUST treat a confirmed-absent presence probe as update failure so an update command cannot install into or claim success against the wrong managed source.

#### Scenario: Bun update refuses an absent global package

- GIVEN Quantex is about to run a Bun managed update for a package name
- AND Bun package presence probing reports that package as absent
- WHEN Quantex evaluates the managed update
- THEN Quantex does not execute the Bun update command as a successful update
- AND the Bun managed update attempt fails closed

#### Scenario: npm update refuses an absent global package

- GIVEN Quantex is about to run an npm managed update for a package name
- AND npm package presence probing reports that package as absent
- WHEN Quantex evaluates the managed update
- THEN Quantex does not execute the npm update or install-as-update command as a successful update
- AND the npm managed update attempt fails closed
