## MODIFIED Requirements

### Requirement: README Supports Language Switching

The product README experience SHALL provide English and Simplified Chinese entry points with visible language switch links near the top of each full product README page. The default root landing page MUST be English-first.

#### Scenario: User switches README language

- **WHEN** a user opens `README.md` or `README.zh-CN.md`
- **THEN** the page provides links for English and Simplified Chinese versions
- **AND** `README.md` is the primary English product landing page

### Requirement: README Presents Quantex As A Product

The root README SHALL prioritize product-facing information before maintainer workflow, project memory, or process documentation, and it MUST do so in English for the default repository landing page.

#### Scenario: New user opens README

- **WHEN** a user opens `README.md`
- **THEN** the first major sections explain in English what Quantex is, why it is useful, how to install it, and how to run common commands
