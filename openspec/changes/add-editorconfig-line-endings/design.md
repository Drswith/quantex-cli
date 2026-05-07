## Context

The repository already configures `oxfmt` with `endOfLine: "lf"`, but that only applies after formatter execution and only to files inside oxfmt's supported surface. Windows contributors can still create CRLF churn through editor defaults or Git `core.autocrlf` behavior before validation runs.

## Goals / Non-Goals

**Goals:**

- Make LF the repository-wide default for text files at both editor and Git normalization layers.
- Keep editor defaults aligned with the existing two-space, UTF-8, final-newline formatting contract.
- Avoid adding a new formatter, linter, hook, or runtime dependency.

**Non-Goals:**

- Reformatting every tracked file as part of this change.
- Expanding the oxfmt surface to Markdown or generated artifacts.
- Changing CLI runtime behavior or release packaging.

## Decisions

### Use `.editorconfig` for editor defaults

The repository will add a root `.editorconfig` with `root = true`, LF endings, UTF-8 charset, final newlines, trailing whitespace trimming, and two-space indentation. This catches the common Windows editor case before files reach `bun run format` or CI.

Alternative considered:

- Rely only on `.vscode/settings.json`. Rejected because contributors and agents may use other EditorConfig-aware editors.

### Use `.gitattributes` for repository line-ending normalization

The repository will add a root `.gitattributes` with text files normalized to LF. This is the Git-level guard that keeps checkout and commit behavior stable across platforms regardless of local `core.autocrlf` settings.

Alternative considered:

- Add only `.editorconfig`. Rejected because it does not control Git's line-ending conversion.

## Risks / Trade-offs

- [Git may report many files changed if contributors renormalize later] -> This change adds the policy first and avoids a broad reformat unless a future dedicated cleanup needs it.
- [Markdown authors may intentionally use trailing spaces for hard breaks] -> The repository's default trims trailing whitespace; contributors can use explicit Markdown syntax instead of relying on invisible spaces.
