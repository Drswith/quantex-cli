# product-readme Spec Delta

## ADDED Requirements

### Requirement: Product Metadata Supports Search Discovery

Quantex package metadata and README opening copy SHALL use clear, relevant discovery terms for the product's actual category: an AI coding assistant CLI lifecycle manager for installation, inspection, update, uninstall, execution, discovery, and machine-readable automation.

#### Scenario: User finds Quantex through package or repository search

- **WHEN** a user sees Quantex in a package registry or repository search result
- **THEN** the package description and README opening identify Quantex as a lifecycle CLI for AI coding assistant CLIs
- **AND** package keywords remain directly related to Quantex, supported AI coding assistant CLI categories, lifecycle commands, and machine-readable agent usage
- **AND** the metadata does not claim workflow orchestration, daemon, MCP server, or unrelated platform capabilities

#### Scenario: Maintainer updates discoverability copy

- **WHEN** a maintainer changes README opening copy or package search metadata
- **THEN** the wording stays natural and user-readable instead of keyword-stuffed
- **AND** the English and Simplified Chinese README openings preserve the same product positioning
