# project-memory Delta

## ADDED Requirements

### Requirement: Handbook routing SHALL be verified rather than restated

`AGENTS.md` SHALL inline only the triggers that decide which validation commands and which intake path apply, and SHALL point at `skills/quantex-agent-runtime/SKILL.md` for the full routing detail, matching how it already delegates PR body governance. The project memory check SHALL verify that the runtime skill actually carries the detail the handbook defers to it, so a pointer cannot outlive its target.

Restating the full validation matrix and the full intake signal list in both files is prohibited: the two drifted apart with nothing detecting it, which is the failure mode `AGENTS.md` already names in its own red lines.

#### Scenario: Handbook defers routing detail

- **WHEN** the project memory check runs
- **THEN** it MUST verify that `skills/quantex-agent-runtime/SKILL.md` carries the validation commands and intake signals that `AGENTS.md` points at
- **AND** it MUST fail when the runtime skill no longer carries them
