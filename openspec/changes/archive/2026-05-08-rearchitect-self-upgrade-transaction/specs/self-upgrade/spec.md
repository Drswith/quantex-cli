## MODIFIED Requirements

### Requirement: Managed self-upgrade MUST keep registry checks and installs consistent

Managed self-upgrade SHALL use the same resolved registry for package-manager version checks and managed-install execution, SHALL install the selected package tag directly instead of relying on package-manager update semantics, SHALL not treat a lower reported latest version as an update target, and SHALL freeze the chosen target version and verification strategy in an execution plan before running the provider.

#### Scenario: Managed self-upgrade suppresses stale downgrade targets

- GIVEN Quantex was installed via `bun` or `npm`
- AND the current CLI version is newer than the resolved `latestVersion` from cache or registry
- WHEN the user runs `quantex upgrade` or `quantex upgrade --check`
- THEN Quantex does not invoke managed self-upgrade toward that lower version
- AND it does not present the lower version as an available update

#### Scenario: Managed self-upgrade executes against a frozen plan

- GIVEN Quantex was installed via `bun` or `npm`
- AND self-upgrade resolution identifies an installable target version and registry
- WHEN Quantex starts a managed self-upgrade attempt
- THEN it passes one execution plan to the provider that already includes the install source, target version, resolved registry, and post-install verification probe
- AND post-install verification compares the observed installed CLI version against that same plan target instead of re-deriving the target from mutable inspection fields
