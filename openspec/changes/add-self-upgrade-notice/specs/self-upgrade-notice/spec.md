# Self-Upgrade Notice Specification

## Purpose

Define the passive human-mode reminder behavior for outdated Quantex CLI installs.

## ADDED Requirements

### Requirement: Human-mode runtime commands MUST be able to remind about self updates

Quantex SHALL be able to show a lightweight reminder after a successful human-mode runtime command when the installed CLI version is older than the installable latest version.

#### Scenario: Successful human-mode command detects a newer Quantex version

- GIVEN the user runs a Quantex management command that executes through the shared runtime
- AND the command returns success in human output mode
- AND Quantex resolves a newer `latestVersion` than `currentVersion`
- WHEN post-command reminders are evaluated
- THEN Quantex shows a short self-upgrade notice after the command output

### Requirement: Self-upgrade reminders MUST stay out of machine-facing output

Quantex SHALL not inject passive self-upgrade reminders into structured command surfaces.

#### Scenario: JSON output mode

- GIVEN the user runs a runtime command with `--json` or `--output json`
- WHEN Quantex evaluates passive self-upgrade reminders
- THEN it does not render a human reminder
- AND the command result payload remains unchanged

#### Scenario: NDJSON output mode

- GIVEN the user runs a runtime command with `--output ndjson`
- WHEN Quantex evaluates passive self-upgrade reminders
- THEN it does not render a human reminder
- AND no extra NDJSON events are emitted for the reminder

### Requirement: Self-upgrade reminders MUST respect operator intent and command ownership

Quantex SHALL suppress passive reminders when the current command already owns self-upgrade messaging or the operator asked for quieter output.

#### Scenario: Quiet mode suppresses the reminder

- GIVEN the user runs a runtime command in human mode with `--quiet`
- WHEN Quantex evaluates passive self-upgrade reminders
- THEN it does not render the reminder

#### Scenario: Explicit self-upgrade command owns the messaging

- GIVEN the user runs `quantex upgrade` or `quantex doctor`
- WHEN Quantex evaluates passive self-upgrade reminders
- THEN it does not render an additional post-command reminder

### Requirement: Self-upgrade reminders MUST be throttled per target version

Quantex SHALL remember when it last reminded the user about a specific target version so repeated command usage does not produce reminder spam.

#### Scenario: Same target version was already reminded recently

- GIVEN Quantex previously recorded a passive reminder for version `X`
- AND less than 24 hours have elapsed since that reminder
- AND the currently installable latest version is still `X`
- WHEN Quantex evaluates passive self-upgrade reminders
- THEN it suppresses the reminder

#### Scenario: A newer target version becomes available

- GIVEN Quantex previously recorded a passive reminder for version `X`
- AND the currently installable latest version is now `Y`
- AND `Y` is different from `X`
- WHEN Quantex evaluates passive self-upgrade reminders
- THEN it renders the reminder for `Y`
- AND it refreshes the recorded reminder state
