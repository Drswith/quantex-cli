## MODIFIED Requirements

### Requirement: Bun-managed updates MUST trust requested blocked lifecycle scripts across platform path styles

The agent update system SHALL recognize Bun global untrusted package output for requested managed packages regardless of whether Bun prints `node_modules` paths with POSIX or Windows separators. When the untrusted probe cannot be read after a successful Bun global install or update command, Quantex SHALL NOT report that managed operation as successful. When trust verification fails after a successful Bun global **install** (`add -g`) command, Quantex SHALL roll back only packages whose pre-add presence was conclusively `absent`. Packages that were already `present` or whose pre-add presence was `unknown` SHALL remain installed, and Quantex SHALL still report the install attempt as failed.

#### Scenario: Trusting a requested scoped package from Windows Bun output

- GIVEN a Bun-managed agent package was requested by `quantex install`, `quantex update <agent>`, or `quantex update --all`
- AND `bun pm -g untrusted` reports that package using a Windows-style path such as `.\node_modules\@scope\name @1.2.3`
- WHEN the Bun install or update command exits successfully
- THEN Quantex trusts the requested package lifecycle script
- AND the agent update does not leave the requested package's required postinstall blocked because of path separator parsing
- AND the managed operation is reported as successful only after trust completes successfully

#### Scenario: Ignoring unrelated blocked packages

- GIVEN a Bun-managed install or update requested one or more package names
- AND `bun pm -g untrusted` reports additional packages that were not requested
- WHEN Quantex evaluates blocked lifecycle packages
- THEN Quantex only trusts blocked packages whose names match the requested package list

#### Scenario: Failing closed when the untrusted probe is unavailable

- GIVEN a Bun-managed install or update requested one or more package names
- AND the Bun global install or update command exits successfully
- AND `bun pm -g untrusted` exits non-zero or cannot be executed
- WHEN Quantex evaluates blocked lifecycle scripts
- THEN Quantex reports the managed operation as failed
- AND it does not claim the install or update succeeded without completing trust verification

#### Scenario: Rolling back a Bun install when trust verification fails for a newly added package

- GIVEN a Bun-managed install requested one or more package names
- AND those packages were absent from the Bun global install before `bun add -g`
- AND `bun add -g` exits successfully for those packages
- AND Bun trust verification fails afterward
- WHEN Quantex evaluates the managed install outcome
- THEN Quantex removes only the packages that were absent before the add with `bun remove -g`
- AND it reports the Bun install attempt as failed
- AND a subsequent fallback install method may run without leaving a duplicate Bun global install behind

#### Scenario: Preserving an already-present Bun package when trust verification fails after add

- GIVEN a Bun-managed install requested a package name that was already present in the Bun global install
- AND `bun add -g` exits successfully for that package
- AND Bun trust verification fails afterward
- WHEN Quantex evaluates the managed install outcome
- THEN Quantex does not remove the already-present package
- AND it reports the Bun install attempt as failed

#### Scenario: Skipping untracked PATH detections during batch update

- GIVEN an agent binary is detected in `PATH`
- AND Quantex has no recorded install state for that agent
- WHEN the user runs `quantex update --all`
- THEN Quantex does not execute managed update or self-update operations for that agent
- AND the batch result explains that the agent was detected in `PATH` but is not tracked as a Quantex-managed install

#### Scenario: Adopting a safely identifiable existing install

- GIVEN an agent binary is detected in `PATH`
- AND Quantex has no recorded install state for that agent
- AND the current platform exposes exactly one supported unmanaged install method for that agent
- WHEN the user runs `quantex install <agent>` or `quantex ensure <agent>`
- THEN Quantex records that install method as the agent's install state without re-running an installer

#### Scenario: Adopting a safely identifiable existing managed install

- GIVEN an agent binary is detected in `PATH`
- AND Quantex has no recorded install state for that agent
- AND the detected binary path identifies a supported managed install source such as Bun global bin
- WHEN the user runs `quantex install <agent>` or `quantex ensure <agent>`
- THEN Quantex records that managed install method as the agent's install state without re-running an installer
- AND later lifecycle commands use that recorded managed install source

#### Scenario: Refusing to guess an ambiguous existing install source

- GIVEN an agent binary is detected in `PATH`
- AND Quantex has no recorded install state for that agent
- AND the current platform exposes multiple plausible install methods without an identifying binary path
- WHEN the user runs `quantex install <agent>` or `quantex ensure <agent>`
- THEN Quantex does not invent or overwrite install state for that agent
- AND the command explains that the install remains untracked
