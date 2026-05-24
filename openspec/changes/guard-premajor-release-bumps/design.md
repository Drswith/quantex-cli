## Context

Release-please follows normal SemVer rules by default: a breaking change in `0.x` can produce `1.0.0`. Quantex's current product state is still pre-1.0, so this default is too eager for catalog and lifecycle-surface breaking changes. The CodeWhale rename PR demonstrated the failure mode: the implementation PR was merged correctly, but its breaking Conventional Commit metadata allowed the generated Release PR to become `1.0.0`, which auto-merged and published.

The repo already has two relevant control points:

- `release-please-config.json` configures version calculation.
- `scripts/release-pr-policy.js` validates generated Release PRs before auto-merge.

## Goals / Non-Goals

**Goals:**

- Make release-please calculate pre-1.0 breaking changes as minor bumps.
- Add an independent Release PR validator check that blocks accidental `0.x` to `1.0.0` promotion.
- Keep the fix small and focused on stable release automation.

**Non-Goals:**

- Delete the already published `v1.0.0` GitHub Release or tag.
- Unpublish `quantex-cli@1.0.0` from npm or mutate npm dist-tags.
- Define a full intentional 1.0 graduation process.
- Change beta prerelease behavior.

## Decisions

### 1. Use release-please's built-in pre-major option

Set `bump-minor-pre-major: true` in the stable release-please package config. This is the upstream-supported behavior for making breaking changes bump minor while the package version is below `1.0.0`.

### 2. Block accidental stable pre-major graduation in Release PR validation

The validator already parses the base version and proposed Release PR title. It can reject a generated stable Release PR when the base version is `0.x` and the proposed version is `1.0.0`. This catches future config drift or unexpected release-please behavior before automerge.

### 3. Leave explicit 1.0 graduation out of scope

An intentional 1.0 release needs a separate durable decision and probably a dedicated release plan. Until that exists, generated Release PRs should not cross from `0.x` to `1.0.0` automatically.

## Risks / Trade-offs

- [A real future 1.0 graduation would be blocked] -> Require an explicit follow-up OpenSpec/ADR to define the graduation process and adjust the validator deliberately.
- [The package is already published at `1.0.0`] -> This PR prevents recurrence but does not mutate external GitHub/npm release state without maintainer authorization.
- [Base branch is currently `1.0.0`] -> The validator still covers the exact incident pattern in tests; correcting external version state is a separate release recovery action.
