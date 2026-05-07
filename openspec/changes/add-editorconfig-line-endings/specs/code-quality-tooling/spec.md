## ADDED Requirements

### Requirement: Repository editor and line-ending defaults

The repository SHALL keep a root `.editorconfig` that declares LF line endings, UTF-8 charset, final newlines, trailing whitespace trimming, and two-space indentation as the default editing contract for repository text files. The repository SHALL keep a root `.gitattributes` that normalizes tracked text files to LF so platform-specific Git settings do not introduce CRLF churn.

#### Scenario: Contributor edits on Windows

- **WHEN** a contributor or coding agent edits repository text files on Windows with an EditorConfig-aware editor and Git checkout settings that would otherwise prefer CRLF
- **THEN** the editor defaults prefer LF line endings before formatting runs
- **AND** Git normalization preserves LF line endings for tracked text files

#### Scenario: Contributor inspects formatting policy

- **WHEN** a contributor or coding agent inspects repository formatting and line-ending configuration
- **THEN** `.editorconfig`, `.gitattributes`, and `.oxfmtrc.json` all declare LF as the repository text line-ending policy
