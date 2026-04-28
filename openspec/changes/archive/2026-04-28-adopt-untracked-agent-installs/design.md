## Context

Quantex already distinguishes between recorded install state and a bare `PATH` detection. That lets `update --all` avoid mutating binaries that Quantex did not install or track. The bug is that the prescribed recovery path does not work for single-method unmanaged agents such as Cursor CLI: `install` and `ensure` return early as soon as the binary is in `PATH`, so they never persist the script install state that batch update planning requires.

The fix needs to preserve the existing safety boundary. A `PATH` hit alone is not enough to infer whether an agent came from Bun, npm, Homebrew, a vendor script, or some other manual setup. If Quantex guesses wrong, later update or uninstall operations could target the wrong lifecycle source.

## Goals / Non-Goals

**Goals:**

- Let `install` / `ensure` reconcile an existing install into Quantex state when the current platform exposes one safe, unambiguous unmanaged install method.
- Preserve the rule that `update --all` only acts on recorded install state.
- Make ambiguous `PATH` detections clearly explain why they remain untracked.

**Non-Goals:**

- Do not auto-adopt agents with multiple plausible install sources.
- Do not change batch update planning to act on untracked `PATH` detections again.
- Do not introduce new interactive prompts or workflow-orchestration behavior.

## Decisions

- Treat an existing install as safely adoptable only when the current platform resolves exactly one supported install method and that method is unmanaged (`script` or `binary`). This is narrow, but it covers Cursor CLI and avoids inventing package-manager ownership.
- Add a package-manager helper that persists the derived install state without re-running an installer. Command handlers will call it only after inspection proves the install is already present in `PATH`.
- Keep the existing state model. Adopted installs will reuse the same `InstalledAgentState` shape as regular installs, including the unmanaged install command when available.
- For `install` / `ensure`, distinguish three cases:
  - tracked install already exists: no-op "already installed"
  - untracked but safely adoptable existing install: record state and report that Quantex is now tracking it
  - untracked and ambiguous existing install: no state change, and output explains that Quantex refused to guess the source

## Risks / Trade-offs

- [Narrow adoption scope] → Some existing installs with multiple supported methods will still require manual reinstall through Quantex. This is intentional; clearer messaging will explain why Quantex did not guess.
- [State drift after adoption] → A user could later replace the binary outside Quantex. This is an existing lifecycle risk; future inspections still compare recorded state with runtime detection before choosing update behavior.
- [Different human output paths] → Install and ensure now have a third "tracked existing install" outcome. Regression tests will pin the wording and structured result shape.
