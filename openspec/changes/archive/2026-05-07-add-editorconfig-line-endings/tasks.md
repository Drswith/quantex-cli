## 1. OpenSpec And Contract Updates

- [x] 1.1 Add proposal, design, and code-quality-tooling spec delta for repository editor and line-ending defaults.

## 2. Repository Configuration

- [x] 2.1 Add root `.editorconfig` with cross-editor LF, UTF-8, final-newline, trailing-whitespace, and indentation defaults.
- [x] 2.2 Add root `.gitattributes` with Git-level LF normalization for tracked text files.

## 3. Validation

- [x] 3.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run openspec:validate`.
