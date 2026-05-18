## Why

Quantex already has remote governance that rejects prohibited `Co-authored-by:` trailers and risky pull-request commit metadata before merge. That protects protected branches, but it does not stop local developer workflows from repeatedly generating Cursor-specific co-author trailers that then have to be removed by hand before every commit or fixed after CI failures.

The local problem is narrower than the remote policy:

- local IDE, CLI, and generated commit-message flows can inject a known Cursor co-author trailer
- the existing remote governance intentionally stays broader than Cursor and must not be weakened to a tool-specific rule
- contributors want a repository-native fix that travels with the repo through `simple-git-hooks`

## What Changes

- add a versioned repository `commit-msg` hook through `simple-git-hooks`
- implement a repository script that strips Cursor's known local attribution trailers (`Co-authored-by: Cursor Agent <cursoragent@cursor.com>` and `Made-with: Cursor`) from the commit message file before commit creation
- document in OpenSpec that the local hook is Cursor-specific while CI governance remains generic

## Impact

- local commits created from clones with hooks installed stop carrying Cursor's co-author trailer by default
- CI and PR governance remain the final generic enforcement layer for non-Cursor `Co-authored-by:` trailers and risky author metadata
- cloud-hosted agent flows that inject metadata after local hooks are still governed remotely rather than by this local hook
