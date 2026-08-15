# CLI Contract Registry Specification

## Purpose

Define one authoritative command contract for executable registration, discovery, schemas, effects, and validation without expanding Quantex into workflow orchestration.

## Requirements

### Requirement: CommandSpec is the authoritative command contract

Quantex MUST define every public command and global option through exactly one authoritative `CommandSpec` registry entry that supplies executable registration, command discovery, machine-readable schema, and effect metadata.

#### Scenario: Inspect one registered command across surfaces

- **GIVEN** a command has a valid `CommandSpec` entry
- **WHEN** a user invokes the command and a machine consumer inspects command discovery, schema, and effect metadata
- **THEN** all four surfaces derive the command from that same entry

### Requirement: Generated command surfaces remain consistent

CLI registration, command discovery, and machine-readable schema SHALL expose consistent canonical names, aliases, arguments, options, defaults, constraints, and availability for every command.

#### Scenario: Compare accepted options with schema

- **GIVEN** an option is declared for a command in the registry
- **WHEN** the option is inspected through discovery and schema and then passed to the command
- **THEN** discovery and schema describe the same option contract that CLI parsing accepts

### Requirement: Effect metadata comes from the command contract

Every `CommandSpec` MUST declare the command's externally relevant effects. Quantex SHALL derive validation, help metadata, and any protocol version that exposes effects from that declaration without a separate command-to-effect catalog. The v1 compatibility projection MUST NOT add effect fields that its current strict schema does not allow.

#### Scenario: Inspect a mutating lifecycle command

- **GIVEN** a lifecycle command declares mutating effects in its `CommandSpec`
- **WHEN** Quantex validates the command or generates a command surface that supports effect metadata
- **THEN** the effect classification comes from the same canonical command entry
- **AND** the v1 compatibility projection remains unchanged unless a separately negotiated protocol version exposes the effect fields

### Requirement: Invalid command contracts fail before dispatch

Quantex MUST reject registry definitions with conflicting command names or aliases, missing executable behavior, or internally inconsistent argument, option, schema, or effect declarations before dispatching a command.

#### Scenario: Two commands claim the same alias

- **GIVEN** two `CommandSpec` entries claim the same alias
- **WHEN** Quantex validates the command registry
- **THEN** validation fails deterministically before either command can execute

### Requirement: The registry remains a command catalog

The `CommandSpec` registry SHALL describe independently invocable Quantex commands and MUST NOT become a workflow graph, scheduler, daemon contract, or cross-command orchestration model.

#### Scenario: Inspect registry capabilities after the redesign

- **GIVEN** the lifecycle engine and command registry redesign is active
- **WHEN** a consumer inspects the command schema
- **THEN** the schema describes command invocation contracts without adding workflow dependencies, scheduling, or background orchestration semantics
