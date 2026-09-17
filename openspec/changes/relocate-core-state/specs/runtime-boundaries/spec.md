## ADDED Requirements

### Requirement: State SHALL live under Core ownership with inverted CLI seams

Quantex SHALL own persisted-state schema, store, file persistence, and convenience helpers under `packages/core/src/state/`. Root `src/state/` MUST be absent and MUST NOT remain as a directory re-export shim. The published v1 convenience barrel `src/state.ts` MAY remain as a CLI facade over that Core-owned tree. State MUST stay Core-owned and MUST NOT be reassigned to CLI. Relocated state modules MUST NOT import CLI shell (`src/cli-context`, `src/config`, `src/runtime/cli-operation-context`, `src/runtime/cli-state-host`, `src/utils/cli-child-process`, commands, presentation, `src/self`). CLI MAY bind Core-owned host ports that supply the config directory. Persisted `SelfInstallSource` MUST be owned by the Core state schema; CLI MAY re-export that type. Relocating state MUST NOT publish it from `packages/core/src/index.ts` or add a `quantex-core` package subpath. Remaining deferred Core lock helpers and the catalog type-leaf MAY stay as documented root imports. Those remaining edges MUST NOT be rewritten into CLI-side semantics.

#### Scenario: State sources live under packages/core/src

- **WHEN** architecture tests inspect physical source layout after this knife
- **THEN** `packages/core/src/state` exists
- **AND THEN** root `src/state/` is absent
- **AND THEN** `src/state.ts` remains as the published v1 convenience barrel
- **AND THEN** `packages/core/src/index.ts` does not export state symbols
- **AND THEN** `packages/core/package.json` still exports only `.` and `./package.json`

#### Scenario: Relocated state has no CLI shell imports

- **WHEN** architecture tests inspect import specifiers under `packages/core/src/state`
- **THEN** they fail if those modules import `src/cli-context`, `src/config`, `src/runtime/cli-operation-context`, `src/runtime/cli-state-host`, `src/utils/cli-child-process`, commands, presentation, or `src/self`
- **AND THEN** they pass when CLI-owned code binds Core host ports instead
- **AND THEN** they pass when schema imports catalog types or sibling `managed-install-types`

#### Scenario: Deferred Core modules may import relocated state

- **WHEN** `src/agent-update` or non-presentation utils import persisted-state types or helpers
- **THEN** they MAY import `packages/core/src/state/**` or the published `src/state.ts` barrel
- **AND THEN** they MUST NOT import `createQuantex`, Core mutation/execution/self-upgrade/doctor executors, or lifecycle engines other than the type-leaf
- **AND THEN** Core-local engines MAY import state as a sibling rather than a root exception

### Requirement: Slice-3 relocation SHALL relocate only persisted state

This knife MUST physically relocate only `src/state/**` into `packages/core/src/state/**`. It MUST NOT relocate or fold `src/config`, capabilities, commands, schema, catalog (`src/agents`), or the lifecycle type-leaf. Catalog and `packages/core/src/lifecycle/model.ts` MUST remain the documented neutral boundary and MUST NOT be labeled CLI-owned or slimmed down. Cutting CLI seams MUST invert or inject Core-owned host ports so lock path, `loadState`, state schema version 2, receipts, and `--json` outcomes stay frozen. Remaining deferred-Core lock helpers MUST keep calling `acquireResourceLockInConfigDir` / `getResourceLockPathInConfigDir` with the injected directory rather than `acquireResourceLock` / `getConfigDir` CLI wrappers. This knife MUST NOT start GitHub issue #134 or catalog slim-down. Changelog framing MUST stay internal architecture. The published `quantex-core` SDK MUST stay frozen. This knife MUST NOT cut a separate product release.

#### Scenario: Only persisted state moves under Core this knife

- **WHEN** architecture tests inspect physical source layout after this knife
- **THEN** `packages/core/src/state` exists and root `src/state/` is absent
- **AND THEN** `src/config` remains and `packages/core/src/config` is absent
- **AND THEN** `src/agents` remains the catalog boundary and `packages/core/src/agents` is absent
- **AND THEN** `packages/core/src/lifecycle/model.ts` remains the type-leaf
- **AND THEN** capabilities, commands, and schema are not relocated with state

