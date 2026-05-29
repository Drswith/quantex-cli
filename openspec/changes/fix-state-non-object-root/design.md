## Approach

Validate the parsed `state.json` document with the same plain-object guard used elsewhere in Quantex state normalization. If the root is `null`, an array, or a primitive, throw `StateFileError` before normalizing `installedAgents` or `self`.

## Non-goals

- Changing `config.json` read/write semantics (tracked separately).
- Migrating legacy agent rename keys in persisted state.

## Risks

- Low: malformed files that previously appeared as empty state will now error until repaired manually.
