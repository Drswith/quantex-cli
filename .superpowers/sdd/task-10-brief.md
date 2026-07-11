# Task 10 Brief: Normalize npm, Bun, And mise Catalog Entries

## Objective

Migrate every npm, Bun, and mise catalog method to provider-bound candidates with explicit target identity and lifecycle probes. Remove their duplicate agent-level package metadata while preserving the projected v1 `AgentDefinition` exactly.

## Boundary

- npm/Bun bind the historical npm package; mise binds its historical tool reference.
- npm/Bun declare package, executable, installed-version, and target-version probes.
- mise declares package, executable, and installed-version probes; no target-version capability is fabricated.
- The catalog adapter reconstructs legacy package maps and type-only methods for v1 consumers.
- Other provider groups and methods remain untouched.

## Completion

- Add failing raw-source and v1 projection tests first.
- Apply one deterministic mechanical migration across catalog JSON.
- Regenerate catalog manifests and prove generated/public compatibility.
- Run full gates, mark only OpenSpec `4.10`, report, and checkpoint commit.
