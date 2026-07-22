# Windows Promotion Release Recovery Plan

## Goal

Restore the post-promotion `main` CI and stable release gate after the first full Windows push suite exposed lifecycle Windows execution paths and fixtures that had never executed in pull-request CI. Restore the already-specified provider/process behavior, keep release blocked until the real Windows suite passes, and record the already-earned final-promotion ledger/merge verification as support task 4.4.

Base: `origin/main@cf7555a2be8f1094a19d5a340a2b0f56ac033a97`

Failed main CI: run `29482018836`, Windows job `87567753491`

## Intake classification

This is promotion recovery for an existing redesign contract, not a new product change. The active `redesign-lifecycle-engine` tasks 4.2, 8.3, and 8.4 already require provider cancellation/timeout conformance, process-tree cancellation, and Windows-capable execution tests. The recovery corrects their Windows implementation and deterministic fixtures without changing the durable CI split. No new OpenSpec change is required. The active `support-integration-branch-delivery` change remains the source of truth for promotion/release closure and may record only already-earned task 4.4 in this milestone.

## Root cause

- Product-impacting pull requests intentionally skip the full Windows test command under the historical `qtx-0036` CI cost contract; the required Windows context performs install/build only.
- Protected-branch pushes, workflow dispatches, and scheduled CI execute `bun run test -- --pool=threads` on Windows.
- The lifecycle redesign introduced POSIX-only shebang/chmod fixtures, extensionless Bun lookup, slash-specific basename assertions, and a narrower Unix error-code assertion. These passed Linux/macOS and were not exercised by the PR Windows build context.
- `spawnCommand` selected `Bun.spawn` before resolving Windows PATHEXT shims, so extensionless commands backed by `.cmd` never reached a compatible launch path. A global `shell: true` experiment would have exposed user argv to `cmd.exe` metacharacter interpretation and was rejected during review. Windows extensionless commands and explicit `.cmd`/`.bat` shims instead require `cross-spawn`'s argv-preserving resolution; `.exe`/`.com` remain direct executable launches.
- The read-only signal E2E reused one Bun-based fake `npm` across the full `doctor` catalog. Concurrent probes each spawned a signal-ignoring Bun child while overwriting one PID log, so PR #464 could clean only the final recorded tree when Vitest was interrupted. The managed-installer cancellation E2E also lacked a forced outer process-group fallback. Fixtures must cap concurrency, record or bound every descendant, and self-expire when their runner disappears.
- `doctor` also opened a nested production lifecycle-observation operation instead of reusing its invocation context. The production facade must accept an existing context for composed commands while retaining self-owned context creation for standalone facade callers.
- The final promotion therefore passed every configured merge gate, but the first post-merge full Windows suite failed before Release could run.

## Task 1: Correct deterministic platform assumptions

Resolve Bun from `PATH` while honoring Windows `PATHEXT`; do not assume an extensionless executable or that the Vitest host process is Bun. Route Windows extensionless commands and explicit `.cmd`/`.bat` shims through `cross-spawn` without enabling caller-controlled shell strings, and keep `.exe`/`.com` on the direct Bun path. Prove metacharacter argv is preserved and cannot execute a side command. Reuse the composing command's invocation context for lifecycle observation. Replace unbounded Bun keepalive fixtures with low-resource, single-instance, self-expiring process trees and force-kill E2E runner groups unconditionally in failure cleanup. Mark fixtures that fundamentally depend on POSIX shebangs, chmod, and process groups as POSIX-only instead of presenting them as Windows coverage. Use `path.basename` for path assertions and accept the documented Windows `EEXIST` equivalent for the blocked-directory storage case.

## Task 2: Diagnose and normalize the remaining compatibility delta

Make golden mismatch output include the normalized command text. Push a recoverable checkpoint and run the CI workflow manually on this branch so the full Windows suite executes before merge. If the doctor golden still differs, use the emitted normalized text to make the narrowest platform-neutral normalization or explicitly version the platform contract; do not update the golden hash blindly.

## Task 3: Validate before PR

Run focused local tests, the full local suite, lint, format, typecheck, OpenSpec validation, memory check, and `git diff --check`. Push the branch and run `gh workflow run CI --ref codex/stabilize-windows-promotion-tests`; require the real Windows full-test job plus Ubuntu/macOS/lint to pass. Run an independent diff review and validate a PR body from the repository template.

## Task 4: Deliver recovery to main

Normalize the branch to one conventional commit after remote Windows evidence is green. Create a Ready PR to `main`, wait for required checks and PR Governance, and merge manually with rebase first or squash only after recording a concrete fallback reason. After the main push CI succeeds, observe the normal stable Release workflow and only then record support task 4.5 in the subsequent cleanup milestone.

## Scope boundaries

- Do not broaden runtime behavior beyond the existing redesign Windows process/provider contract or change the historical PR-vs-push Windows workload split, release allowlists, current specs, or archive state.
- Do not mark support 4.5 before stable release classification succeeds.
- Do not start integration teardown while release recovery is active; retain the integration ref, ruleset, and final-promotion ledger.

## Recovery rule

Resume from the latest pushed checkpoint and the latest workflow-dispatch run. Remote Windows failures drive the next narrow correction. Network failures retry only the interrupted remote operation. Never merge a recovery PR whose branch workflow-dispatch Windows full suite has not passed.
