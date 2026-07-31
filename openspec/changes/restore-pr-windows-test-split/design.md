## Context

The current matrix runs `bun run test -- --pool=threads` for every product-impacting Windows pull request. PR #524 demonstrates that this can fail after all test files complete because of a Windows thread-pool shutdown error. The release runbook and the execution handbook already define the intended split: PRs retain Windows install/build coverage, while full Windows tests run after protected-branch integration and on explicit recurring confidence runs.

## Goals / Non-Goals

**Goals:**

- Restore the documented Windows coverage split without removing its required CI context.
- Keep full Windows test coverage for protected-branch, manual, and scheduled executions.
- Make the event boundary explicit in the workflow contract test.

**Non-Goals:**

- Do not weaken Linux or macOS PR tests.
- Do not suppress test failures, add a retry, or set Vitest to ignore unhandled errors.
- Do not change Core SDK, CLI, npm, or release behavior.

## Decisions

- Use the GitHub event name as the boundary: a Windows matrix job runs tests only when the event is not `pull_request`. A pull request still performs checkout, dependency installation, and `bun run build`, preserving Windows compilation and package-resolution feedback.
- Retain `--pool=threads` for the Windows full-test runs. This preserves the established Windows execution mode for protected-branch confidence rather than masking the problem with a different test engine.
- Update the narrow textual workflow test instead of introducing a CI wrapper or a new check context. The existing `test (windows-latest)` context remains stable for branch protection.

## Risks / Trade-offs

- [A Windows-only test regression is detected after merge instead of before merge] → Protected-branch push, manual, and scheduled CI still run the full suite before release automation can use the merged history.
- [The event condition is accidentally widened again] → The focused workflow contract asserts both the PR skip and non-PR full-test condition.
