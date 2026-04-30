## ADDED Requirements

### Requirement: OpenHands CLI MUST be a supported lifecycle agent

Quantex SHALL include OpenHands CLI in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up OpenHands CLI

- **WHEN** a user or machine consumer looks up the canonical agent name `openhands`
- **THEN** Quantex returns a supported agent entry for OpenHands CLI
- **AND** the entry identifies `openhands` as the executable binary
- **AND** the entry identifies `https://docs.openhands.dev/openhands/usage/cli/installation` as the homepage

#### Scenario: Installing OpenHands CLI through supported methods

- **WHEN** Quantex renders or executes install options for OpenHands CLI
- **THEN** macOS and Linux include the official `uv` install command option (`uv tool install openhands --python 3.12`)
- **AND** macOS and Linux include the official install script option (`curl -fsSL https://install.openhands.dev/install.sh | sh`)
- **AND** the catalog does not advertise a native Windows install method because upstream CLI docs require Windows users to run inside WSL

#### Scenario: Probing OpenHands CLI version

- **WHEN** Quantex probes the installed version of OpenHands CLI
- **THEN** it runs `openhands --version` and parses the output

#### Scenario: Planning OpenHands CLI updates

- **WHEN** Quantex plans an update for an OpenHands CLI installation
- **THEN** the catalog exposes `uv tool upgrade openhands --python 3.12` as the documented update command
