## ADDED Requirements

### Requirement: Core implementation SHALL live under packages/core/src

Quantex SHALL own in-repo Core runtime implementation under `packages/core/src`. Root `src/core/` MUST NOT contain Core runtime modules, generated Core catalogs, or a re-export shim of the Core package. `packages/core/src/index.ts` and `packages/core/src/internal.ts` MUST implement or re-export local Core modules and MUST NOT re-export `../../../src/core` or any other root `src/core` path.

#### Scenario: Package source owns Core implementation

- **WHEN** a contributor inspects `packages/core/src`
- **THEN** that tree contains the Core client, types, invocation, production observation, mutation engines, lifecycle helpers, and generated catalogs
- **AND THEN** `packages/core/src/index.ts` does not import `src/core`

#### Scenario: Root src/core is absent

- **WHEN** a contributor lists TypeScript files under root `src/core/`
- **THEN** that directory is absent, or it contains no `.ts` implementation
- **AND THEN** CLI production modules do not import `src/core`

### Requirement: Dependency direction SHALL be CLI to Core

Quantex SHALL allow CLI shell, presentation, commands, services, compatibility, and in-repo tests to import Core. Core modules under `packages/core/src` MUST NOT import CLI shell, presentation, command, config, services, compatibility, idempotency, planning, inspection, `src/self`, `src/runtime/cli-operation-context`, or presentation utils (`src/utils/user-output`, `src/utils/color`, `src/utils/cli-child-process`). Core MUST NOT value-import the `src/runtime` barrel that re-exports CLI operation context.

#### Scenario: Core source has no direct CLI shell imports

- **WHEN** architecture tests inspect import specifiers under `packages/core/src`
- **THEN** they fail if a Core module imports a CLI-owned path
- **AND THEN** they pass when Core imports only Core-local modules or documented shared/neutral modules

#### Scenario: CLI may import Core internals without publishing them

- **WHEN** a CLI production bridge needs an unpublished Core engine
- **THEN** it imports that module from `packages/core/src` or `quantex-core/internal`
- **AND THEN** `packages/core/package.json` exports remain `.` and `./package.json`

### Requirement: Shared infrastructure SHALL remain a documented neutral exception until a later knife

Until a separately approved ownership change, Quantex SHALL keep `src/agents`, `src/providers`, `src/state`, `src/package-manager`, `src/runtime` except `cli-operation-context`, `src/agent-update`, and non-presentation `src/utils` in root `src/` as shared/neutral modules. Core MAY import those modules. Architecture tests MUST allowlist those edges and MUST fail on undocumented Core → CLI leaks. `src/package-manager/index.ts` MAY keep its existing CLI `cli-context` / `config` coupling as a named deferred exception; that coupling MUST NOT be treated as permission to import CLI shell from Core directly.

#### Scenario: Core may import documented shared modules

- **WHEN** a Core engine needs catalog types, provider adapters, state schema, package-manager installers, runtime ports, or agent-update helpers
- **THEN** it may import those modules from root `src/`
- **AND THEN** architecture tests list those directories as allowed exceptions

#### Scenario: New Core to CLI leaks fail

- **WHEN** a Core module adds a direct import of `src/commands`, `src/cli-context`, `src/self`, or another CLI-owned path
- **THEN** the architecture test fails
- **AND THEN** the deferred package-manager exception does not authorize that new edge

### Requirement: Reverse imports into Core SHALL be limited to the documented type leaf

Outside CLI-owned modules, root `src/` MUST NOT import Core runtime (`packages/core/src/index.ts`, `createQuantex`, mutation/execution/self-upgrade/doctor executors). `src/state` and `src/package-manager/index.ts` MAY import `packages/core/src/lifecycle/model.ts` only. Undocumented cycles through Core runtime MUST fail architecture tests.

#### Scenario: State still imports only the model leaf

- **WHEN** persisted-state schema or store modules are inspected for Core imports
- **THEN** they import the Core-internal lifecycle model leaf at `packages/core/src/lifecycle/model.ts`
- **AND THEN** they do not import Core runtime, provider-binding, or other lifecycle engines

#### Scenario: Undocumented Core runtime cycles fail

- **WHEN** architecture tests detect a cycle that includes a Core runtime module and a non-CLI root module through anything other than the model leaf
- **THEN** the test fails
- **AND THEN** the documented state/package-manager leaf reverse edges still pass

### Requirement: Architecture tests SHALL prove Core source ownership

The repository SHALL keep AST or import-graph architecture tests that (1) require Core implementation to live under `packages/core/src`, (2) forbid root `src/core` runtime files, (3) forbid Core → CLI shell edges, (4) forbid undocumented cycles, and (5) allow the documented type-leaf reverse edges and shared-module exceptions. Those tests MUST continue to prove lazy mutation loading, the published Core export freeze, and the absence of engine/route identifiers on the public SDK entry.

#### Scenario: Physical ownership regression fails CI