#### Scenario: CLI seams stay inverted without CLI-side lock semantics

- **WHEN** relocated state resolves its config directory or acquires the state lock
- **THEN** the config directory comes from Core-owned host ports (CLI binds `getConfigDir`; unbound Core uses the existing HOME / USERPROFILE / homedir `.quantex` location)
- **AND THEN** the lock path is taken through `acquireResourceLockInConfigDir` with that injected directory
- **AND THEN** relocated state does not import `src/config` or call `acquireResourceLock`

#### Scenario: Frozen public contracts and deferred catalog work stay out of this knife

- **WHEN** a contributor inspects this change for #134, catalog slim-down, SDK exports, or a product release
- **THEN** those work items are absent
- **AND THEN** `createQuantex` remains the only published runtime export
- **AND THEN** `--json` / aliases / exit codes / state v2 / receipts are unchanged

## MODIFIED Requirements

### Requirement: Lifecycle receipt types SHALL live in a Core-internal leaf

Quantex SHALL own agent lifecycle receipt, observation, plan, and outcome TypeScript types plus `LIFECYCLE_RECEIPT_SCHEMA_VERSION` in an in-repo Core-internal module under `packages/core/src/lifecycle/`. That module MUST be a dependency leaf: it MUST NOT import Core runtime, `packages/core/src/state`, remaining `src/lifecycle` engines, CLI, or providers. `packages/core/src/state` MAY import that leaf (including a value re-export of the receipt schema constant) and MUST NOT import Core runtime modules such as `packages/core/src/index.ts`, `createQuantex`, or mutation/execution executors. Relocating the types MUST NOT, by itself, expand the published `quantex-core` package export surface.

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

The later knife is L4. Quantex MUST keep lifecycle helpers as Core-internal modules under `packages/core/src/lifecycle/` and MUST NOT restore `src/lifecycle/`. Remaining in-repo callers MUST import those Core-internal modules directly. L4 MUST NOT add a `packages/core/src/lifecycle/index.ts` barrel and MUST NOT publish those modules from `packages/core/src/index.ts` or the published `quantex-core` package. `packages/core/src/state` MUST still import only the Core-internal lifecycle model leaf among lifecycle modules.

#### Scenario: L4 deletes the leftover lifecycle barrel

- **WHEN** the L4 barrel deletion is applied
- **THEN** `src/lifecycle/` is absent
- **AND THEN** `packages/core/src/lifecycle/index.ts` is also absent

#### Scenario: Remaining callers import Core-internal modules directly

- **WHEN** CLI services or idempotency need lifecycle types or helpers previously imported from the `src/lifecycle` barrel
- **THEN** they import those symbols from the matching Core-internal module under `packages/core/src/lifecycle/`
- **AND THEN** they do not import `src/lifecycle`

### Requirement: Provider-binding helpers SHALL live in Core-internal modules

Quantex SHALL own lifecycle provider-binding resolution (`LifecycleProviderBinding`, catalog/state/receipt/install-method resolvers, and equality) and `observeLifecycleProvider` in in-repo Core-internal modules under `packages/core/src/lifecycle/`. Those modules MUST NOT be published from `packages/core/src/index.ts` or the published `quantex-core` package. They are not dependency leaves: they MAY import agents, provider types, the Core-internal lifecycle model leaf, and type-only persisted-state types, and `observeLifecycleProvider` MAY default to the first-party provider registry. They MUST NOT import remaining `src/lifecycle` engines, CLI, or Core mutation/execution executors. `packages/core/src/state` MUST NOT import provider-binding or provider-evidence modules.

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
- **THEN** they import at most the Core-internal lifecycle model leaf among lifecycle modules
- **AND THEN** they do not import provider-binding, provider-evidence, `packages/core/src/index.ts`, `createQuantex`, or Core executors

#### Scenario: Published SDK root stays free of binding and evidence

