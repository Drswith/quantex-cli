## ADDED Requirements

### Requirement: README documents the public Core SDK identity

The product README SHALL document `quantex-core` as the installable TypeScript SDK and SHALL use only its public root import in examples. It MUST distinguish Core npm publication from the independent CLI release path.

#### Scenario: a TypeScript consumer follows the SDK guide
- **WHEN** the consumer reads the English or Simplified Chinese README
- **THEN** it can install `quantex-core` and import `createQuantex` from `quantex-core`
- **AND** it is not instructed to use the provisional scoped identity
