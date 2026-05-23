## Context

The archived `fix-managed-installer-cancellation` change made cancellation sticky and joined, and it added Windows `taskkill /T /F` as a process-tree cleanup path. The follow-up e2e reproduction exposed an ordering issue: if the direct child is a Windows wrapper process and Quantex kills it first, the wrapper can disappear before `taskkill` walks the process tree. The real installer child can then outlive Quantex.

## Goals / Non-Goals

**Goals:**

- Prefer Windows process-tree termination before direct wrapper termination for managed child processes.
- Exercise the real command runtime, package-manager, and state path with an isolated fake Cargo installer.
- Keep the existing managed installer cancellation surface and structured output semantics.

**Non-Goals:**

- Introduce native Windows job objects.
- Change install/update/uninstall command schemas.
- Reopen or rewrite the archived #237 OpenSpec change.

## Decisions

1. Windows process-tree cleanup runs before direct child kill.

   This preserves the process tree long enough for `taskkill /T /F /PID <pid>` to reach descendants created by wrappers such as `.cmd` launchers. Direct `proc.kill('SIGTERM')` remains as a fallback.

2. The e2e smoke runs as a real child process.

   The regression uses a sandboxed `HOME`, `USERPROFILE`, and `PATH`, then invokes `bun run scripts/managed-installer-cancellation-smoke.ts`. This exercises Quantex command runtime behavior rather than only unit-level child-process helpers.

3. The fake installer records the failure mode.

   Fake Cargo logs version probing and `install`, then waits long enough that Quantex must cancel it. If cleanup fails, it records completion and can exit successfully, which the e2e test rejects.

## Risks / Trade-offs

- [taskkill unavailable or denied] -> Direct child termination still runs as fallback and sticky cancellation prevents success state from being persisted.
- [Timing-sensitive e2e] -> The fake installer uses bounded waits and asserts elapsed time to keep the test deterministic while still covering the user-visible failure mode.
