## Why

Generated release metadata is intentionally excluded from oxlint, but its lone
staged TypeScript file still causes lint-staged to fail on an empty input set.

## What Changes

- Treat an oxlint invocation with no non-ignored staged JavaScript or
  TypeScript files as a successful no-op.
- Keep real lint failures commit-blocking.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `code-quality-tooling`: Allow ignored staged TypeScript groups to complete
  without a false lint failure.

## Impact

Updates the lint-staged command and its configuration test.
