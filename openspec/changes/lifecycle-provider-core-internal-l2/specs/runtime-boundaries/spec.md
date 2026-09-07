## ADDED Requirements

### Requirement: Provider-binding helpers SHALL live in Core-internal modules

Quantex SHALL own lifecycle provider-binding resolution (`LifecycleProviderBinding`, catalog/state/receipt/install-method resolvers, and equality) and `observeLifecycleProvider` in in-repo Core-internal modules under `src/core/lifecycle/`. Those modules MUST NOT be published from `src/core/index.ts` or `packages/core`. They are not dependency leaves: they MAY import agents, provider types, the Core-internal lifecycle model leaf, and type-only persisted-state types, and `observeLifecycleProvider` MAY default to the first-party provider registry. They MUST NOT import remaining `src/lifecycle` engines, CLI, or Core mutation/execution executors. `src/state` MUST NOT import provider-binding or provider-evidence modules.

#### Scenario: Core no longer imports provider-binding from src/lifecycle

- **WHEN** in-repo Core installation, uninstall, update, or production-observation modules need provider-binding helpers
- **THEN** they import those symbols from the Core-internal provider-binding module
- **AND THEN** they do not import `src/lifecycle/provider-binding`

#### Scenario: Core uninstall observes providers through Core-internal evidence

- **WHEN** in-repo Core uninstall needs `observeLifecycleProvider`
- **THEN** it imports that helper from the Core-internal provider-evidence module
- **AND THEN** it does not import `src/lifecycle/provider-evidence`

#### Scenario: State stays off binding and evidence

- **WHEN** persisted-state schema or store modules are inspected for Core imports
- **THEN** they import at most the Core-internal lifecycle model leaf
- **AND THEN** they do not import provider-binding, provider-evidence, `src/core/index.ts`, `createQuantex`, or Core executors

#### Scenario: Published SDK root stays free of binding and evidence

- **WHEN** a TypeScript consumer inspects `src/core/index.ts` or `packages/core/src/index.ts`
- **THEN** those entries do not export `LifecycleProviderBinding`, `observeLifecycleProvider`, `resolveInstallMethodProviderBinding`, or other provider-binding/evidence symbols
- **AND THEN** `createQuantex` remains the only runtime export

### Requirement: Remaining src/lifecycle engines SHALL stay outside Core until a later knife

Quantex MUST keep agent-observation, update-planner, agent-execution, uninstall-postcondition, and the `src/lifecycle` barrel outside `src/core` for the L2 provider-binding move. L2 MUST NOT delete `src/lifecycle/` and MUST NOT fold those remaining modules into Core. L2 MUST NOT add a `src/core/lifecycle/index.ts` barrel.

#### Scenario: L2 does not absorb remaining lifecycle engines

- **WHEN** the L2 provider-binding internalization is applied
- **THEN** `src/lifecycle/` still contains agent-observation, update-planner, agent-execution, uninstall-postcondition, and the barrel
- **AND THEN** `src/lifecycle/provider-binding.ts` and `src/lifecycle/provider-evidence.ts` are absent

#### Scenario: Existing non-SDK barrel may re-export binding helpers

- **WHEN** CLI services or idempotency already import provider-binding helpers from the `src/lifecycle` barrel
- **THEN** that barrel MAY re-export binding types, resolvers, and `observeLifecycleProvider` from the Core-internal modules
- **AND THEN** that re-export is not a published `quantex-core` SDK export

#### Scenario: Core-internal lifecycle directory has no barrel

- **WHEN** a contributor lists TypeScript files under `src/core/lifecycle/`
- **THEN** the directory contains the model leaf, provider-binding, and provider-evidence modules
- **AND THEN** it does not contain `index.ts`