- **WHEN** a change reintroduces `packages/core/src` re-exports of root `src/core`, or restores Core runtime under `src/core`
- **THEN** the architecture test fails

#### Scenario: Published SDK and lazy mutation stay frozen

- **WHEN** architecture tests inspect `packages/core/src/index.ts` and the eager public runtime closure
- **THEN** the runtime export remains `createQuantex`
- **AND THEN** mutation production modules stay outside the eager closure
- **AND THEN** `src/providers/first-party.ts` stays outside that public closure

## MODIFIED Requirements

### Requirement: Lifecycle receipt types SHALL live in a Core-internal leaf

Quantex SHALL own agent lifecycle receipt, observation, plan, and outcome TypeScript types plus `LIFECYCLE_RECEIPT_SCHEMA_VERSION` in an in-repo Core-internal module under `packages/core/src/lifecycle/`. That module MUST be a dependency leaf: it MUST NOT import Core runtime, `src/state`, remaining `src/lifecycle` engines, CLI, or providers. `src/state` MAY import that leaf (including a value re-export of the receipt schema constant) and MUST NOT import Core runtime modules such as `packages/core/src/index.ts`, `createQuantex`, or mutation/execution executors. Relocating the types MUST NOT, by itself, expand the published `quantex-core` package export surface.

#### Scenario: Core no longer imports lifecycle model from src/lifecycle

- **WHEN** in-repo Core installation, uninstall, or update modules need `LifecycleReceipt` or `LIFECYCLE_RECEIPT_SCHEMA_VERSION`
- **THEN** they import those symbols from the Core-internal leaf
- **AND THEN** they do not import `src/lifecycle/model`

#### Scenario: State shares the leaf without depending on Core runtime

- **WHEN** persisted-state schema or store modules type lifecycle receipts
- **THEN** they import from the Core-internal leaf
- **AND THEN** they do not import `packages/core/src/index.ts`, `createQuantex`, or Core executors

#### Scenario: Published SDK root stays free of the leaf

- **WHEN** a TypeScript consumer inspects `packages/core/src/index.ts`
- **THEN** that entry does not export `LifecycleReceipt`, `LifecycleObservation`, `LIFECYCLE_RECEIPT_SCHEMA_VERSION`, or other lifecycle-model symbols
- **AND THEN** `createQuantex` remains the only runtime export

### Requirement: Remaining src/lifecycle engines SHALL stay outside Core until a later knife

The later knife is L4. Quantex MUST keep lifecycle helpers as Core-internal modules under `packages/core/src/lifecycle/` and MUST NOT restore `src/lifecycle/`. Remaining in-repo callers MUST import those Core-internal modules directly. L4 MUST NOT add a `packages/core/src/lifecycle/index.ts` barrel and MUST NOT publish those modules from `packages/core/src/index.ts` or the published `quantex-core` package. `src/state` MUST still import only the Core-internal lifecycle model leaf.

#### Scenario: L4 deletes the leftover lifecycle barrel

- **WHEN** the L4 barrel deletion is applied
- **THEN** `src/lifecycle/` is absent
- **AND THEN** `packages/core/src/lifecycle/index.ts` is also absent

#### Scenario: Remaining callers import Core-internal modules directly

- **WHEN** CLI services or idempotency need lifecycle types or helpers previously imported from the `src/lifecycle` barrel
- **THEN** they import those symbols from the matching Core-internal module under `packages/core/src/lifecycle/`
- **AND THEN** they do not import `src/lifecycle`

### Requirement: Provider-binding helpers SHALL live in Core-internal modules

Quantex SHALL own lifecycle provider-binding resolution (`LifecycleProviderBinding`, catalog/state/receipt/install-method resolvers, and equality) and `observeLifecycleProvider` in in-repo Core-internal modules under `packages/core/src/lifecycle/`. Those modules MUST NOT be published from `packages/core/src/index.ts` or the published `quantex-core` package. They are not dependency leaves: they MAY import agents, provider types, the Core-internal lifecycle model leaf, and type-only persisted-state types, and `observeLifecycleProvider` MAY default to the first-party provider registry. They MUST NOT import remaining `src/lifecycle` engines, CLI, or Core mutation/execution executors. `src/state` MUST NOT import provider-binding or provider-evidence modules.

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
- **AND THEN** they do not import provider-binding, provider-evidence, `packages/core/src/index.ts`, `createQuantex`, or Core executors

#### Scenario: Published SDK root stays free of binding and evidence

- **WHEN** a TypeScript consumer inspects `packages/core/src/index.ts`
- **THEN** that entry does not export `LifecycleProviderBinding`, `observeLifecycleProvider`, `resolveInstallMethodProviderBinding`, or other provider-binding/evidence symbols
- **AND THEN** `createQuantex` remains the only runtime export

### Requirement: Agent observation and remaining lifecycle engines SHALL live in Core-internal modules

