## ADDED Requirements

### Requirement: Managed install adoption MUST distinguish global npm from project-local npm

When Quantex adopts an existing PATH-detected agent as a managed npm install, it SHALL only do so when the binary path identifies a global npm layout. Project-local npm paths such as `node_modules/.bin` MUST NOT be recorded as global npm-managed installs.

#### Scenario: Refusing to adopt a project-local npm install as global npm

- GIVEN an agent binary is detected in `PATH`
- AND Quantex has no recorded install state for that agent
- AND the detected binary path is under a project-local npm layout such as `node_modules/.bin`
- WHEN the user runs `quantex install <agent>` or `quantex ensure <agent>`
- THEN Quantex does not record that agent as a global npm-managed install
- AND the command explains that the install remains untracked when the source is ambiguous

#### Scenario: Adopting a global npm-managed existing install

- GIVEN an agent binary is detected in `PATH`
- AND Quantex has no recorded install state for that agent
- AND the detected binary path identifies a global npm layout such as `/usr/local/lib/node_modules/<package>`
- WHEN the user runs `quantex install <agent>` or `quantex ensure <agent>`
- THEN Quantex records npm as the managed install method without re-running an installer
- AND later lifecycle commands use that recorded npm install source
