## MODIFIED Requirements

### Requirement: Remaining src/lifecycle engines SHALL stay outside Core until a later knife

The later knife is L4. Quantex MUST keep lifecycle helpers as Core-internal modules under `src/core/lifecycle/` and MUST NOT restore `src/lifecycle/`. Remaining in-repo callers MUST import those Core-internal modules directly. L4 MUST NOT add a `src/core/lifecycle/index.ts` barrel and MUST NOT publish those modules from `src/core/index.ts` or `packages/core`. `src/state` MUST still import only the Core-internal lifecycle model leaf.

#### Scenario: L4 deletes the leftover lifecycle barrel

- **WHEN** the L4 barrel deletion is applied
- **THEN** `src/lifecycle/` is absent
- **AND THEN** `src/core/lifecycle/index.ts` is also absent

#### Scenario: Remaining callers import Core-internal modules directly

- **WHEN** CLI services or idempotency need lifecycle types or helpers previously imported from the `src/lifecycle` barrel
- **THEN** they import those symbols from the matching Core-internal module under `src/core/lifecycle/`
- **AND THEN** they do not import `src/lifecycle`

## ADDED Requirements

### Requirement: Remaining CLI services and idempotency SHALL import Core-internal lifecycle modules directly

Quantex SHALL import leftover barrel consumers onto Core-internal modules. `src/services/lifecycle-execution-production.ts` MUST import `LifecycleOutcome` from the Core-internal model leaf. `src/idempotency/lifecycle-policy.ts` MUST import receipt types from the model leaf and provider-binding/evidence helpers from the Core-internal binding/evidence modules. Related tests that imported `src/lifecycle` MUST retarget the same way. Those imports MUST NOT become published `quantex-core` SDK exports.

#### Scenario: Execution production no longer imports the lifecycle barrel

- **WHEN** `lifecycle-execution-production` needs `LifecycleOutcome`
- **THEN** it imports that type from `src/core/lifecycle/model`
- **AND THEN** it does not import `src/lifecycle`

#### Scenario: Lifecycle policy no longer imports the lifecycle barrel

- **WHEN** `lifecycle-policy` needs receipt types or provider observation/binding helpers
- **THEN** it imports those symbols from `src/core/lifecycle/model` and the Core-internal provider-binding/evidence modules
- **AND THEN** it does not import `src/lifecycle`

#### Scenario: Related tests follow the same retarget

- **WHEN** command, service, idempotency, compatibility, or `test/lifecycle` files previously imported `src/lifecycle`
- **THEN** they import the matching Core-internal module
- **AND THEN** they do not import `src/lifecycle`

### Requirement: Core-internal lifecycle directory MUST remain barrel-free after src/lifecycle deletion

Quantex MUST NOT add `src/core/lifecycle/index.ts` when deleting `src/lifecycle/`. Contributors MUST import Core-internal lifecycle files directly. The published SDK root MUST stay free of those symbols.

#### Scenario: Core-internal lifecycle directory has no barrel after L4

- **WHEN** a contributor lists TypeScript files under `src/core/lifecycle/`
- **THEN** the directory contains the model leaf, provider-binding, provider-evidence, agent-observation, update-planner, agent-execution, and uninstall-postcondition modules
- **AND THEN** it does not contain `index.ts`

#### Scenario: Published SDK root stays free of lifecycle helpers after barrel deletion

- **WHEN** a TypeScript consumer inspects `src/core/index.ts` or `packages/core/src/index.ts`
- **THEN** those entries do not export lifecycle receipt types, observation helpers, planner helpers, or provider-binding helpers
- **AND THEN** `createQuantex` remains the only runtime export
