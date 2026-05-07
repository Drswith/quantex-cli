## Why

Windows contributors and agents can accidentally introduce CRLF or editor-specific whitespace churn even though the formatter already normalizes managed code to LF. A root `.editorconfig` should make the repository's cross-platform editing defaults explicit before files reach formatter, lint, or CI.

## What Changes

- Add a root `.editorconfig` that declares UTF-8, final newlines, trailing whitespace trimming, and LF as the default line ending.
- Add a root `.gitattributes` that normalizes tracked text files to LF so Windows `core.autocrlf` settings cannot reintroduce repository-wide CRLF churn.
- Document the EditorConfig contract in the existing code quality tooling specification.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `code-quality-tooling`: Define repository-wide editor defaults and line-ending expectations.

## Impact

- Adds repository root editor configuration consumed by EditorConfig-aware editors.
- Adds repository root Git attributes consumed by Git checkout and commit normalization.
- Updates OpenSpec code quality tooling contract and change tasks.
- No CLI runtime behavior, command schema, package dependency, or release artifact changes.
