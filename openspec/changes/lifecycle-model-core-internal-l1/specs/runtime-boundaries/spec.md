## ADDED Requirements

### Requirement: Lifecycle receipt types SHALL live in a Core-internal leaf

Quantex SHALL own agent lifecycle receipt, observation, plan, and outcome TypeScript types plus `LIFECYCLE_RECEIPT_SCHEMA_VERSION` in an in-repo Core-internal module under `src/core/`. That module MUST be a dependency leaf: it MUST NOT import Core runtime, `src/state`, remaining `src/lifecycle` engines, CLI, or providers. `src/state` MAY import that leaf (including a value re-export of the receipt schema constant) and MUST NOT import Core runtime modules such as `src/core/index.ts`, `createQuantex`, or mutation/execution executors. Relocating the types MUST NOT, by itself, expand the published `quantex-core` package export surface.

#### Scenario: Core no longer imports lifecycle model from src/lifecycle

- **WHEN** in-repo Core installation, uninstall, or update modules need `LifecycleReceipt` or `LIFECYCLE_RECEIPT_SCHEMA_VERSION`
- **THEN** they import those symbols from the Core-internal leaf
- **AND THEN** they do not import `src/lifecycle/model`

#### Scenario: State shares the leaf without depending on Core runtime

- **WHEN** persisted-state schema or store modules type lifecycle receipts
- **THEN** they import from the Core-internal leaf
- **AND THEN** they do not import `src/core/index.ts`, `createQuantex`, or Core executors

#### Scenario: Published SDK root stays free of the leaf

- **WHEN** a TypeScript consumer inspects `src/core/index.ts` or `packages/core/src/index.ts`
- **THEN** those entries do not export `LifecycleReceipt`, `LifecycleObservation`, `LIFECYCLE_RECEIPT_SCHEMA_VERSION`, or other lifecycle-model symbols
- **AND THEN** `createQuantex` remains the only runtime export

### Requirement: Remaining src/lifecycle engines SHALL stay outside Core until a later knife

Quantex MUST keep provider-binding, provider-evidence, agent-observation, update-planner, agent-execution, uninstall-postcondition, and the `src/lifecycle` barrel outside `src/core` for the L1 model move. L1 MUST NOT delete `src/lifecycle/` and MUST NOT fold those remaining modules into Core.

#### Scenario: L1 does not absorb remaining lifecycle engines

- **WHEN** the L1 model internalization is applied
- **THEN** `src/lifecycle/` still contains the remaining engine modules listed above
- **AND THEN** `src/lifecycle/model.ts` is absent

#### Scenario: Existing non-SDK barrel may re-export leaf types

- **WHEN** CLI services or Core modules already import lifecycle types from the `src/lifecycle` barrel
- **THEN** that barrel MAY re-export types and the receipt schema constant from the Core-internal leaf
- **AND THEN** that re-export is not a published `quantex-core` SDK export
