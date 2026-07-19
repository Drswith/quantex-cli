## 1. Contract and regression coverage

- [x] 1.1 Add failing resolver tests for neutral `Release-As` commits and non-release neutral commits.
- [x] 1.2 Add failing PR-body policy tests for required release-summary commit overrides and explicit Release-As metadata.
- [x] 1.3 Add failing configuration tests that require visible `refactor` changelog types in both release channels.

## 2. Release-note automation

- [x] 2.1 Classify non-empty Release-As footers as release-worthy without changing version ownership.
- [x] 2.2 Configure visible `Internal Improvements` refactor entries for stable and beta release-please output.
- [x] 2.3 Add Release Summary template guidance and shared body-policy validation while preserving dedicated generated Release PR validation.

## 3. Durable documentation and verification

- [x] 3.1 Update the release runbook with the Release-As and commit-override workflow, including the no-false-breaking-marker rule.
- [x] 3.2 Run focused regression tests, lint, format check, typecheck, full tests, OpenSpec validation, and memory validation.
- [x] 3.3 Validate the PR body, commit, push, and open a Ready PR; report release and archive follow-up state.
