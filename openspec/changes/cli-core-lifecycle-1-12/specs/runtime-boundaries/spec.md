## ADDED Requirements

### Requirement: New lifecycle mutation behavior SHALL land in in-repo Core, not a thicker CLI

Quantex SHALL place new or relocated agent lifecycle mutation behavior for
`install`, `ensure`, `update`, and `uninstall` in in-repo Core modules under the
Core ownership boundary for the 1.12 CLI lifecycle slice. The CLI MUST remain a
thin compatibility shell for presentation and process policy. Relocating those
engines MUST NOT, by itself, expand the published `quantex-core` package export
surface.

#### Scenario: Update or uninstall engine is selected

- **WHEN** the CLI selects Core for `update` or `uninstall`
- **THEN** the mutation engine executes from in-repo Core-owned modules
- **AND THEN** those modules remain absent from the published package root
  export unless a separately approved SDK change adds them

#### Scenario: CLI command module stays presentation-focused

- **WHEN** a promoted lifecycle command runs on the Core route
- **THEN** the command module may parse argv, choose the engine route, project
  Core outcomes into v1 human/JSON/NDJSON results, and apply exit policy
- **AND THEN** it does not become a second lifecycle engine implementation
