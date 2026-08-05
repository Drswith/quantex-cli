# release-governance Delta

## REMOVED Requirements

### Requirement: PRs Must Declare Release Intent

**Reason**: Merged into `release-workflow` so the release contract has one home.

**Migration**: Follow the same-named requirement in `openspec/specs/release-workflow/spec.md`.

### Requirement: Process-only PRs MUST use the shared scope taxonomy for release-metadata enforcement

**Reason**: Merged into `release-workflow`.

**Migration**: Follow the same-named requirement in `openspec/specs/release-workflow/spec.md`.

### Requirement: PR body governance MUST be locally executable

**Reason**: Merged into `release-workflow`.

**Migration**: Follow the same-named requirement in `openspec/specs/release-workflow/spec.md`.

### Requirement: Product-Impacting PRs Must Not Silently Skip Release

**Reason**: Merged into `release-workflow`.

**Migration**: Follow the same-named requirement in `openspec/specs/release-workflow/spec.md`.

### Requirement: Release PRs Keep Dedicated Validation

**Reason**: Merged into `release-workflow`.

**Migration**: Follow the same-named requirement in `openspec/specs/release-workflow/spec.md`.

### Requirement: Protected-branch CI MUST reject prohibited co-author trailers in new commits

**Reason**: Merged into `release-workflow`; commit trailer and merge commit policies now live in one `commit-policy.ts` script with push/pr modes.

**Migration**: Follow the same-named requirement in `openspec/specs/release-workflow/spec.md`.

### Requirement: PR body governance MUST be run before PR delivery actions

**Reason**: Merged into `release-workflow`.

**Migration**: Follow the same-named requirement in `openspec/specs/release-workflow/spec.md`.

### Requirement: Pull request delivery MUST prefer linear history

**Reason**: Merged into `release-workflow`.

**Migration**: Follow the same-named requirement in `openspec/specs/release-workflow/spec.md`.

### Requirement: PR governance MUST validate release-summary input

**Reason**: Merged into `release-workflow` as `Release-source PRs MUST provide release-please consumable summaries`.

**Migration**: Follow `Release-source PRs MUST provide release-please consumable summaries` in `openspec/specs/release-workflow/spec.md`.

### Requirement: Protected branches SHALL require aligned status check contexts

**Reason**: Merged into `release-workflow` and updated to the honest required-check set (`lint`, `governance`, three platform tests; `sandbox-tests` advisory).

**Migration**: Follow the same-named requirement in `openspec/specs/release-workflow/spec.md` and update branch rulesets to match.

### Requirement: Skipped required checks SHALL not block merge

**Reason**: Merged into `release-workflow`; the Windows-on-PR skip example no longer exists because Windows now runs on product-impacting PRs.

**Migration**: Follow the same-named requirement in `openspec/specs/release-workflow/spec.md`.
