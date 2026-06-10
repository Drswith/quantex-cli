## ADDED Requirements

### Requirement: Idempotency filenames MUST be collision-safe for distinct client keys

Quantex SHALL map each distinct `--idempotency-key` value to a distinct on-disk record filename so sanitization cannot merge unrelated client keys.

#### Scenario: Distinct keys that previously sanitized to the same filename remain independent

- GIVEN a successful mutating command stored with idempotency key `job-1/install/codex`
- WHEN a different mutating command is invoked with idempotency key `job-1_install_codex`
- THEN Quantex does not replay the first command's stored result
- AND it executes the new command work independently
