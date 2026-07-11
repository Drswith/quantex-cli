# Task 11 Report: Normalize Cargo, Deno, pip, And uv Catalog Entries

## Result

OpenSpec `4.11` is complete. Cargo, Deno, pip, and uv candidates now bind provider and target identity in five catalog files. Cargo/pip targets are packages; Deno/uv targets are tools; configured install arguments remain attached to the target.

Probe declarations match implemented provider behavior. Cargo, Deno, and pip declare executable presence only. uv additionally declares provider package presence and installed version. None declares unsupported target-version resolution.

## Compatibility projection

- Agent-level Cargo, Deno, pip, and uv package-map keys are reconstructed for v1 consumers.
- Historical type-only methods remain type-only with their arguments.
- A narrow non-identity legacy flag preserves Vibe's existing explicit `packageName` method fields without duplicating the target value.
- Existing package-manager and update behavior remains unchanged.

## Validation

- Focused catalog/schema/compatibility/package-manager/update suite: 7 files / 204 tests passed.
- Full suite: 79 files / 876 tests passed.
- Catalog manifest and public JSON schema regenerated successfully.
- lint: 0 warnings / 0 errors.
- format check, typecheck, OpenSpec 16/16, and memory check passed.

## Scope retained

- Homebrew, winget, script, and binary candidates remain for their dedicated migrations.
- OpenSpec `4.2` remains unchecked pending final first-party conformance closure.
