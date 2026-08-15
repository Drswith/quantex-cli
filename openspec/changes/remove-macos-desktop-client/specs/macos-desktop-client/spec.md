## REMOVED Requirements

### Requirement: Desktop client MUST use the bundled CLI as its lifecycle boundary

**Reason**: The macOS desktop client is being removed from Quantex.
**Migration**: Use the Quantex CLI directly for lifecycle operations.

### Requirement: Desktop updates MUST require explicit user confirmation

**Reason**: The desktop update surface no longer exists.
**Migration**: Use explicit CLI update commands and the existing CLI confirmation/automation contract.

### Requirement: Desktop MUST cover the primary agent lifecycle

**Reason**: Agent lifecycle management remains a CLI responsibility rather than a desktop UI responsibility.
**Migration**: Use the existing `install`, `ensure`, `update`, `uninstall`, `list`, `info`, and `exec` commands.

### Requirement: Desktop MUST expose diagnostics and Quantex configuration

**Reason**: The desktop diagnostics and settings surfaces are removed with the client.
**Migration**: Use the existing CLI diagnostics, capabilities, and configuration commands.

### Requirement: Desktop background operation MUST remain lightweight and user-controlled

**Reason**: No resident desktop host or background desktop update check remains.
**Migration**: Invoke CLI commands explicitly when lifecycle work is needed.

### Requirement: Browser UI development MUST use deterministic mock data

**Reason**: The browser-only Desktop workspace is removed.
**Migration**: Validate CLI behavior through the repository CLI tests and structured output contracts.

### Requirement: Desktop MUST keep self-upgrade and developer contracts out of scope

**Reason**: There is no longer a Desktop surface whose scope needs to exclude these commands.
**Migration**: The CLI remains the sole surface for its existing self-upgrade, commands, and schema contracts.

### Requirement: Desktop MUST provide system, light, and dark appearance modes

**Reason**: Appearance preferences belong to the removed desktop client.
**Migration**: No desktop appearance preference is persisted or exposed by Quantex.
