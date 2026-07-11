# Task 13 Brief: Normalize Script And Binary Catalog Entries

## Objective

Migrate all script and standalone-binary methods to provider-bound candidates with explicit source identity and shell-script/executable effects while preserving agent identity, platform coverage, candidate order, and exact v1 commands.

## Boundary

- Existing string installers become `shell-script` effects without command rewriting.
- Target identity uses the command's installation source URL; a deterministic agent/platform identity is the fallback.
- Candidates declare executable presence only; package/version/update capabilities are not fabricated.
- The v1 projection returns the exact historical `type`, `command`, and optional binary name.
- Orphan legacy metadata not owned by a migrated candidate remains untouched.

## Completion

- Add failing source/effect/v1 projection tests first.
- Migrate all affected catalog files mechanically.
- Regenerate artifacts and run full compatibility gates.
- Mark OpenSpec `4.13`; close `4.2` only if the complete first-party conformance evidence supports it.
