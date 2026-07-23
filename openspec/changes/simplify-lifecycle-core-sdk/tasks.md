## 1. Intake and recoverable baseline

- [x] 1.1 Fetch the latest remote refs, rebase onto `origin/main`, and create `codex/simplify-core-sdk-integration`
- [x] 1.2 Audit current lifecycle boundaries, root exports, state schema, provider evidence, release packaging, and historical regression tests
- [x] 1.3 Create the umbrella proposal, design, Core SDK delta, compatibility delta, package delta, release delta, and README delta
- [x] 1.4 Validate all OpenSpec artifacts with `bun run openspec:validate`
- [x] 1.5 Commit and push the OpenSpec contract as the first recoverable integration-branch checkpoint (`2ffc1e3`)

## 2. Integration and compatibility gates

- [x] 2.1 Include the integration branch in CI, release-verification, and Sandbox trigger classification without widening protected release targets
- [x] 2.2 Make Linux, macOS, and Windows validation explicit for Core routing promotion and stop treating skipped Windows PR coverage as sufficient
- [x] 2.3 Add semantic compile coverage for every maintained root export before changing declaration generation; keep the existing v1 fixtures unchanged
- [x] 2.4 Add released N/N-1 state and idempotency compatibility fixtures covering old-to-new and new-to-old-to-new reads and mutations with schema version 2
- [x] 2.5 Add a test-only legacy/Core differential harness that compares observations, typed outcomes, state deltas, receipts, and v1 CLI projections without production shadow mutations
- [x] 2.6 Extend first-party provider conformance to cover relevant observe, mutate, verify, unknown, cancellation, timeout, and compensation behavior before each provider path migrates

## 3. Core package and read-only SDK vertical slice

- [x] 3.1 Add the single `packages/core` workspace, exact same-version root development dependency, Node-only TypeScript configuration, and explicit isolated Core build
- [x] 3.2 Implement the minimal public types for `createQuantex`, `CoreResult`, request options, agent descriptors, and the managed/external/missing/stale/conflict/indeterminate inspection union
- [x] 3.3 Implement instance-owned `list` and `inspect` without Commander, prompts, presenters, mutable CLI context, writes, process exit, or self-upgrade imports
- [x] 3.4 Make the maintained CLI inspection paths consume the canonical Core read implementation while preserving current command, JSON/NDJSON, error, exit, and stream fixtures
- [x] 3.5 Add Core re-entrancy, cancellation isolation, timeout, corrupt-state, no-output, no-write, and no-network-on-import tests
- [x] 3.6 Add an import-boundary test that rejects Core dependencies on CLI commands, presenters, mutable CLI context, self-upgrade, release artifacts, and unsupported public subpaths
- [x] 3.7 Add clean packed-tarball Node.js 20 ESM, Bun, and TypeScript NodeNext consumers and verify the Core artifact allowlist
- [x] 3.8 Prove the root CLI tarball and standalone binaries inline Core, retain the v1 root contract, and run without Core installed or repository `node_modules`
- [x] 3.9 Commit and push the working read-only SDK vertical slice as the second recoverable checkpoint (`9e84ce1`)

## 4. Coordinated packaging and release recovery

- [x] 4.1 Synchronize root and Core versions through one release-please component and reject mismatched title, root, Core, or exact Core development-dependency versions
- [x] 4.2 Reject workspace protocols from publishable manifests and keep the external `quantex` alias outside this repository's release coordination
- [x] 4.3 Extend package validation and release resolution to represent Core-missing, CLI-missing, both-missing, both-published, and registry-indeterminate states
- [x] 4.4 Publish and verify Core before CLI, preserve idempotent per-package recovery, and upload standalone artifacts only after repository npm closure
- [x] 4.5 Pin release workflow Bun versions to the repository toolchain, cache downloads rather than workspace links, and include Core manifests in cache keys, release PR policy, path taxonomy, and Sandbox selection
- [ ] 4.6 Verify npm namespace ownership and bootstrap Core trusted publishing before enabling the first public release
- [x] 4.7 Commit and push coordinated packaging and recovery as the third recoverable checkpoint (`0fefedb`)

## 5. Install and ensure migration for 1.3 beta or opt-in

- [ ] 5.1 Add Core `install` and `ensure` with a shared discriminated preview/apply result, four stable decisions, and phase/side-effect errors without exposing infrastructure
- [x] 5.2 Replace generic single-step DAG planning on these paths with a narrow Core decision/executor, explicit-config locks, one provider recipe, fresh verification, verified recording, and scoped compensation
- [x] 5.3 Preserve exact-source ownership, external no-adopt defaults, tri-state probes, Bun trust ownership, and no success recording after failed verification
- [ ] 5.4 Select legacy or Core before invocation, keep any v1 safe-adoption policy private, prohibit post-side-effect fallback, and keep stable CLI mutation routing on legacy until promotion gates pass
- [ ] 5.5 Run differential, provider, state, idempotency, cancellation, timeout, and platform gates before enabling beta or explicit whole-invocation Core routing
- [ ] 5.6 Commit and push the install/ensure vertical slice as a recoverable milestone checkpoint

## 6. Update, uninstall, and run migration for 1.3

- [ ] 6.1 Add Core `update` with exact recorded-source selection, semver no-downgrade, and re-observed script/binary version increase
- [ ] 6.2 Add Core `uninstall` with conclusive-only ghost cleanup, conflict retention, and PATH-only external refusal
- [ ] 6.3 Add Core `run` with explicit install policy, inherited or captured standard IO, cancellation cleanup, and child exit preservation
- [ ] 6.4 Keep CLI `update --all`, prompting, structured presentation, exit mapping, and request-key replay as compatibility adapters rather than Core batch APIs
- [ ] 6.5 Remove each duplicate package-manager facade or command-owned lifecycle path only after its equivalent Core contract and compatibility tests pass
- [ ] 6.6 Commit and push each command-family vertical slice before beginning the next family

## 7. Stable-default and soak gates

- [ ] 7.1 Promote Core to stable default no earlier than 1.4 after Linux, macOS, Windows, package, Sandbox, provider, fault, and downgrade matrices pass with no known critical or important regression
- [ ] 7.2 Retain a pre-invocation legacy escape route through 1.5 and complete a documented rollback drill without state schema changes
- [ ] 7.3 Keep Core default for a second stable minor, freeze legacy behavior, and publish the compatibility/deprecation inventory
- [ ] 7.4 Require a separate major-version deprecation change after both two Core-default stable minors and 90 days from stable default before removing maintained v1 surfaces

## 8. Documentation, validation, and delivery closure

- [x] 8.1 Add an ADR for the two-package boundary, frozen 1.x state shape, engine-selection rule, and release train
- [x] 8.2 Document current SDK installation, runtime requirements, supported methods, CLI/Core responsibility split, compatibility stage, and rollback boundary in English and Simplified Chinese
- [x] 8.3 Run `bun install --frozen-lockfile`, lint, format check, root and Core typecheck, tests, OpenSpec validation, memory check, both builds, package checks, standalone binary build, and release artifact validation
- [x] 8.4 Commit and push the validated integration state, create or update draft PR #500 from the repository template, and record remaining milestone owners without archiving the umbrella change early
- [ ] 8.5 After all accepted milestones merge and current specs synchronize, complete archive closure and report release state
