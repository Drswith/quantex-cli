## Why

Recent CI failures show that Quantex's workflow rules are documented more strongly than they are enforced locally. Critical validation such as `format:check`, `typecheck`, `openspec:validate`, and `memory:check` still first fail in CI, while change-scope classification is duplicated across workflows and can drift.

This change is classified as a durable workflow update under the OpenSpec intake gate. We need a smaller, executable P0 that moves key checks earlier, reduces classification drift, and preserves the existing scoped-CI model without expanding into a broader release workflow redesign.

## What Changes

- Add a repository-native change-scope classifier script that defines the canonical product-impacting and process-only path taxonomy.
- Reuse that canonical taxonomy from merge-gating CI and PR governance instead of maintaining multiple inline copies.
- Add a `pre-push` hook that runs `bun run format:check`, `bun run typecheck`, `bun run openspec:validate`, and `bun run memory:check`.
- Keep the existing process-only CI optimization, but add a minimal Ubuntu build guard so process-only PRs no longer report a completely execution-free test context.
- Preserve the current release and archive automation topology; this change does not redesign release orchestration or archive PR generation.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `code-quality-tooling`: local hooks and merge-gating CI validation requirements expand to include pre-push enforcement, a canonical path taxonomy, and a minimal process-only build guard.
- `release-governance`: PR governance change-scope checks derive their path classification from the same canonical repository taxonomy used by CI.

## Impact

- Affected code: `.github/workflows/ci.yml`, `.github/workflows/pr-governance.yml`, `package.json`, `scripts/**`, and related tests if needed.
- Affected systems: local git hook enforcement, merge-gating CI classification, and PR governance scope validation.
- Dependencies: no new third-party lint or format tools; the implementation should stay within Bun/TypeScript and the current GitHub Actions surface.
