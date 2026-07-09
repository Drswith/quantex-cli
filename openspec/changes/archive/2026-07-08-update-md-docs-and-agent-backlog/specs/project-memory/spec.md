## ADDED Requirements

### Requirement: Active agent-support docs MUST stay aligned with catalog and backlog tracking

Quantex SHALL keep active agent-support Markdown surfaces and their top-level GitHub backlog tracker aligned with the current supported catalog and support-matrix policy. Historical archives MAY preserve point-in-time state and MUST NOT be silently rewritten as current-state support docs.

#### Scenario: Maintainer updates supported-agent docs

- **GIVEN** a supported agent is added, renamed, or removed in `src/agents/catalog/*.json`
- **WHEN** active docs or skill references enumerate supported agent names or shortcuts
- **THEN** `README.md`, `README.zh-CN.md`, `docs/agent-support-matrix.md`, and `skills/quantex-cli/references/command-recipes.md` reflect the current catalog entries or explicitly point readers to live CLI discovery commands for exact support
- **AND** the maintained snapshot does not omit known supported agents

#### Scenario: Maintainer reviews the top-level backlog issue

- **GIVEN** GitHub issue `#134` is the active top-level tracking issue for agent-catalog expansion
- **WHEN** a candidate moves into supported, active implementation, or exclusion
- **THEN** the issue keeps planning-only triage separate from repo-native source-of-truth docs and catalog files
- **AND** delivered candidates remain visible in their original triage bucket or a documented delivered section so backlog history stays meaningful
- **AND** `docs/agent-support-matrix.md` points unsupported backlog triage at issue `#134` or an explicitly named successor issue

#### Scenario: Agent syncs current docs without rewriting history

- **GIVEN** archived OpenSpec changes, session summaries, postmortems, or files under `docs/archive/`
- **WHEN** an agent is asked to update the current Markdown docs
- **THEN** the agent updates active docs and live tracking artifacts first
- **AND** historical records remain point-in-time snapshots unless the task explicitly asks to correct historical data
