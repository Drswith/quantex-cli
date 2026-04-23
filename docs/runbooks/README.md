# Runbooks

Runbooks capture repeated operational knowledge that should be executable by a human or agent without rediscovering the same steps.

Good runbook topics:

- diagnosis order
- environment verification
- recovery steps
- rollback paths
- known failure signatures

Avoid using a runbook for broad design rationale. That belongs in ADRs or OpenSpec.

Start from [_template.md](./_template.md).

Current canonical runbooks:

- [quantex-troubleshooting.md](./quantex-troubleshooting.md)
- [releasing-quantex.md](./releasing-quantex.md)
- [release-and-self-upgrade-debugging.md](./release-and-self-upgrade-debugging.md)
- [worktree-task-execution.md](./worktree-task-execution.md)
