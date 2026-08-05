# code-quality-tooling Delta

## ADDED Requirements

### Requirement: Pre-push MUST enforce commit policy through the shared CI validator

The repository SHALL run commit policy locally in the `pre-push` hook using the same shared validator that GitHub Actions runs, so that a prohibited co-author trailer or a commit author identity that GitHub squash merge can re-emit as a `Co-authored-by` trailer is reported before the push instead of after a remote round trip. Local and remote enforcement SHALL call one implementation, so the two cannot diverge.

This requirement complements, and does not narrow, the existing `commit-msg` hook: that hook rewrites Cursor attribution trailers in the message body and by construction cannot observe commit author identity, which is supplied by Git configuration rather than by the message file.

Local enforcement SHALL fail closed on real policy violations and SHALL be a clean no-op when there is nothing to compare — no upstream branch, no commits ahead of the comparison base, or an unresolvable base MUST NOT be reported as a violation.

#### Scenario: Local push carries a risky author identity

- **WHEN** a contributor pushes a branch whose commits are authored by an identity that GitHub squash merge can re-emit as a `Co-authored-by` trailer
- **THEN** the `pre-push` hook MUST fail with the same message the CI governance job would report

#### Scenario: Local push carries a prohibited trailer

- **WHEN** a contributor pushes a branch whose commit messages contain a `Co-authored-by:` trailer
- **THEN** the `pre-push` hook MUST fail before the push reaches the remote

#### Scenario: Nothing to validate

- **WHEN** the `pre-push` hook runs with no resolvable comparison base or no commits ahead of it
- **THEN** the commit policy check MUST pass as a no-op rather than reporting a violation
