## ADDED Requirements

### Requirement: Doctor JSON schema MUST stay aligned with doctor installer diagnostics

The machine-readable schema for `quantex doctor` SHALL enumerate every installer availability flag that structured doctor output can emit, so validators using `additionalProperties: false` accept real doctor JSON.

#### Scenario: Doctor schema includes Cargo alongside other managed installers

- **GIVEN** the user runs `quantex schema doctor` in JSON mode
- **WHEN** Quantex returns the doctor command `dataSchema`
- **THEN** `dataSchema.properties.installers.properties` includes a `cargo` boolean field
- **AND** `dataSchema.properties.installers.required` includes `cargo` together with the other managed installer keys
