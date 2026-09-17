## ADDED Requirements

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

- **WHEN** `src/providers`, `src/state`, `src/agent-update`, or non-presentation utils import installer leaves
- **THEN** they MAY import `packages/core/src/package-manager/**`
- **AND THEN** they MUST NOT import `createQuantex`, Core mutation/execution/self-upgrade/doctor executors, or lifecycle engines other than the type-leaf

## MODIFIED Requirements

### Requirement: Product-locked source ownership SHALL classify Core, CLI, and documented stop points

Quantex SHALL treat source ownership as:

- Core-owned: lifecycle domain, provider adapters, persisted state, receipts, package-manager, and similar shared modules (`src/providers`, `src/state`, runtime ports except CLI operation context, `src/agent-update`, non-presentation utils)
- CLI-owned: commands, presentation, exit policy, and self-upgrade UI
- Neutral boundary: shared agent catalog (`src/agents`) and the Core-internal lifecycle type-leaf reverse-import seam (`packages/core/src/lifecycle/model.ts`)

This knife MUST physically locate package-manager under `packages/core/src/package-manager`. It MUST defer relocation of `src/providers`, `src/state`, and similar remaining shared modules. Default ownership for those remaining modules remains Core. Temporary root placement MUST be documented as an exception and MUST NOT be treated as a reassignment to CLI. Catalog and the type-leaf MUST remain the documented neutral boundary and MUST NOT be labeled CLI-owned. Architecture tests MUST allowlist the remaining root imports Core still needs, MUST fail on undocumented Core → CLI leaks, MUST record that package-manager has moved under Core, and MUST record the remaining deferred-relocation stop points for providers and state. Package-manager MUST NOT keep CLI `cli-context` / `config` / `cli-operation-context` / `cli-child-process` imports; those couplings MUST be inverted through Core-owned host ports bound by CLI.

#### Scenario: Core may import documented root modules that are not CLI shell

- **WHEN** a Core engine needs catalog types, provider adapters, state schema, runtime ports, or agent-update helpers
- **THEN** it may import those modules from root `src/`
- **AND THEN** architecture tests list those directories as allowed exceptions
- **AND THEN** package-manager is imported as a Core-local module rather than a root exception

#### Scenario: New Core to CLI leaks fail

- **WHEN** a Core module adds a direct import of `src/commands`, `src/cli-context`, `src/self`, `src/config`, `src/runtime/cli-operation-context`, `src/utils/cli-child-process`, or another CLI-owned path
- **THEN** the architecture test fails
- **AND THEN** relocating package-manager does not authorize that new edge

#### Scenario: Remaining deferred Core modules stay in root without becoming CLI-owned

- **WHEN** architecture tests inspect physical source layout after this knife
- **THEN** `src/providers` and `src/state` still exist under root `src/`
- **AND THEN** `packages/core/src/providers` and `packages/core/src/state` are absent
- **AND THEN** that root placement is recorded as deferred Core relocation, not CLI ownership
- **AND THEN** `src/state/index.ts` still imports `src/config` and `src/self/types` as the recorded state seam
- **AND THEN** Core-owned provider adapters import `packages/core/src/package-manager` installer leaves rather than CLI commands
- **AND THEN** root `src/package-manager` is absent

#### Scenario: Catalog and type-leaf remain the neutral boundary

- **WHEN** a contributor looks up shared catalog types or the receipt type leaf
- **THEN** catalog modules remain under `src/agents` as the documented neutral boundary
- **AND THEN** that root placement is not labeled CLI ownership
- **AND THEN** `src/state` may import `packages/core/src/lifecycle/model.ts` among lifecycle modules
- **AND THEN** those reverse imports do not become published `quantex-core` SDK exports

### Requirement: Reverse imports into Core SHALL be limited to the documented type leaf

Outside CLI-owned modules, root `src/` MUST NOT import Core runtime (`packages/core/src/index.ts`, `createQuantex`, mutation/execution/self-upgrade/doctor executors). `src/state` MAY import `packages/core/src/lifecycle/model.ts` among lifecycle modules and MAY import `packages/core/src/package-manager/managed-install-types.ts`. Deferred Core modules still in root (`src/providers`, `src/agent-update`, non-presentation utils, runtime ports except CLI operation context) MAY import `packages/core/src/package-manager/**`. They MUST NOT import other Core runtime or lifecycle engines. Undocumented cycles through Core runtime engines MUST fail architecture tests.

#### Scenario: State still stays off Core runtime engines

- **WHEN** persisted-state schema or store modules are inspected for Core imports
- **THEN** they import the Core-internal lifecycle model leaf at `packages/core/src/lifecycle/model.ts`
- **AND THEN** schema MAY import `packages/core/src/package-manager/managed-install-types.ts`
- **AND THEN** they do not import Core runtime, provider-binding, or other lifecycle engines

#### Scenario: Undocumented Core runtime cycles fail

- **WHEN** architecture tests detect a cycle that includes a Core runtime engine and a non-CLI root module through anything other than the model leaf or the relocated package-manager tree
- **THEN** the test fails
- **AND THEN** the documented state leaf reverse edge and deferred package-manager imports still pass

### Requirement: Architecture tests SHALL prove Core source ownership

The repository SHALL keep AST or import-graph architecture tests that (1) require Core implementation to live under `packages/core/src`, (2) forbid root `src/core` runtime files, (3) forbid Core → CLI shell edges, (4) forbid undocumented cycles through Core runtime engines, (5) allow the documented type-leaf reverse-import boundary, remaining root-import exceptions, and deferred Core imports of relocated package-manager, and (6) record that package-manager lives under `packages/core/src/package-manager` while Core-owned `src/providers` and `src/state` remain deferred root exceptions without being reassigned to CLI. Those tests MUST continue to prove lazy mutation loading, the published Core export freeze, and the absence of engine/route identifiers on the public SDK entry.

#### Scenario: Physical ownership regression fails CI

- **WHEN** a change reintroduces `packages/core/src` re-exports of root `src/core`, restores Core runtime under `src/core`, or restores package-manager under root `src/package-manager`
- **THEN** the architecture test fails

#### Scenario: Published SDK and lazy mutation stay frozen

- **WHEN** architecture tests inspect `packages/core/src/index.ts` and the eager public runtime closure
- **THEN** the runtime export remains `createQuantex`
- **AND THEN** mutation production modules stay outside the eager closure
- **AND THEN** `src/providers/first-party.ts` stays outside that public closure
- **AND THEN** package-manager is absent from the published SDK entry
