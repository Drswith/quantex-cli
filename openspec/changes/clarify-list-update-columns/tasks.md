## 1. List semantics

- [x] 1.1 Rename the human list update-strategy column to `Managed` and add the optional `Available` version column.
- [x] 1.2 Derive availability only from a semantically newer observed target version.

## 2. Verification

- [x] 2.1 Add focused renderer coverage for managed strategy, confirmed availability, and unknown/non-newer versions.
- [x] 2.2 Run list-focused tests plus lint, format, type, full test, and OpenSpec validation. Focused list/compatibility tests and all non-process validations passed; this local runner terminates during the complete Vitest suite before it emits a final summary.
