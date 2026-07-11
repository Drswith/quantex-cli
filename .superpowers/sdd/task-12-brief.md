# Task 12 Brief: Normalize Homebrew And winget Catalog Entries

## Objective

Migrate Homebrew and winget methods to provider-bound candidates while preserving formula, cask, exact package-ID, package-name, and platform semantics in the v1 projection.

## Boundary

- Homebrew methods without `cask` bind formula targets; cask methods bind cask targets.
- winget methods bind exact ID targets.
- Both providers declare executable presence only because their current adapters do not expose package presence/version probes.
- Existing package names and `packageTargetKind` values remain unchanged after projection.
- Script/binary methods remain untouched.

## Completion

- Add failing source and representative v1 projection tests first.
- Migrate the fourteen affected catalog files mechanically.
- Regenerate catalog artifacts and run full gates.
- Mark only OpenSpec `4.12`, report, and checkpoint commit.
