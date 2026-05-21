## Context

Update strategy resolution currently checks recorded managed state first, then scans the agent's platform install methods for any managed installer. That is safe when no state exists, but unsafe when Quantex has recorded an unmanaged source such as a script or binary install: the candidate methods describe possible install options, not the actual source already in use.

## Goals / Non-Goals

**Goals:**

- Ensure recorded install state remains the source of truth for update strategy selection.
- Prevent managed batch updates from claiming success for a package source that does not correspond to the recorded install.
- Keep existing managed inference for explicit single-agent updates of untracked PATH installs.

**Non-Goals:**

- Add post-update version verification for all managed installers.
- Change install, ensure, or adoption behavior.
- Remove pip support from agents that can be installed with pip.

## Decisions

- If installed state exists and its install type is managed, resolve that exact managed installer.
- If installed state exists and its install type is not managed, do not infer a managed installer from catalog methods. Let self-update or manual-hint providers decide the result.
- If installed state is missing, keep the existing method-scan behavior so explicit single-agent updates of untracked tools can still use available managed methods.

## Risks / Trade-offs

- Some users with tracked unmanaged installs may have a separately installed managed package that could be upgraded, but Quantex will not assume it is the recorded binary. They can re-track or reinstall through the desired managed source.
- The fix is intentionally narrow and does not address broader managed installer post-update verification.
