## Context

Quantex separates a supported agent's canonical catalog name from the executable binary it launches. Qoder CLI already fits this pattern: the Quantex slug is `qoder`, while the executable binary is `qodercli`, similar to how Cursor keeps the slug `cursor` while launching the `agent` binary.

`update --all` currently plans updates for any agent that is merely detected in `PATH`, even when Quantex has no recorded install state for it. For self-updating tools, that means a PATH-only binary can get pulled into the batch update flow and trigger installation or upgrade behavior that the user did not explicitly ask Quantex to manage.

## Goals / Non-Goals

**Goals:**

- Make `update --all` respect Quantex-managed install state before scheduling batch updates.
- Keep the existing `qoder` slug while making the slug-to-binary contract explicit in tests.

**Non-Goals:**

- Do not add a second Qoder-related agent entry for the IDE launcher.
- Do not change Qoder's install methods, package metadata, or self-update command.
- Do not remove the ability to explicitly run or explicitly update a supported agent that is available in `PATH`.

## Decisions

- Change batch update planning so `update --all` only schedules agents with a recorded Quantex install state; PATH-only detections become manual informational results instead of executable update entries.
- Keep the supported agent definition on the canonical name `qoder` and continue launching the binary `qodercli`.
- Add tests that assert `qoder` resolves to the `qodercli` binary and PATH-only self-updating agents are skipped by `update --all`.

## Risks / Trade-offs

- Users who relied on `update --all` touching untracked PATH installs will now need to use explicit single-agent update or reinstall via Quantex, but that behavior is safer and matches the intended lifecycle boundary.
