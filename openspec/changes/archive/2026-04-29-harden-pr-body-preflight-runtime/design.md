## Context

PR Governance now uses `bun run pr:body:check` in GitHub Actions, but agent sessions can still hand-write a malformed `gh pr create --body ...` payload. That failure mode is caught remotely, which protects `main`, but it still creates avoidable red CI and another repair loop.

The repository also has an explicit boundary: Quantex should not become a workflow orchestration platform, and the product repo should not accumulate custom lifecycle commands when native tools and Superpowers can carry the workflow.

## Goals / Non-Goals

**Goals:**

- Move PR body validation into the agent delivery routine before PR creation or PR body edits.
- Reuse `.github/pull_request_template.md` and `bun run pr:body:check` instead of duplicating PR body rules in prompts.
- Keep `gh pr create` and `gh pr edit` as the action tools rather than introducing a repo-local PR creation wrapper.
- Clarify the repository script boundary so future fixes prefer validators over workflow orchestrators.

**Non-Goals:**

- Do not add `bun run pr:create`, `workflow:*`, or another command that wraps GitHub PR creation.
- Do not replace GitHub Actions PR Governance.
- Do not remove build, package, release artifact, taxonomy, or policy validation scripts that remain executable guardrails.

## Decisions

1. Keep PR creation native and validate the body as an input file first.

   Agents MUST prepare the PR body in a file, validate it with `bun run pr:body:check -- --body-file <file> --title "<title>"`, and only then call `gh pr create --body-file <file>` or `gh pr edit --body-file <file>`. This keeps the workflow visible while making the policy executable.

2. Treat repository scripts as guardrails, not session orchestration.

   Scripts may classify paths, validate policy, generate build metadata, or verify release artifacts. They MUST NOT become the primary way agents perform routine GitHub/OpenSpec lifecycle actions when official CLIs plus Superpowers runtime instructions are sufficient.

3. Put the rule in the central runtime and thin fallback.

   `skills/quantex-agent-runtime/SKILL.md` carries the detailed cross-agent delivery flow. `AGENTS.md` remains thin but includes the hard PR body preflight because it is an immediate execution constraint for any agent that cannot or does not activate Superpowers.

## Risks / Trade-offs

- Agents may still ignore instructions and call `gh pr create --body` directly. Mitigation: GitHub PR Governance remains the remote enforcement layer and fails the PR before merge.
- A file-based body step is slightly more manual than a wrapper command. Mitigation: it avoids growing a hidden workflow CLI and keeps the body inspectable before creation.
- Claude-specific hooks could block direct `gh pr create --body`, but they would not be portable across agents. Mitigation: keep hook ideas as optional environment hardening rather than repo contract.
