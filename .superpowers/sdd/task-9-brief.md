# Task 9 Brief: Define Normalized Catalog Candidates

## Objective

Define a strict internal catalog-source schema in which a normalized candidate binds one provider to one provider-specific target and declares its available lifecycle probes. Preserve the public v1 catalog JSON schema and project normalized source candidates to the maintained `AgentDefinition` shape.

## Boundary

- The public `agentCatalogSchema`, JSON schema, root exports, and `AgentDefinition` remain unchanged.
- The internal source schema temporarily accepts legacy methods and normalized candidates so provider groups can migrate independently.
- Provider/target-kind combinations are validated structurally.
- Script/binary targets require explicit execution effects.
- No catalog JSON entry is migrated in this task.

## Completion

- Add failing schema/projection/compatibility tests first.
- Parse generated source data through the staged internal schema.
- Run catalog generation, schema, compatibility, and full gates.
- Mark only OpenSpec `4.9`, report, and checkpoint commit.
