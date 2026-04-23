# ADRs

Architecture Decision Records capture durable design or scope decisions that future contributors and agents need to understand.

Use `bun run adr:new -- --title "Decision title"` to scaffold a new ADR with the next available number.

Use an ADR when:

- a decision changes project direction or constraints
- you are choosing between meaningful alternatives
- the decision will still matter months later

Do not use an ADR for:

- temporary implementation notes
- work logs
- one-off debugging details

## Naming

- one file per decision
- keep a numeric prefix for stable ordering
- prefer concise, durable titles

Start from [0000-template.md](./0000-template.md).
