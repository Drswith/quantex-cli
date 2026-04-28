## Why

The current pre-commit hook routes staged YAML files such as OpenSpec `.openspec.yaml` through `oxfmt --write`, but the installed formatter does not accept those files in this repository setup. That makes otherwise valid commits fail during archive and tooling workflows.

## What Changes

- Narrow the pre-commit formatter target set so `lint-staged` only sends file types that `oxfmt` can actually format in this repository.
- Keep JavaScript and TypeScript staged files on the existing `oxfmt` then `oxlint --fix` path.
- Add or update tests/spec coverage for the corrected pre-commit formatting contract.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `code-quality-tooling`: pre-commit formatting targets exclude unsupported staged file types that would cause `oxfmt` to fail.

## Impact

- Affected code: `package.json` lint-staged configuration and related tooling specs.
- Affected workflow: pre-commit behavior for OpenSpec archive files and other staged YAML/config sources.
- Dependencies: no new runtime dependency.
