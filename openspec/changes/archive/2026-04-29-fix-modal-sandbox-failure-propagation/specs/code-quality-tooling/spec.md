## MODIFIED Requirements

### Requirement: Optional isolation validation commands

The repository SHALL expose `bun run test:sandbox` and `bun run test:container` as optional maintainer-facing validation commands for running real Quantex agent lifecycle smoke checks inside isolated Bun environments. These commands MUST complement rather than replace the canonical local `bun run test` workflow.

#### Scenario: Modal remote command fails

- **WHEN** the remote lifecycle smoke command invoked by `bun run test:sandbox` exits non-zero
- **THEN** `bun run test:sandbox` exits non-zero even if the Modal CLI process itself reports success
- **AND** the local command output preserves enough remote stdout and stderr to diagnose the failed lifecycle stage

#### Scenario: Expanded smoke list includes opencode preinstall adoption

- **WHEN** the isolated lifecycle smoke script runs `adopt-preinstalled` for `opencode`
- **THEN** it preinstalls the `opencode-ai` package before asking Quantex to adopt the existing install

#### Scenario: Maintainer compares local and CI sandbox defaults

- **WHEN** a maintainer runs the local Docker isolation command without overriding agents
- **THEN** the lifecycle smoke script uses `pi,qoder` as the local default agent list
- **AND** the dedicated GitHub Actions sandbox workflow overrides the agent list to `pi,opencode`
