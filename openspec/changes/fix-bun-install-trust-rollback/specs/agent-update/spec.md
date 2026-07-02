## MODIFIED Requirements

### Requirement: Bun-managed updates MUST trust requested blocked lifecycle scripts across platform path styles

The agent update system SHALL recognize Bun global untrusted package output for requested managed packages regardless of whether Bun prints `node_modules` paths with POSIX or Windows separators. When the untrusted probe cannot be read after a successful Bun global install or update command, Quantex SHALL NOT report that managed operation as successful. When trust verification fails after a successful Bun global **install** command, Quantex SHALL roll back the newly added package before reporting install failure.

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

#### Scenario: Rolling back a Bun install when trust verification fails

- GIVEN a Bun-managed install requested one or more package names
- AND `bun add -g` exits successfully for those packages
- AND Bun trust verification fails afterward
- WHEN Quantex evaluates the managed install outcome
- THEN Quantex removes the packages that were just added with `bun remove -g`
- AND it reports the Bun install attempt as failed
- AND a subsequent fallback install method may run without leaving a duplicate Bun global install behind
