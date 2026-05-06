# State persistence

## Purpose

Ensure `state.json` round-trips preserve forward-compatible data under `self`.

## ADDED Requirements

### Requirement: Unknown `self` keys MUST survive mutateState write-backs

Quantex SHALL preserve every key on the persisted `self` object when loading state for a mutation, so that writing `state.json` after a mutation does not remove keys that are not represented in the in-memory `SelfState` TypeScript interface.

#### Scenario: unknown self key survives mutateState

- **Given** `state.json` contains `self` with a key that is not part of the typed `SelfState` fields
- **When** Quantex performs a state mutation that reads, updates, and writes `state.json`
- **Then** the unknown key remains in `state.json` after the write
