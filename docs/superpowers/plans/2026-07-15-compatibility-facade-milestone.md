# Compatibility Facade and Full v1 Gate Milestone

Base: `origin/codex/redesign-lifecycle-integration@88eadc91d754158ff02fa8f46b57521e589782ab`

Branch: `codex/redesign-compatibility-facade`

OpenSpec change: `redesign-lifecycle-engine`

## Goal

Complete OpenSpec tasks 1.1, 1.4, and 10.1-10.3 before deleting any legacy implementation. Route every maintained root-package export through an explicit compatibility facade, prove built-package downstream type/runtime compatibility, verify package and binary entry-point identity, and establish the complete v1 protocol/stream/exit/config/state gate used by the later legacy-removal milestone.

## Boundaries

- Preserve the exact maintained root value-export set in `test/fixtures/compatibility/v1/root-exports.json`; no root export is added, removed, or renamed.
- Preserve `quantex-cli`, the separately maintained `quantex` alias-package contract, and the package-local `qtx`/`quantex` binary entry points. This repository must not resume cross-repository alias publishing or synchronization.
- Preserve all stable command names, aliases, syntax, JSON/NDJSON v1 shapes, exit meanings, stdout/stderr behavior, state/config interpretation, and transparent child IO.
- Do not remove package-manager compatibility APIs, legacy command modules, state projections, or root exports in this milestone.
- Do not mark OpenSpec 2.4 or 10.4-10.6 complete. Those require a later independent legacy-removal plan after this gate is green on the default routes.
- Do not update product documentation from intended future architecture; task 10.4 remains downstream of verified default behavior.

## Delivery model

1. Commit each reviewed task as a granular recovery checkpoint.
2. Preserve the final granular head at `refs/quantex/recovery/redesign-compatibility-facade-granular`.
3. Rebase on the latest integration before delivery.
4. Normalize to one review commit immediately before a ready PR to `codex/redesign-lifecycle-integration`.
5. Require full local gates, independent specification and quality reviews, all required remote checks, and rebase merge; never enable auto-merge.

## Task 1: Introduce the root compatibility facade

Files expected:

- Add: `src/compatibility/index.ts`
- Modify: `src/index.ts`
- Modify: `test/compatibility/v1-baseline.test.ts`
- Modify/add: root export tests

Move the current explicit root exports behind a dedicated compatibility module. Keep `src/index.ts` as a thin package entry point and assert exact runtime export parity with the frozen v1 root-export fixture. The facade may delegate to redesigned internals, but its public signatures and behavior remain v1-compatible.

## Task 2: Add downstream compile and runtime fixtures

Files expected:

- Add: `test/fixtures/compatibility/v1/downstream/consumer.ts`
- Add: `test/fixtures/compatibility/v1/downstream/runtime.mjs`
- Add/modify: package-distribution verification
- Add/modify: focused compatibility tests

Build the package, compile a downstream consumer against the emitted declaration entry point, and run a consumer against the emitted ESM root. Exercise representative catalog, state/config, planning, result, and self-inspection exports rather than only checking symbol names. Keep the fixture hermetic and independent of a globally installed Quantex.

## Task 3: Verify package and executable identities

Files expected:

- Modify/add: package-distribution and binary-entry compatibility tests
- Modify: compatibility fixtures only when recording already-established contracts

Verify the packaged `qtx` and `quantex` bin entries resolve to the same executable and return equivalent version/discovery behavior. Record non-mutating evidence for the separately maintained `quantex` alias-package dependency contract without adding publishing coordination back to this repository. Treat unavailable registry/network evidence as an explicit external validation result, not as permission to weaken local package identity tests.

## Task 4: Complete the v1 command-family compatibility gate

Files expected:

- Add: missing golden fixtures under `test/fixtures/compatibility/v1/`
- Modify: `test/compatibility/v1-baseline.test.ts`
- Add/modify: process-level compatibility tests

Cover every stable command family across its contractual human/JSON/NDJSON surface where applicable, accepted command/alias syntax, exit-code class, stdout/stderr routing, config behavior, valid/corrupt/ghost/untracked state, and transparent execution IO. Keep host-specific values normalized and classify free-form human styling/whitespace as non-contractual unless already frozen.

## Task 5: Prove passive finalization is cache-only

Files expected:

- Modify/add: self-update notice and command-finalization tests

Add a network-spy regression proving ordinary command finalization cannot perform a self-update network request. Verify cached notices remain cache-only and fresh checks occur only in explicitly declared self-upgrade/diagnostic paths.

## Task 6: Milestone validation, review, and PR

Run:

```bash
bun run lint
bun run format:check
bun run typecheck
bun run test
bun run openspec:validate
bun run memory:check
bun run build
bun run package:check
```

Also run the built downstream fixture, both package-local binary names, representative process-level protocol cases, and the non-mutating alias-package metadata probe. Use independent specification and code-quality reviews; fix all Critical/Important findings and repeat affected validation. Only then mark OpenSpec 1.1, 1.4, and 10.1-10.3 complete and create the normalized PR to integration.

## Recovery rule

Resume the first incomplete row in `.superpowers/sdd/progress.md`. Before editing, check `git status`, recent commits, the granular recovery ref, OpenSpec status, and CodeGraph pending-sync state. If a runner, registry, network, or quota failure interrupts delivery, retain the committed checkpoint and retry only the failed validation or remote operation.
