## ADDED Requirements

### Requirement: Agent observation and remaining lifecycle engines SHALL live in Core-internal modules

Quantex SHALL own agent lifecycle observation (`observeAgentLifecycle`), update planning (`planLifecycleUpdate`), execution preflight (`planAgentExecutionPreflight`), and uninstall postcondition retry (`waitForUninstallAbsence`) in in-repo Core-internal modules under `src/core/lifecycle/`. Those modules MUST NOT be published from `src/core/index.ts` or `packages/core`. They are not dependency leaves: they MAY import agents, providers, the Core-internal lifecycle model leaf, sibling Core-internal lifecycle modules, type-only persisted-state types, and existing utils. They MUST NOT import CLI, services, planning, or Core mutation/execution executors. `src/state` MUST NOT import these modules.

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
- **AND THEN** they do not import agent-observation, update-planner, agent-execution, uninstall-postcondition, `src/core/index.ts`, `createQuantex`, or Core executors

#### Scenario: Published SDK root stays free of the moved engines

- **WHEN** a TypeScript consumer inspects `src/core/index.ts` or `packages/core/src/index.ts`
- **THEN** those entries do not export `observeAgentLifecycle`, `planLifecycleUpdate`, `planAgentExecutionPreflight`, `waitForUninstallAbsence`, or other L3 engine symbols
- **AND THEN** `createQuantex` remains the only runtime export

### Requirement: Remaining src/lifecycle barrel SHALL stay outside Core until a later knife

Quantex MUST keep the `src/lifecycle` barrel outside `src/core` for the L3 engines move. L3 MUST NOT delete `src/lifecycle/` and MUST NOT fold that barrel into Core. L3 MUST NOT add a `src/core/lifecycle/index.ts` barrel.

#### Scenario: L3 does not delete the lifecycle barrel

- **WHEN** the L3 engines internalization is applied
- **THEN** `src/lifecycle/` still contains the barrel `index.ts`
- **AND THEN** `src/lifecycle/agent-observation.ts`, `src/lifecycle/update-planner.ts`, `src/lifecycle/agent-execution.ts`, and `src/lifecycle/uninstall-postcondition.ts` are absent

#### Scenario: Existing non-SDK barrel may re-export moved helpers

- **WHEN** CLI services, planning, or idempotency already import observation, planner, or execution helpers from the `src/lifecycle` barrel
- **THEN** that barrel MAY re-export those helpers from the Core-internal modules
- **AND THEN** that re-export is not a published `quantex-core` SDK export

#### Scenario: Core-internal lifecycle directory has no barrel

- **WHEN** a contributor lists TypeScript files under `src/core/lifecycle/`
- **THEN** the directory contains the model leaf, provider-binding, provider-evidence, agent-observation, update-planner, agent-execution, and uninstall-postcondition modules
- **AND THEN** it does not contain `index.ts`
