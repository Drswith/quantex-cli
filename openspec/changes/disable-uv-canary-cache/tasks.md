## 1. Workflow Repair

- [x] 1.1 Disable setup-uv's persisted package cache for uv-backed real-agent canary jobs without changing uv installation or lifecycle execution.
- [x] 1.2 Add a workflow regression that requires the explicit no-cache input and rejects warning suppression as a substitute.

## 2. Validation

- [x] 2.1 Run the focused workflow regression and actionlint for `agent-canary.yml`.
- [x] 2.2 Run lint, format check, typecheck, the full test suite, OpenSpec validation, and project-memory validation.

## 3. Delivery

- [ ] 3.1 Commit and push the dedicated branch, create a policy-validated PR, and confirm its applicable checks pass.
- [ ] 3.2 Dispatch the full agent canary from the branch and confirm the OpenHands and Vibe jobs complete without the missing dependency-cache annotation.
