# Task 7 Brief: Represent Script And Binary Effects

## Objective

Represent script and standalone-binary installation as compile-time first-party providers whose targets carry an explicit shell-script or executable effect. Route maintained unmanaged installation through typed outcomes without changing existing catalog commands or platform coverage.

## Boundary

- Add no dynamic provider loading and no new public CLI surface.
- Existing string commands project to explicit `shell-script` effects at the compatibility boundary.
- Direct argv execution is modeled as an `executable` effect without passing through a shell.
- Script/binary providers install only; update and uninstall remain unsupported.
- Capability-table and update-bucket derivation remain Task 8.

## Completion

- Add failing effect/provider/compatibility tests first.
- Preserve legacy shell invocation on Windows and Unix.
- Run focused package-manager/provider tests and full gates.
- Mark only OpenSpec `4.7`, report, and checkpoint commit.
