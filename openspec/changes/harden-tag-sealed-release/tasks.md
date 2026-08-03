## 1. Release Contract

- [x] 1.1 Add exact tag, branch, commit, version, channel, and successful-CI validation
- [x] 1.2 Add deterministic release-note extraction and candidate manifest generation
- [x] 1.3 Remove publication selection from protected-branch history reconciliation

## 2. GitHub Actions

- [x] 2.1 Add a branch-scoped Release PR preparation workflow
- [x] 2.2 Add a protected-branch release sealing workflow with explicit tag dispatch
- [x] 2.3 Replace publication with a tag-only build-once and promote workflow
- [x] 2.4 Add idempotent draft release, asset, npm integrity, and final release closure

## 3. Governance and Documentation

- [x] 3.1 Require generated Release PRs to be re-authored as one maintainer commit
- [x] 3.2 Update release documentation and the central runtime skill with the new sequence and recovery boundary

## 4. Verification and Delivery

- [x] 4.1 Add unit and workflow-contract regression coverage
- [x] 4.2 Run lint, format check, typecheck, tests, OpenSpec validation, memory validation, builds, and release artifact validation
- [x] 4.3 Commit, push, validate the PR body, and create the delivery PR
