# Proposal: retire-prerelease-channel

## Why

`release-workflow` currently states that a prerelease is cut by declaring `Release-As: <version>` with a prerelease suffix on a source PR. That does not work, and the requirement was written without being exercised.

Merging #517 with `Release-As: 1.8.7-beta.1` on the commit produced a Release PR for stable `1.8.7`, not `1.8.7-beta.1`. release-please emits prerelease versions only when its config declares them — the retired `release-please-config.beta.json` carried `versioning: prerelease`, `prerelease: true`, and `prerelease-type: beta`, which is why the old branch could produce `-beta` versions at all. `release-please-config.json` carries none of those, so the suffix is normalized away.

The requirement passed review because validation checked the wrong half. `release:dry-run` exercises the build and staging chain and confirmed the publish side derives the `beta` dist-tag from a prerelease version; it never touches release-please's version computation, which is the half that had to work. One half was verified and the other assumed.

Rather than build a third mechanism, the channel goes away. Across 102 published versions, 12 are prereleases and 11 of those are from the pre-1.0 `0.0.x` period. The entire 1.x line has produced exactly one — `1.8.2-beta`, published 2026-08-04, abandoned immediately, and the source of the inversion this workstream has been chasing. There is no demonstrated need for a prerelease channel, and every iteration spent designing one has cost more than the feature has ever returned.

## What Changes

- **Remove the prerelease requirement** from `release-workflow`. `main` is the only release line and publishes to `latest`.
- **Keep the version-to-dist-tag derivation** in the release identity contract as a fail-safe rather than a feature: if a version carrying a prerelease suffix is ever produced, publication still routes it to the `beta` dist-tag so it cannot displace `latest`. This is stated so the mapping is not later removed as dead code.
- **Drop the `Prereleases` section** from `docs/releases.md`.

No mechanism replaces the channel. If a preview need appears later, it can be designed against that need — and verified against release-please's actual behaviour before being written into a contract.

Out of scope, and a maintainer action this change cannot perform: the npm `beta` dist-tag still points at `1.8.2-beta`. It is registry state, and removing it requires publish credentials.

## Capabilities

- **Modified Capabilities**:
  - `release-workflow` — the prerelease channel requirement is removed; the dist-tag fail-safe is retained explicitly.

## Impact

- `openspec/specs/release-workflow/spec.md`, `docs/releases.md`

No code changes. `scripts/release/release-seal-contract.ts` keeps deriving the dist-tag from the version shape, which is the retained fail-safe.

## Intake classification

Durable release-contract change removing a published requirement; OpenSpec required.
