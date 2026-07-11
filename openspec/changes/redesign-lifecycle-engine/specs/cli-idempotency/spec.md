## ADDED Requirements

### Requirement: Idempotency records MUST bind to a canonical request fingerprint

For every persisted idempotency record, Quantex MUST derive and store a deterministic fingerprint of the normalized mutation request. A record MUST be eligible for replay only when both the caller-supplied idempotency key and the canonical request fingerprint match the current invocation.

#### Scenario: Equivalent requests produce the same fingerprint

- **GIVEN** a successful mutating request has been recorded with an idempotency key and canonical request fingerprint
- **AND** a retry expresses the same command, target, and behavior-affecting inputs in a semantically equivalent form
- **WHEN** Quantex canonicalizes the retry request
- **THEN** it derives the same request fingerprint
- **AND** the stored record remains eligible for postcondition verification

#### Scenario: Reusing a key for a different mutation does not replay

- **GIVEN** a successful mutating request has been recorded with idempotency key `<key>`
- **WHEN** a new invocation uses `<key>` but changes a behavior-affecting target, argument, or option
- **THEN** Quantex derives a different canonical request fingerprint
- **AND** it does not replay the stored result as the result of the new invocation
- **AND** it returns the stable invalid-argument outcome without overwriting the existing record

### Requirement: Idempotent replay MUST require a verified postcondition

Even when an idempotency key and canonical request fingerprint match, Quantex MUST replay the stored successful result only after a current verification confirms that the recorded operation's postcondition still holds. If the postcondition is absent, unverifiable, or no longer satisfied, Quantex MUST continue through normal lifecycle reconciliation instead of replaying the stored result.

#### Scenario: Matching request is replayed while its postcondition holds

- **GIVEN** a successful idempotency record matches the current request key and canonical fingerprint
- **AND** the record identifies a verifiable lifecycle postcondition
- **WHEN** Quantex verifies that postcondition against the live environment
- **THEN** it confirms the postcondition still holds
- **AND** it replays the stored successful result without re-executing the mutation

#### Scenario: Drift invalidates an otherwise matching replay

- **GIVEN** a successful idempotency record matches the current request key and canonical fingerprint
- **AND** the live environment has drifted from the recorded postcondition
- **WHEN** Quantex verifies the postcondition before replay
- **THEN** it does not replay the stored successful result
- **AND** it evaluates and executes the request through normal lifecycle reconciliation
