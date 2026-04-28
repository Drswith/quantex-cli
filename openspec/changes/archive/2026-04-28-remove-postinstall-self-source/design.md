## Context

Today Quantex persists `state.self.installSource` in two ways:

- at install time through the npm/bun `postinstall` hook
- at runtime through `inspectSelf()` reconciliation when the detected source differs from stored state

That means the runtime already has the logic needed to heal missing state. The install-time hook mainly pre-warms state before the first command runs. Removing it is attractive because package install scripts are frequently scrutinized by users and enterprise policy, but we cannot weaken managed self-upgrade or packaging guarantees in the process.

## Goals / Non-Goals

**Goals:**

- Remove the install-time `postinstall` hook from the managed-install package.
- Preserve self-upgrade behavior for bun/npm installs by relying on first-run runtime reconciliation.
- Update package verification, specs, and debugging docs so they match the new contract.

**Non-Goals:**

- Do not change binary-install behavior.
- Do not redesign self-upgrade provider routing or registry resolution.
- Do not introduce a new background initialization command or daemon workflow.

## Decisions

- Treat `inspectSelf()` reconciliation as the single durable persistence path for self install-source state. This keeps the write close to the commands that actually depend on the information.
- Remove `scripts/postinstall.cjs`, the package `postinstall` script, and the packaging requirement that the tarball ship a postinstall entrypoint.
- Keep the existing state reconciliation semantics: when runtime detection is conclusive and differs from stored state, Quantex writes the detected source; when runtime detection is `unknown`, stored state still wins.
- Replace install-time persistence tests with runtime-lazy persistence coverage, including cases where state is initially missing.

## Risks / Trade-offs

- [First-run timing shift] -> Managed installs will not write `state.self.installSource` until a self-inspection surface runs. Mitigation: `upgrade`, `doctor`, and `capabilities` already call `inspectSelf()`, so the commands that need this state still self-heal immediately.
- [Path-detection fragility] -> Without the install-time fallback, runtime path detection matters more. Mitigation: keep and extend tests around bun/npm path detection and missing-state reconciliation.
- [Package contract change] -> Tooling that expected a postinstall entrypoint in the npm tarball will no longer see it. Mitigation: update the package-distribution spec, validator, and runbook together.
