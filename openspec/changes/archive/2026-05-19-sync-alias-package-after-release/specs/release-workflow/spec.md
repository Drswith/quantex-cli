## ADDED Requirements

### Requirement: Release Workflow Dispatches Alias Package Sync After Npm Publish

The Release workflow SHALL notify the `Drswith/quantex` alias package repository after `quantex-cli` is successfully published to npm when `QUANTEX_SYNC_TOKEN` is configured, and it MUST NOT publish the alias package directly from the `quantex-cli` repository.

#### Scenario: Stable release dispatches latest alias sync

- **WHEN** the Release workflow successfully publishes `quantex-cli` version `0.18.0` to npm
- **AND** `QUANTEX_SYNC_TOKEN` is configured
- **THEN** it MUST send a `repository_dispatch` event to `Drswith/quantex`
- **AND** the event type MUST be `sync-quantex-cli-release`
- **AND** the client payload version MUST be `0.18.0`
- **AND** the client payload `npm_tag` MUST be `latest`

#### Scenario: Prerelease dispatches next alias sync

- **WHEN** the Release workflow successfully publishes `quantex-cli` version `0.18.0-beta.1` to npm
- **AND** `QUANTEX_SYNC_TOKEN` is configured
- **THEN** it MUST send a `repository_dispatch` event to `Drswith/quantex`
- **AND** the client payload version MUST be `0.18.0-beta.1`
- **AND** the client payload `npm_tag` MUST be `next`

#### Scenario: Alias dispatch token is not configured

- **WHEN** the Release workflow successfully publishes `quantex-cli` to npm
- **AND** `QUANTEX_SYNC_TOKEN` is not configured
- **THEN** it MUST skip the alias package synchronization dispatch
- **AND** the Release workflow MUST complete successfully so GitHub Release artifacts and npm publication are not marked failed by missing optional cross-repository credentials

#### Scenario: Npm publish does not succeed

- **WHEN** the Release workflow does not successfully publish `quantex-cli` to npm
- **THEN** it MUST NOT send the alias package synchronization dispatch