- **WHEN** a TypeScript consumer inspects `packages/core/src/index.ts`
- **THEN** that entry does not export `LifecycleProviderBinding`, `observeLifecycleProvider`, `resolveInstallMethodProviderBinding`, or other provider-binding/evidence symbols
- **AND THEN** `createQuantex` remains the only runtime export

### Requirement: Agent observation and remaining lifecycle engines SHALL live in Core-internal modules

Quantex SHALL own agent lifecycle observation (`observeAgentLifecycle`), update planning (`planLifecycleUpdate`), execution preflight (`planAgentExecutionPreflight`), and uninstall postcondition retry (`waitForUninstallAbsence`) in in-repo Core-internal modules under `packages/core/src/lifecycle/`. Those modules MUST NOT be published from `packages/core/src/index.ts` or the published `quantex-core` package. They are not dependency leaves: they MAY import agents, providers, the Core-internal lifecycle model leaf, sibling Core-internal lifecycle modules, type-only persisted-state types, and existing utils. They MUST NOT import CLI, services, planning, or Core mutation/execution executors. `packages/core/src/state` MUST NOT import these modules.

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
- **THEN** they import at most the Core-internal lifecycle model leaf among lifecycle modules
- **AND THEN** they do not import agent-observation, update-planner, agent-execution, uninstall-postcondition, `packages/core/src/index.ts`, `createQuantex`, or Core executors

#### Scenario: Published SDK root stays free of the moved engines

- **WHEN** a TypeScript consumer inspects `packages/core/src/index.ts`
- **THEN** that entry does not export `observeAgentLifecycle`, `planLifecycleUpdate`, `planAgentExecutionPreflight`, `waitForUninstallAbsence`, or other L3 engine symbols
- **AND THEN** `createQuantex` remains the only runtime export

### Requirement: Product-locked source ownership SHALL classify Core, CLI, and documented stop points

Quantex SHALL treat source ownership as:

- Core-owned: lifecycle domain, provider adapters, persisted state, receipts, package-manager, and similar shared modules (`packages/core/src/providers`, `packages/core/src/state`, runtime ports except CLI operation context and CLI host binders, `src/agent-update`, non-presentation utils)
- CLI-owned: commands, presentation, exit policy, self-upgrade UI, and published convenience barrels over Core (`src/state.ts`)
- Neutral boundary: shared agent catalog (`src/agents`) and the Core-internal lifecycle type-leaf reverse-import seam (`packages/core/src/lifecycle/model.ts`)

This knife MUST physically locate state under `packages/core/src/state`. It MUST defer relocation of remaining shared modules still in root (`src/agent-update`, non-presentation utils, runtime ports except CLI operation context and CLI host binders). Default ownership for those remaining modules remains Core. Temporary root placement MUST be documented as an exception and MUST NOT be treated as a reassignment to CLI. Catalog and the type-leaf MUST remain the documented neutral boundary and MUST NOT be labeled CLI-owned. Architecture tests MUST allowlist the remaining root imports Core still needs, MUST fail on undocumented Core → CLI leaks, MUST record that package-manager, providers, and state have moved under Core, and MUST NOT treat `src/state.ts` as a restored `src/state/` runtime tree. State MUST NOT keep CLI `cli-context` / `config` / `cli-operation-context` / `cli-child-process` / `self` imports.

#### Scenario: Core may import documented root modules that are not CLI shell

- **WHEN** a Core engine needs catalog types, runtime ports, agent-update helpers, or deferred Core utils
- **THEN** it may import those modules from root `src/`
- **AND THEN** architecture tests list those directories as allowed exceptions
- **AND THEN** package-manager, providers, and state are imported as Core-local modules rather than root exceptions

#### Scenario: New Core to CLI leaks fail

- **WHEN** a Core module adds a direct import of `src/commands`, `src/cli-context`, `src/self`, `src/config`, `src/runtime/cli-operation-context`, `src/runtime/cli-state-host`, `src/utils/cli-child-process`, or another CLI-owned path
- **THEN** the architecture test fails
- **AND THEN** relocating state does not authorize that new edge

#### Scenario: Remaining deferred Core modules stay in root without becoming CLI-owned

