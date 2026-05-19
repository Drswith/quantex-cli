## ADDED Requirements

### Requirement: Local commit-msg hook MUST remove Cursor attribution trailers before commit creation

The repository SHALL enforce a versioned `commit-msg` hook through `simple-git-hooks` that strips the exact Cursor-injected attribution trailer lines from the commit message file before Git finalizes a local commit. This local hook MUST target Cursor's known local attribution formats only and MUST NOT narrow or replace the broader remote co-author governance enforced by CI.

#### Scenario: Local commit message contains a Cursor co-author trailer

- **GIVEN** a local IDE, CLI agent, or commit-message generator writes `Co-authored-by: Cursor Agent <cursoragent@cursor.com>` into the commit message file
- **WHEN** the repository `commit-msg` hook runs
- **THEN** the hook removes that trailer line before Git creates the commit
- **AND** the contributor does not need to hand-edit the generated message to satisfy local authorship policy

#### Scenario: Local commit message contains a Cursor made-with trailer

- **GIVEN** a local IDE, CLI agent, or commit-message generator writes `Made-with: Cursor` into the commit message file
- **WHEN** the repository `commit-msg` hook runs
- **THEN** the hook removes that trailer line before Git creates the commit
- **AND** the contributor does not need to hand-edit the generated message to satisfy local authorship policy

#### Scenario: Local commit message contains a non-Cursor co-author trailer

- **GIVEN** a local commit message contains a `Co-authored-by:` trailer for an identity other than Cursor's known trailer identity
- **WHEN** the repository `commit-msg` hook runs
- **THEN** the hook leaves that trailer untouched
- **AND** the existing CI and PR governance checks remain responsible for rejecting prohibited non-Cursor co-author metadata before merge
