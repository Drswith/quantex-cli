## ADDED Requirements

### Requirement: Windows standalone installer MUST select a published Windows release asset

The documented Windows standalone installer (`install.ps1`) SHALL map supported Windows host architectures to a release asset name that exists in the published Quantex Windows binary matrix. When the host reports `ARM64`, the installer MUST request `quantex-windows-x64.exe` rather than a Windows ARM64 asset that is not built or published. Unknown Windows architectures MUST still fail closed.

#### Scenario: Installing on Windows ARM64 via install.ps1

- **GIVEN** the host reports Windows architecture `ARM64`
- **AND** Quantex publishes `quantex-windows-x64.exe` but does not publish `quantex-windows-arm64.exe`
- **WHEN** a user runs the documented `install.ps1` installer
- **THEN** the installer MUST request `quantex-windows-x64.exe`
- **AND** it MUST NOT request `quantex-windows-arm64.exe`

#### Scenario: Installing on Windows AMD64 via install.ps1

- **GIVEN** the host reports Windows architecture `AMD64`
- **WHEN** a user runs the documented `install.ps1` installer
- **THEN** the installer MUST request `quantex-windows-x64.exe`