Quantex SHALL own agent lifecycle observation (`observeAgentLifecycle`), update planning (`planLifecycleUpdate`), execution preflight (`planAgentExecutionPreflight`), and uninstall postcondition retry (`waitForUninstallAbsence`) in in-repo Core-internal modules under `packages/core/src/lifecycle/`. Those modules MUST NOT be published from `packages/core/src/index.ts` or the published `quantex-core` package. They are not dependency leaves: they MAY import agents, providers, the Core-internal lifecycle model leaf, sibling Core-internal lifecycle modules, type-only persisted-state types, and existing utils. They MUST NOT import CLI, services, planning, or Core mutation/execution executors. `src/state` MUST NOT import these modules.

#### Scenario: Core no longer imports agent-observation from src/lifecycle

- **WHEN** in-repo Core production-observation or update-production modules need `observeAgentLifecycle`
- **THEN** they import those symbols from the Core-internal agent-observation module
- **AND THEN** they do not import `src/lifecycle/agent-observation`

#### Scenario: Core update planning uses Core-internal update-planner

- **WHEN** in-repo Core update-production or update-executor modules need `planLifecycleUpdate`
- **THEN** they import those symbols from the Core-internal update-planner module
- **AND THEN** they do not import `src/lifecycle/update-planner` or the `src/lifecycle` barrel for that helper

#### Scenario: Core execution preflight uses Core-internal agent-execution

- **WHEN** in-repo Core execution-executor needs `planAgentExecutionPreflight`
- **THEN** it imports that helper from the Core-internal agent-execution module
- **AND THEN** it does not import the `src/lifecycle` barrel for that helper

#### Scenario: Core uninstall postcondition uses Core-internal helper

- **WHEN** in-repo Core uninstall needs `waitForUninstallAbsence`
- **THEN** it imports that helper from the Core-internal uninstall-postcondition module
- **AND THEN** it does not import `src/lifecycle/uninstall-postcondition`

#### Scenario: State stays off the moved engines

- **WHEN** persisted-state schema or store modules are inspected for Core imports
- **THEN** they import at most the Core-internal lifecycle model leaf
- **AND THEN** they do not import agent-observation, update-planner, agent-execution, uninstall-postcondition, `packages/core/src/index.ts`, `createQuantex`, or Core executors

#### Scenario: Published SDK root stays free of the moved engines

- **WHEN** a TypeScript consumer inspects `packages/core/src/index.ts`
- **THEN** that entry does not export `observeAgentLifecycle`, `planLifecycleUpdate`, `planAgentExecutionPreflight`, `waitForUninstallAbsence`, or other L3 engine symbols
- **AND THEN** `createQuantex` remains the only runtime export

### Requirement: Remaining CLI services and idempotency SHALL import Core-internal lifecycle modules directly

Quantex SHALL import leftover barrel consumers onto Core-internal modules. `src/services/lifecycle-execution-production.ts` MUST import `LifecycleOutcome` from the Core-internal model leaf. `src/idempotency/lifecycle-policy.ts` MUST import receipt types from the model leaf and provider-binding/evidence helpers from the Core-internal binding/evidence modules. Related tests that imported `src/lifecycle` MUST retarget the same way. Those imports MUST NOT become published `quantex-core` SDK exports.

#### Scenario: Execution production no longer imports the lifecycle barrel

- **WHEN** `lifecycle-execution-production` needs `LifecycleOutcome`
- **THEN** it imports that type from `packages/core/src/lifecycle/model`
- **AND THEN** it does not import `src/lifecycle`

#### Scenario: Lifecycle policy no longer imports the lifecycle barrel

- **WHEN** `lifecycle-policy` needs receipt types or provider observation/binding helpers
- **THEN** it imports those symbols from `packages/core/src/lifecycle/model` and the Core-internal provider-binding/evidence modules
- **AND THEN** it does not import `src/lifecycle`

#### Scenario: Related tests follow the same retarget

- **WHEN** command, service, idempotency, compatibility, or `test/lifecycle` files previously imported `src/lifecycle`
- **THEN** they import the matching Core-internal module
- **AND THEN** they do not import `src/lifecycle`

### Requirement: Core-internal lifecycle directory MUST remain barrel-free after src/lifecycle deletion

Quantex MUST NOT add `packages/core/src/lifecycle/index.ts` when deleting `src/lifecycle/` or when relocating Core into `packages/core/src`. Contributors MUST import Core-internal lifecycle files directly. The published SDK root MUST stay free of those symbols.

#### Scenario: Core-internal lifecycle directory has no barrel after L4

- **WHEN** a contributor lists TypeScript files under `packages/core/src/lifecycle/`
- **THEN** the directory contains the model leaf, provider-binding, provider-evidence, agent-observation, update-planner, agent-execution, and uninstall-postcondition modules
- **AND THEN** it does not contain `index.ts`

#### Scenario: Published SDK root stays free of lifecycle helpers after barrel deletion

- **WHEN** a TypeScript consumer inspects `packages/core/src/index.ts`
- **THEN** that entry does not export lifecycle receipt types, observation helpers, planner helpers, or provider-binding helpers
- **AND THEN** `createQuantex` remains the only runtime export
