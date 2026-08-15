## REMOVED Requirements

### Requirement: Managed-only batch update discovery MUST use recorded agent state

**Reason**: The managed-only batch scope was introduced solely for the removed Desktop background update client.
**Migration**: Use the existing `quantex update --all` behavior, which retains its normal catalog-wide contract and recorded install-source planning.
