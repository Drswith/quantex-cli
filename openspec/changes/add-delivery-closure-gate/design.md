## Context

The repository already has an intake gate that prevents implementation from bypassing OpenSpec. A separate failure mode remains: agents can complete code, tests, or OpenSpec tasks and then stop before commit, PR, merge/archive status checks, or a clear closure statement.

## Goals / Non-Goals

**Goals:**

- Make “done” explicit at the delivery boundary.
- Require final answers to separate local implementation from PR, merge, release, and OpenSpec archive closure.
- Keep protected-branch behavior realistic: implementation PR delivery can be complete while archive closure remains post-merge automation.
- Give PR reviewers a visible closure checklist.

**Non-Goals:**

- Change release automation, branch protection, or archive automation behavior.
- Require agents to merge every PR automatically.
- Add repo-local workflow commands beyond existing OpenSpec and GitHub-native flows.

## Decisions

- Add the delivery closure gate to `AGENTS.md`.
  Rationale: agents must see the exit rule before they decide to send a final answer.
- Add closure language to `openspec/README.md` and `docs/github-collaboration.md`.
  Rationale: OpenSpec and GitHub are the two places where “done” can diverge.
- Add a PR-template checklist.
  Rationale: PR review is the human-facing checkpoint where incomplete archive or validation state should be visible.
- Add the rule to `openspec/config.yaml`.
  Rationale: future OpenSpec artifact instructions should reinforce the same closure vocabulary.

## Risks / Trade-offs

- Risk: agents may overstate closure when a PR exists but has not merged.
  Mitigation: require final answers to distinguish PR delivery from merge/archive closure.
- Risk: closure checklist becomes noisy for small edits.
  Mitigation: allow “not applicable” closure states, but require the status to be explicit.
- Risk: archive closure can only happen after merge on protected branches.
  Mitigation: document repository automation as the expected owner when archive closure is pending post-merge.
