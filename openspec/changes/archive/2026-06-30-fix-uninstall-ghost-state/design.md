## Context

`uninstallAgent()` runs managed uninstall, then calls `removeInstalledAgentState()` only when uninstall returns `true`. A prior attempt can succeed at package removal but fail while writing `state.json`, leaving the agent untracked on disk but still recorded in state. Retries call the package manager again, get `false`, and never clear state.

## Goals / Non-Goals

**Goals**

- Clear ghost state when uninstall can verify the managed package is absent.
- Avoid false recovery when the package manager is unavailable.

**Non-Goals**

- Change Windows deferred binary self-upgrade success semantics.
- Add doctor-only repair flows.

## Decisions

- After managed uninstall returns `false`, call a narrow helper that checks package absence through the existing `getInstalledVersion` installer hook.
- Skip recovery when the installer is unavailable or lacks version probing.
- Reuse `removeInstalledAgentState()` once absence is confirmed.

## Risks / Trade-offs

- [Risk] Mis-detecting absence when version probing is flaky. → Mitigation: only recover when installer is available and `getInstalledVersion` returns `undefined`.
