# code-quality-tooling Delta

## REMOVED Requirements

### Requirement: Local commit-msg hook MUST remove Cursor attribution trailers before commit creation

**Reason**: The hook existed solely to keep commits from tripping the remote co-author trailer policy. That policy is removed, so the hook rewrites commit messages to satisfy a rule that no longer exists.

**Migration**: `scripts/ci/strip-cursor-coauthor.ts`, its test, and the `commit-msg` hook entry in `package.json` are deleted. `pre-commit` and `pre-push` are unchanged apart from dropping the commit-policy step that `align-governance-gates` added; `pre-push` continues to run lint, format check, typecheck, OpenSpec validation, and the project memory check.
