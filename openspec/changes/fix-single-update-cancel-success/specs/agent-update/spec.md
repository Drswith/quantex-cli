## ADDED Requirements

### Requirement: Single-agent update MUST report failure when cancellation interrupts processing

Single-agent `quantex update <agent>` SHALL NOT report overall command success when the CLI context is cancelled after update execution begins. The command result MUST use a cancellation failure code and MAY include any partial `results` already produced for that agent.

#### Scenario: Single-agent update reports failure when cancellation interrupts processing

- **GIVEN** the user runs `quantex update <agent>`
- **AND** Quantex begins updating that tracked agent
- **WHEN** the CLI context becomes cancelled before the command returns success
- **THEN** Quantex does not report overall command success
- **AND** the command result uses a cancellation failure code
- **AND** any update outcome already recorded for that agent remains listed in the partial `results` payload
