## Context

The current self-upgrade flow determines update availability with direct string inequality checks. That works only when the resolved `latestVersion` is trustworthy and newer than the installed CLI. With cached or lagging registry data, Quantex can see `latestVersion=0.14.0` while the installed CLI is already `0.15.0`, then attempt an upgrade and fail verification after Bun or npm installs the real latest package.

The user-visible problem is not limited to `quantex upgrade`. The same stale comparison also affects `quantex doctor` and passive update notices.

## Goals / Non-Goals

**Goals:**

- Treat self updates as available only when `latestVersion` is semantically newer than `currentVersion`.
- Prevent managed self-upgrade from entering downgrade or stale-target paths.
- Keep the fix narrow to self-upgrade surfaces and related messaging.

**Non-Goals:**

- Rework the general network cache policy in this change.
- Change managed agent update semantics outside Quantex self-upgrade.
- Add a new persistent self-upgrade state file or cross-command cache invalidation mechanism.

## Decisions

### Use semantic version comparison for self-update availability

Quantex will compare `latestVersion` and `currentVersion` semantically instead of with raw string inequality. When `latestVersion` is equal to or lower than the installed CLI version, Quantex will treat self-upgrade as unavailable for that command path.

### Apply the same availability rule to all self-update surfaces

The same “strictly newer only” rule will drive:

- `quantex upgrade`
- `quantex doctor`
- passive self-update notices

This keeps user-visible state consistent and avoids a path where one surface suppresses a stale downgrade while another still advertises it.

## Risks / Trade-offs

- A semver comparison helper adds parsing logic to the runtime surface, but the versions involved are already semver-shaped package and release versions.
- This change does not auto-refresh stale cache entries; it only blocks false downgrade behavior. Users may still need `--refresh` or `--no-cache` to discover a newer release immediately after a publish.
