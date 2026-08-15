## REMOVED Requirements

### Requirement: Update discovery MUST describe the managed batch scope

**Reason**: The `--managed` option and managed structured scope were Desktop-only contract extensions.
**Migration**: Consumers MUST use the existing `update` command contract and its `all` or `single` result scopes.
