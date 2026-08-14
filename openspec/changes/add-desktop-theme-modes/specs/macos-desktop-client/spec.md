## ADDED Requirements

### Requirement: Desktop MUST provide system, light, and dark appearance modes

The desktop client SHALL expose a Desktop-only appearance preference with `system`, `light`, and `dark` values. It MUST default existing and new users to `system`, MUST persist explicit selections, and MUST render all pages with the corresponding default shadcn theme tokens without introducing a custom component theme.

#### Scenario: Desktop follows the system appearance

- **WHEN** the appearance preference is `system`
- **THEN** Desktop renders with the current macOS light or dark appearance
- **AND** an appearance change made while Desktop is open updates the rendered theme

#### Scenario: User selects a fixed appearance

- **WHEN** the user selects `light` or `dark` from the header or Desktop settings
- **THEN** Desktop immediately renders that appearance on every page
- **AND** the native host persists the selected value for the next window creation
- **AND** subsequent macOS appearance changes do not override the fixed selection

#### Scenario: Browser preview exercises appearance modes

- **WHEN** a developer uses the browser-only Desktop preview
- **THEN** all three appearance selections remain interactive through deterministic mock preferences
- **AND** no Tauri IPC is invoked
