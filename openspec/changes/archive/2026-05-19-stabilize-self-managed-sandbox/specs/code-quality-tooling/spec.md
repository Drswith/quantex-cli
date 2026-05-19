## MODIFIED Requirements

### Requirement: Optional isolation validation commands

The repository SHALL expose `bun run test:sandbox` and `bun run test:container` as optional maintainer-facing validation commands for running real Quantex agent lifecycle smoke checks inside isolated Bun environments. These commands MUST complement rather than replace the canonical local `bun run test` workflow.

#### Scenario: Isolation smoke includes Bun-managed self-upgrade

- **WHEN** the isolated lifecycle smoke script runs the default self-upgrade coverage
- **THEN** it seeds a Bun-managed Quantex install from a sandbox-local registry at a version older than the current checkout package
- **AND** that sandbox-local registry publishes both packument and version-endpoint metadata rich enough for Bun to create the global `qtx` entrypoint and link Quantex runtime dependencies
- **AND** the seeded install runs under an isolated `HOME` with a `.bun` layout so Quantex detects the install source as Bun-managed
- **AND** the smoke executes `qtx` from Bun's reported global bin directory instead of assuming the entrypoint is always under `$BUN_INSTALL/bin`
- **AND** `quantex upgrade --check --no-cache` reports that a newer self version is available from that local registry
- **AND** `quantex upgrade --no-cache` upgrades the managed install to the current checkout package version
- **AND** the upgraded sandbox `qtx --version` output matches that current checkout package version
