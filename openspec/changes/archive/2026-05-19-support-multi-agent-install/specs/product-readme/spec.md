## ADDED Requirements

### Requirement: README examples MUST document explicit multi-agent install

The product README SHALL show that `install` accepts multiple explicit agent targets while keeping the documented surface scoped to named lifecycle operations rather than install-all orchestration.

#### Scenario: User scans install examples

- GIVEN a user reads the quick start or common commands sections in `README.md` or `README.zh-CN.md`
- WHEN the README shows install examples
- THEN at least one example demonstrates `qtx install` with multiple explicit agent names
- AND the documentation does not imply the existence of `install --all`
