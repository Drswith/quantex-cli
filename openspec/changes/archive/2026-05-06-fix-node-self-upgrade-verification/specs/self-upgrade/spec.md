## MODIFIED Requirements

### Requirement: Managed self-upgrade MUST verify the installed version after update

Managed self-upgrade SHALL verify that the installed Quantex CLI entrypoint reports the expected version after Bun or npm reports a successful install.

#### Scenario: Managed self-upgrade verifies the installed CLI version

- GIVEN Quantex was installed via `bun` or `npm`
- AND a managed self-upgrade attempt reports success from the package manager
- WHEN Quantex re-runs the installed Quantex CLI entrypoint with `--version`
- THEN the reported version matches the upgrade target

#### Scenario: Managed self-upgrade does not confuse the host runtime with Quantex

- GIVEN the published Quantex CLI runs through a host runtime such as `node`
- AND `process.execPath` therefore points to that host runtime binary
- WHEN Quantex verifies a managed self-upgrade result
- THEN it probes the installed Quantex package entrypoint instead of the host runtime binary
- AND a host runtime version like `22.22.2` does not become the observed Quantex version

#### Scenario: Managed self-upgrade reports registry lag when verification fails

- GIVEN Quantex was installed via `bun` or `npm`
- AND the package manager reported success
- BUT the installed Quantex CLI entrypoint still reports the previous version
- WHEN Quantex finishes the upgrade attempt
- THEN the command fails instead of reporting success
- AND the output includes recovery guidance for reinstalling or retrying against a different registry
