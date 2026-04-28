## Context

Cursor CLI exposes a version probe through `agent --version`, but Quantex does not have an authoritative "latest version" source for it. That means Quantex cannot know ahead of time whether Cursor is outdated, yet it can still verify whether a self-update changed the installed version after the command runs.

Today, `performUpdate` trusts `updateAgent(...).success` for self-update and prints `updated successfully!` unconditionally. For Cursor-like agents, that makes successful command execution indistinguishable from a genuine version change.

## Goals / Non-Goals

**Goals:**

- Verify self-update outcomes with pre/post installed-version probes when available.
- Preserve existing managed-update behavior.
- Keep the human output concise while making its semantics accurate.

**Non-Goals:**

- Do not invent a latest-version feed for Cursor or other script-installed agents.
- Do not block self-update for agents that lack a working version probe.
- Do not redesign batch update planning in this change.

## Decisions

- Add a post-update verification path only for `self-update` strategy inside the command layer. The package-manager layer can keep reporting command execution success; the command layer is where user-facing status is decided.
- Re-probe the installed version after a successful self-update command when a version probe is available.
- If the pre-update and post-update versions are both known and unchanged, emit `up-to-date` instead of `updated`.
- If the post-update version changed, emit `updated` and prefer the verified post-update version in result data.
- If Quantex cannot probe either side, keep the existing success behavior to avoid turning unknowns into false failures.

## Risks / Trade-offs

- [Extra version probe process] → Self-update runs one more lightweight version command; acceptable for accuracy.
- [Unknown-version ambiguity remains] → Agents without a reliable version probe can still only report command success; this change narrows the ambiguity where Quantex has enough information to do better.
- [Structured result shift] → Some callers that previously saw `updated` may now see `up-to-date`; this is an intended contract fix and should be covered in spec + tests.