- **WHEN** architecture tests inspect physical source layout after this knife
- **THEN** `packages/core/src/state` exists
- **AND THEN** root `src/state/` is absent
- **AND THEN** `src/state.ts` remains as the published v1 convenience barrel rather than a restored implementation tree
- **AND THEN** remaining root modules such as `src/agent-update` are recorded as deferred Core relocation, not CLI ownership
- **AND THEN** Core-owned state helpers live under `packages/core/src/state` and do not import CLI commands or `src/config`
- **AND THEN** root `src/providers` and root `src/package-manager` remain absent

#### Scenario: Catalog and type-leaf remain the neutral boundary

- **WHEN** a contributor looks up shared catalog types or the receipt type leaf
- **THEN** catalog modules remain under `src/agents` as the documented neutral boundary
- **AND THEN** that root placement is not labeled CLI ownership
- **AND THEN** `packages/core/src/state` may import `packages/core/src/lifecycle/model.ts` among lifecycle modules
- **AND THEN** those reverse imports do not become published `quantex-core` SDK exports

### Requirement: Reverse imports into Core SHALL be limited to the documented type leaf

Outside CLI-owned modules, root `src/` MUST NOT import Core runtime (`packages/core/src/index.ts`, `createQuantex`, mutation/execution/self-upgrade/doctor executors). `packages/core/src/state` MAY import `packages/core/src/lifecycle/model.ts` among lifecycle modules and MAY import `packages/core/src/package-manager/managed-install-types.ts`. Deferred Core modules still in root (`src/agent-update`, non-presentation utils, runtime ports except CLI operation context and CLI host binders) MAY import `packages/core/src/package-manager/**`, `packages/core/src/providers/**`, and `packages/core/src/state/**`. They MUST NOT import other Core runtime or lifecycle engines. Undocumented cycles through Core runtime engines MUST fail architecture tests.

#### Scenario: State still stays off Core runtime engines

- **WHEN** persisted-state schema or store modules are inspected for Core imports
- **THEN** they import the Core-internal lifecycle model leaf at `packages/core/src/lifecycle/model.ts`
- **AND THEN** schema MAY import `packages/core/src/package-manager/managed-install-types.ts`
- **AND THEN** they do not import Core runtime, provider-binding, providers, or other lifecycle engines

#### Scenario: Undocumented Core runtime cycles fail

- **WHEN** architecture tests detect a cycle that includes a Core runtime engine and a non-CLI root module through anything other than the model leaf, the relocated package-manager tree, the relocated providers tree, or the relocated state tree
- **THEN** the test fails
- **AND THEN** the documented state leaf reverse edge and deferred package-manager / providers / state imports still pass

### Requirement: Architecture tests SHALL prove Core source ownership

The repository SHALL keep AST or import-graph architecture tests that (1) require Core implementation to live under `packages/core/src`, (2) forbid root `src/core` runtime files, (3) forbid Core → CLI shell edges, (4) forbid undocumented cycles through Core runtime engines, (5) allow the documented type-leaf reverse-import boundary, remaining root-import exceptions, and deferred Core imports of relocated package-manager, providers, and state, and (6) record that package-manager lives under `packages/core/src/package-manager`, providers live under `packages/core/src/providers`, and state lives under `packages/core/src/state` without being reassigned to CLI. Those tests MUST continue to prove lazy mutation loading, the published Core export freeze, and the absence of engine/route identifiers on the public SDK entry.

#### Scenario: Physical ownership regression fails CI

- **WHEN** a change reintroduces `packages/core/src` re-exports of root `src/core`, restores Core runtime under `src/core`, restores package-manager under root `src/package-manager`, restores providers under root `src/providers`, or restores the state implementation tree under root `src/state/`
- **THEN** the architecture test fails

#### Scenario: Published SDK and lazy mutation stay frozen

- **WHEN** architecture tests inspect `packages/core/src/index.ts` and the eager public runtime closure
- **THEN** the runtime export remains `createQuantex`
- **AND THEN** mutation production modules stay outside the eager closure
- **AND THEN** `packages/core/src/providers/first-party.ts` stays outside that public closure
- **AND THEN** package-manager, providers, and state are absent from the published SDK entry

