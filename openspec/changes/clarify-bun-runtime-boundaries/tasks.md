## 1. Runtime boundary

- [x] 1.1 Replace the dual Bun/Node branch in `spawnCommand` with one `cross-spawn` implementation while preserving detached executable resolution and process-handle semantics
- [x] 1.2 Add an architecture test that rejects in-process Bun global references under `src/**`
- [x] 1.3 Record the retained toolchain, compiler, provider, self-install-source, and distribution boundaries in ADR 0010

## 2. Read-only process enforcement

- [x] 2.1 Extend the read-only preload to guard Node-compatible child-process spawn and spawnSync alongside Bun-native spawn APIs
- [x] 2.2 Add preload coverage proving mutation rejection and observation allowance through both process families
- [x] 2.3 Run the read-only lifecycle smoke test and confirm guarded application commands are recorded

## 3. Test isolation

- [x] 3.1 Remove the Vitest-wide fake Bun global and replace incidental Bun filesystem use with Node filesystem APIs
- [x] 3.2 Migrate package-manager, detection, version, executable-resolution, and command-execution tests from `Bun.spawn` mutation to cross-spawn mocks
- [x] 3.3 Migrate standalone self-upgrade tests to explicit process mocks and retain Bun-specific fixture programs only where Bun behavior is intentional
- [x] 3.4 Rename the cross-spawn mock helper's Bun-shaped internal types so the test seam describes the runtime-neutral process contract

## 4. Validation

- [x] 4.1 Run focused child-process, provider/package-manager, self-upgrade, architecture, and read-only guard tests
- [x] 4.2 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`
  - Local full-suite result: 168/169 test files passed; the two command-family golden failures reproduce with identical hashes on unmodified `origin/main` in the same host environment.
- [x] 4.3 Run `bun run openspec:validate` and `bun run memory:check`
- [x] 4.4 Run `bun run build`, `bun run build:bin`, `bun run release:artifacts`, `bun run release:smoke`, and `bun run package:check`

## 5. Delivery closure

- [x] 5.1 Review the final diff and confirm public CLI, config, state, provider command, and release format contracts are unchanged
- [ ] 5.2 Commit on `codex/clarify-bun-runtime-boundaries` and push the branch
- [ ] 5.3 Validate a template-based PR body, create the PR, and wait for required CI and governance checks
- [ ] 5.4 Merge the implementation PR when eligible and report release impact separately
- [ ] 5.5 Complete or explicitly report the follow-up OpenSpec archive-closure PR state
