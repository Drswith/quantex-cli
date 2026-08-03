## Context

The formatter command already tolerates empty post-ignore groups. The oxlint
command needs the equivalent native flag.

## Decisions

Use oxlint's `--no-error-on-unmatched-pattern` flag. It preserves linting for
all selected source while making a fully ignored group a no-op.

## Risks / Trade-offs

- [A glob unexpectedly selects no files] → Repository-wide `bun run lint` and
  CI remain mandatory; real matched-file diagnostics still fail commits.
