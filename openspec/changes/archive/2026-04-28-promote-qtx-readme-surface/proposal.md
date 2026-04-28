## Why

Discussion #69 identified that Quantex's product-facing documentation no longer matches the project's preferred onboarding path. The published README surfaces `quantex` as the dominant entry point and treats no-install trial commands as incidental, even though the package already ships both `quantex` and `qtx` binaries and read-only discovery commands are well suited to zero-install evaluation.

## What Changes

- Recommend `qtx` as the preferred short entry point in product-facing README examples while keeping `quantex` visibly documented as the equivalent long form.
- Add a first-class no-install try-it-out section for read-only commands and document which command forms are supported and safe to recommend.
- Keep `README.md`, `README.en.md`, and `skills/quantex-cli/SKILL.md` aligned so the human-facing and agent-facing surfaces do not drift.
- Record the documentation contract changes in OpenSpec so future README edits keep the preferred entry point and no-install guidance accurate.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `product-readme`: README requirements will define `qtx` as the recommended short entry point, preserve `quantex` discoverability, and require first-class read-only no-install guidance that matches verified command forms.

## Impact

- Affected artifacts: `README.md`, `README.en.md`, `skills/quantex-cli/SKILL.md`, and `openspec/specs/product-readme/spec.md`.
- Affected workflow: Issue #75 delivers the README work from Discussion #69; Issue #76 tracks the separate Windows binary consistency follow-up outside this documentation-scoped change.
