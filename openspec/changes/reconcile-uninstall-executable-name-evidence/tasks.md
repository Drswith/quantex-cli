## 1. Reconcile uninstall evidence through the canonical comparator

- [x] 1.1 Replace the private `providerBindingsMatch` helper in `src/commands/uninstall.ts` with `providerBindingsEqual` from `src/lifecycle`, passing `agent.binaryName` as the default executable name.
- [x] 1.2 Document at the call site why the default is required: state bindings omit the executable name for package providers while receipts written by `qtx update` carry it.
- [x] 1.3 Confirm the two remaining `conflicting-source` sites in `src/commands/uninstall.ts` are unmodified.

## 2. Correct the pinned receipt shape

- [x] 2.1 Add `executableName: 'test-bin'` to the `managedReceipt` fixture in `test/commands/uninstall.test.ts`, matching every other lifecycle-receipt fixture and the shape `qtx update` persists.
- [x] 2.2 Confirm the corrected fixture leaves the existing `conflicting-source` cases asserting genuine provider or target divergence, not the default-name difference.

## 3. Regression coverage

- [x] 3.1 Add coverage asserting a receipt whose `executableName` equals the agent's `binaryName` reconciles with package-provider state that records no executable name, and reaches managed uninstall.
- [x] 3.2 Add coverage asserting the mirror case: state recording the default executable name reconciles with a receipt that omits it.
- [x] 3.3 Add coverage asserting a receipt naming a genuinely different executable still returns the `conflicting-source` failure without invoking provider uninstall.

## 4. Validation and closure

- [x] 4.1 Run `bun run lint`, `bun run format:check`, and `bun run typecheck`.
- [x] 4.2 Run `bun run test`.
- [x] 4.3 Run `bun run openspec:validate`.
- [x] 4.4 Verify the reproduction against the recorded state that triggered this change: the state and receipt bindings for a `bun`-managed agent must reconcile.
- [x] 4.5 Confirm the corrected fixture fails without the comparator fix: reverting `src/commands/uninstall.ts` alone turns 10 cases in `test/commands/uninstall.test.ts` red.
- [ ] 4.6 Report validation, OpenSpec, git, commit, push, PR, release, and archive-closure status.

## 5. Follow-up (not implemented here)

- [x] 5.1 Record the validation gap in `design.md`: a seeded-old-version update scenario in `scripts/smoke/lifecycle-smoke.ts`, and a cross-command contract test asserting every receipt writer's output is accepted by the uninstall reader.
