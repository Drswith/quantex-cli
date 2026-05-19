## Summary

Implement the local mitigation at the `commit-msg` stage using the repository's existing `simple-git-hooks` installation path.

## Decision

Use a repository-owned Bun/TypeScript script invoked from `simple-git-hooks` `commit-msg` rather than a shell-only one-liner.

## Rationale

- portability: one Bun script works the same on macOS, Linux, and Windows shells used by contributors
- versioned behavior: the exact strip rule lives in the repo and can be tested with Vitest
- narrow scope: the script can intentionally remove only Cursor's known local attribution trailer formats, avoiding accidental policy drift from the broader CI validator

## Non-Goals

- replacing CI or PR governance checks with a local hook
- stripping arbitrary non-Cursor `Co-authored-by:` trailers from local commits
- stripping arbitrary non-Cursor branding or provenance trailers beyond Cursor's known local formats
- fixing hosted cloud-agent server-side metadata injection that happens outside local Git hook execution