### Requirement: Package-manager SHALL live under Core ownership with inverted CLI seams

Quantex SHALL own package-manager implementation under `packages/core/src/package-manager/`. Root `src/package-manager/` MUST be absent and MUST NOT remain as a re-export shim. Package-manager MUST stay Core-owned and MUST NOT be reassigned to CLI. Relocated package-manager modules MUST NOT import CLI shell (`src/cli-context`, `src/config`, `src/runtime/cli-operation-context`, `src/utils/cli-child-process`, commands, presentation, `src/self`). CLI MAY bind Core-owned host ports that supply cancellation, installer preferences, operation context, and binary-shell spawn. Relocating package-manager MUST NOT publish it from `packages/core/src/index.ts` or add a `quantex-core` package subpath.

#### Scenario: Package-manager sources live under packages/core/src

- **WHEN** architecture tests inspect physical source layout after this knife
- **THEN** `packages/core/src/package-manager` exists
- **AND THEN** root `src/package-manager` is absent
- **AND THEN** `packages/core/src/index.ts` does not export package-manager symbols
- **AND THEN** `packages/core/package.json` still exports only `.` and `./package.json`

#### Scenario: Relocated package-manager has no CLI shell imports

- **WHEN** architecture tests inspect import specifiers under `packages/core/src/package-manager`
- **THEN** they fail if those modules import `src/cli-context`, `src/config`, `src/runtime/cli-operation-context`, or `src/utils/cli-child-process`
- **AND THEN** they pass when CLI-owned code binds Core host ports instead

#### Scenario: Deferred Core modules may import relocated package-manager

- **WHEN** relocated state, `src/agent-update`, or non-presentation utils import installer leaves
- **THEN** they MAY import `packages/core/src/package-manager/**`
- **AND THEN** they MUST NOT import `createQuantex`, Core mutation/execution/self-upgrade/doctor executors, or lifecycle engines other than the type-leaf
- **AND THEN** Core-local providers MAY import package-manager as a sibling rather than a root exception

### Requirement: Providers SHALL live under Core ownership without CLI shell imports

Quantex SHALL own provider adapters, registry, invoke, and first-party bindings under `packages/core/src/providers/`. Root `src/providers/` MUST be absent and MUST NOT remain as a re-export shim. Providers MUST stay Core-owned and MUST NOT be reassigned to CLI. Relocated provider modules MUST NOT import CLI shell (`src/cli-context`, `src/config`, `src/runtime/cli-operation-context`, `src/utils/cli-child-process`, commands, presentation, `src/self`). Relocating providers MUST NOT publish them from `packages/core/src/index.ts` or add a `quantex-core` package subpath. Remaining deferred Core utils and the catalog type-leaf MAY stay as documented root imports. Those remaining edges MUST NOT be rewritten into CLI-side semantics.

#### Scenario: Provider sources live under packages/core/src

- **WHEN** architecture tests inspect physical source layout after this knife
- **THEN** `packages/core/src/providers` exists
- **AND THEN** root `src/providers` is absent
- **AND THEN** `packages/core/src/index.ts` does not export provider symbols
- **AND THEN** `packages/core/package.json` still exports only `.` and `./package.json`

#### Scenario: Relocated providers have no CLI shell imports

- **WHEN** architecture tests inspect import specifiers under `packages/core/src/providers`
- **THEN** they fail if those modules import `src/cli-context`, `src/config`, `src/runtime/cli-operation-context`, `src/utils/cli-child-process`, commands, presentation, or `src/self`
- **AND THEN** they pass when adapters import Core package-manager, deferred Core utils, or catalog types instead

#### Scenario: Deferred Core modules may import relocated providers

- **WHEN** relocated state, `src/agent-update`, or non-presentation utils import provider types, `getProviderOutputPolicy`, or the providers barrel
- **THEN** they MAY import `packages/core/src/providers/**`
- **AND THEN** they MUST NOT import `createQuantex`, Core mutation/execution/self-upgrade/doctor executors, or lifecycle engines other than the type-leaf
