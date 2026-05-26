## ADDED Requirements

### Requirement: Cloud-agent automation roles SHALL be documented in repo-native project memory

Quantex SHALL keep the durable responsibilities, prompt baselines, trigger expectations, and output boundaries for external cloud-agent automations in repository documentation. The external automation provider configuration MAY hold the actual schedules, connected tools, and model selections, but it MUST NOT be the only source of durable role intent.

#### Scenario: Maintainer configures external cloud-agent automation

- **GIVEN** a maintainer creates or updates a Cursor Cloud Automation or comparable external cloud-agent automation for Quantex
- **WHEN** the automation changes durable workflow behavior, PR review behavior, CI triage behavior, release/archive follow-up, or prompt expectations
- **THEN** the repository MUST document the role contract, prompt baseline, and output boundary in a runbook or OpenSpec change
- **AND** the maintainer MUST NOT add a repo-local workflow orchestration command solely to mirror the external automation setup

#### Scenario: Agent audits cloud-agent automation drift

- **GIVEN** an agent or maintainer reviews existing external automation settings
- **WHEN** they compare those settings against repository source
- **THEN** they use the cloud-agent automation runbook and the Quantex runtime skill as the repo-native baseline
- **AND** they report provider-side schedule, model, or connection drift separately from repository contract drift

### Requirement: Cloud-agent roles MUST stay separated from CI enforcement

Cloud-agent automations SHALL classify, review, summarize, propose, or open narrow follow-up pull requests according to their role. They MUST NOT replace merge-gating CI, PR Governance, OpenSpec validation, release automation, or required local preflight checks.

#### Scenario: CI fails after a pull request update

- **WHEN** a cloud-agent CI triage role inspects a failing GitHub Actions run
- **THEN** it classifies the first real failure as product regression, workflow or policy failure, environment/quota/secret issue, transient external failure, or expected skipped context
- **AND** it reports the owner and minimal next step
- **AND** it does not implement code changes unless a separate implementation agent or user explicitly takes that work through the Quantex runtime intake gate

#### Scenario: PR Governance automation reviews a pull request

- **WHEN** a cloud-agent PR governance role reviews a pull request
- **THEN** it may leave blocking or non-blocking comments and request reviewers
- **AND** it MUST NOT approve the pull request
- **AND** GitHub Actions PR Governance remains responsible for enforcing required body, scope, release-intent, and merge-commit policy checks

#### Scenario: Cloud bug finder identifies no high-severity issue

- **WHEN** a cloud-agent bug-finding role inspects recent history without finding a concrete high-severity correctness bug
- **THEN** it sends a concise summary through the configured notification channel instead of opening a speculative pull request
- **AND** it keeps low-confidence concerns out of the merge queue
