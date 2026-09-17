## 1. Ownership contract

- [x] 1.1 Complete OpenSpec proposal, design (including the ownership table), and spec deltas for `runtime-boundaries` and `compatibility-contract`
- [x] 1.2 Record ADR 0015 for the physical Core/CLI split and the documented shared-module exceptions
- [x] 1.3 Point `AGENTS.md` Core lifecycle triggers at `packages/core/src/lifecycle/` without expanding the handbook

## 2. Physical move

- [x] 2.1 Move Core implementation from `src/core/**` into `packages/core/src` and stop package re-exports of root `src/core`
- [x] 2.2 Rewrite Core imports that escaped into root shared modules; retarget Core runtime type imports off the `src/runtime` barrel
- [x] 2.3 Retarget CLI, state, package-manager, catalog generation, leftover/ownership tests, and other importers onto `packages/core/src` / `quantex-core` / `quantex-core/internal`
- [x] 2.4 Delete leftover root `src/core` runtime files; keep Core-internal lifecycle barrel-free

## 3. Architecture enforcement

- [x] 3.1 Update `test/architecture/core-boundary.test.ts` for Core source ownership, CLI → Core direction, documented shared-module allowlist, type-leaf reverse edges, and deferred package-manager exception
- [x] 3.2 Retarget leftover scans and Core ownership tests from `src/core` to `packages/core/src` while still forbidding restored `src/lifecycle` and published engine/route identifiers
- [x] 3.3 Preserve lazy mutation loading, published SDK freeze, and `first-party` exclusion assertions

## 4. Validation and delivery

- [x] 4.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`
- [x] 4.2 Run `bun run test`
- [x] 4.3 Run `bun run openspec:validate` and `bun run memory:check`
- [x] 4.4 Commit, push, and open a draft PR for #741 that includes the ownership table, moved vs deferred modules, and architecture-only changelog framing. Do not auto-ready. Do not cut a release.

## 5. Product-locked ownership alignment

- [x] 5.1 Rewrite the ownership table to Core = lifecycle domain + provider/state/receipt, CLI = commands / presentation / exit policy / self-upgrade UI, and neutral boundary = shared catalog + type-leaf
- [x] 5.2 Record physical stop points: do not move `src/providers` (package-manager unlocked) or `src/state` (CLI `config` + `self/types`) in this knife; do not guess package-manager / runtime / agent-update
- [x] 5.3 Encode the product lock and stop points in architecture tests
- [x] 5.4 Keep the PR draft. Do not auto-ready. Do not cut a release. Changelog remains internal/architecture.
