# Tasks: Fix VTCode Windows Install Order

## 1. Catalog behavior

- [x] 1.1 Reorder VTCode Windows install methods so Cargo is attempted before the upstream PowerShell script.
- [x] 1.2 Add regression coverage for the VTCode Windows method order.

## 2. OpenSpec and validation

- [x] 2.1 Update the `agent-catalog` OpenSpec delta for the VTCode Windows install method ordering.
- [x] 2.2 Run `bun run lint`.
- [x] 2.3 Run `bun run format:check`.
- [x] 2.4 Run `bun run typecheck`.
- [x] 2.5 Run `bun run test`.
- [x] 2.6 Run `bun run openspec:validate`.
