# Task 13 Report: Normalize Script And Binary Catalog Entries

## Result

OpenSpec `4.13` is complete. Every script catalog method now binds the script provider, an exact installation-source URL, a matching script target, an explicit shell-script effect containing the unchanged command, and executable-presence probe declaration. The schema also supports standalone-binary executable effects; no current catalog entry uses a binary method.

Agent identity, platform coverage, candidate ordering, optional binary overrides, and exact PowerShell/shell command strings remain unchanged in the v1 projection.

## Conformance closure

OpenSpec `4.2` is also complete. The reusable conformance harness covers all managed adapters for unsupported operations, failure diagnostics, cancellation, timeout, presence, and verification evidence. Effect-only providers have tailored equivalent coverage for typed execution failure, cancellation, timeout, indeterminate observation, and unsupported update/uninstall operations.

## Validation

- Focused effect/catalog/compatibility/package-manager suite: 8 files / 186 tests passed.
- Full suite: 81 files / 881 tests passed.
- Catalog manifest and public JSON schema regenerated successfully.
- lint: 0 warnings / 0 errors.
- format check, typecheck, OpenSpec 16/16, and memory check passed.

## Scope retained

- Legacy orphan metadata not owned by a migrated candidate remains untouched.
- Generated support documentation and validation inputs remain OpenSpec `4.14`.
