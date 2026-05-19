## Why

Modal-backed sandbox smoke currently runs only after merges to `main` and `beta`. That allows lifecycle-sensitive regressions to land on the protected branch before the remote isolation layer runs, which defeats the point of using sandbox coverage as a merge gate for install, update, self-upgrade, and lifecycle changes.

At the same time, making sandbox validation required has to avoid two failure modes:

- docs-only or OpenSpec-only pull requests getting stuck because the sandbox workflow never reported a required context
- fork pull requests trying to execute repository code with Modal secrets through an unsafe elevated event

## What Changes

- Move the dedicated `sandbox-tests` workflow earlier so it runs on pull requests as well as protected-branch pushes, schedule, and manual dispatch.
- Route sandbox relevance through the shared `scripts/path-taxonomy.ts` classification so the workflow always reports a stable required context while only starting Modal for lifecycle-sensitive changes.
- Scope the merge-gating pull-request sandbox profile to the stable lifecycle scenarios and leave the full Modal scenario set, including `self-managed`, to protected-branch pushes and other non-gating entry points.
- Keep fork pull requests on the safe `pull_request` event and degrade sandbox-relevant fork PRs to a documented success placeholder that tells maintainers to rerun sandbox validation from a trusted repository branch before merge.
- Update repository docs and ruleset guidance so `sandbox-tests` becomes part of the protected `main` merge contract.

## Impact

- Lifecycle-sensitive repository-branch pull requests will be blocked before merge when the stable Modal merge-gating profile fails.
- Unrelated pull requests keep a fast green `sandbox-tests` context without paying the remote sandbox cost.
- Protected-branch pushes still exercise the broader Modal coverage after merge so self-managed regressions are detected without making the required PR check brittle.
- Fork pull requests stay safe by avoiding `pull_request_target` execution with Modal secrets, but still require maintainer judgment for lifecycle-sensitive changes.
