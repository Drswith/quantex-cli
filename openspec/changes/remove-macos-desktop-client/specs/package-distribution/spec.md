## REMOVED Requirements

### Requirement: Desktop bundles MUST consume architecture-matched release sidecars

**Reason**: Quantex will no longer build or distribute a Desktop bundle.
**Migration**: Consume the published CLI package or standalone CLI release artifacts through their existing CLI distribution contracts.

### Requirement: The private Desktop workspace MUST coexist with the private Core workspace

**Reason**: The `apps/desktop` workspace is removed.
**Migration**: The root workspace retains only the existing CLI/Core package distribution rules.
