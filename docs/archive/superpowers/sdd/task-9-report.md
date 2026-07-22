# Task 9 Report: Define Normalized Catalog Candidates

## Result

OpenSpec `4.9` is complete. The internal catalog-source schema now supports normalized candidates that bind one provider to one exact target identity, optional operation arguments and executable override, explicit script/binary effects, and declared lifecycle probes.

Provider-specific target kinds are structurally constrained: registry and Python packages use package/tool identities, Homebrew uses formula/cask, winget uses package ID, and script/binary candidates require matching effect-bearing targets. A staged source union permits provider groups to migrate independently.

## TDD evidence

- Red: schema/projection tests failed until normalized candidate and staged source schemas existed.
- Green: tests cover strict unknown-field rejection, provider/target mismatch rejection, shell/executable effects, uv argument projection, and mixed legacy/normalized source entries.
- Generated catalog source now parses through the staged schema and projects to the maintained `AgentDefinition` shape.

## Validation

- Focused schema/catalog/compatibility suite: 3 files / 118 tests passed.
- Full suite: 77 files / 872 tests passed.
- lint: 0 warnings / 0 errors.
- format check, typecheck, OpenSpec 16/16, and memory check passed.

## Compatibility retained

- The public v1 `agentCatalogSchema`, generated JSON schema, root exports, and `AgentDefinition` remain unchanged.
- Regenerating the public catalog JSON schema produced no content diff after formatting.
- No catalog JSON entry was migrated in this task.
- Provider-group data migration begins with OpenSpec `4.10`.
