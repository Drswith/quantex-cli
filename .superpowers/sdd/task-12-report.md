# Task 12 Report: Normalize Homebrew And winget Catalog Entries

## Result

OpenSpec `4.12` is complete. Homebrew and winget methods now bind provider and exact provider-specific target identity in fourteen catalog files. Homebrew candidates distinguish formula from cask structurally; winget candidates bind exact package IDs.

Both provider groups declare executable presence only. Their current adapters do not expose real package presence or installed-version probes, so no unsupported capability was added.

## Compatibility projection

- Formula candidates project to historical Homebrew methods without `packageTargetKind`.
- Cask candidates project with the exact historical `cask` marker.
- winget candidates project with exact package names and the historical `id` marker.
- Agent identity, platform coverage, candidate ordering, and command formatting remain unchanged.

## Validation

- Focused catalog/compatibility/package-manager/update suite: 7 files / 202 tests passed.
- Full suite: 80 files / 878 tests passed.
- Catalog manifest and public JSON schema regenerated successfully.
- lint: 0 warnings / 0 errors.
- format check, typecheck, OpenSpec 16/16, and memory check passed.

## Scope retained

- Script and standalone-binary candidates remain for OpenSpec `4.13`.
- OpenSpec `4.2` remains unchecked pending final first-party conformance closure.
