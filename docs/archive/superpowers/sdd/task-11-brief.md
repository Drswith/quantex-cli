# Task 11 Brief: Normalize Cargo, Deno, pip, And uv Catalog Entries

## Objective

Migrate Cargo, Deno, pip, and uv methods to provider-bound candidates while preserving package arguments and the historical v1 distinction between type-only methods and methods carrying an explicit package name.

## Boundary

- Cargo/pip use package targets; Deno/uv use tool targets.
- Cargo, Deno, and pip declare only executable presence because their provider adapters do not currently expose package presence/version.
- uv declares executable, package-presence, and installed-version probes.
- No target-version capability is fabricated.
- A narrow legacy projection flag preserves existing explicit method package names without duplicating target identity.
- Other provider groups remain untouched.

## Completion

- Add failing raw-source, argument, probe, and v1 projection tests first.
- Migrate the five affected catalog files mechanically.
- Regenerate catalog artifacts and run full gates.
- Mark only OpenSpec `4.11`, report, and checkpoint commit.
