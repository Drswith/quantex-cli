# Runbook: Modal Sandbox Testing

## Purpose

Provide the repeatable flow for validating Quantex's real agent lifecycle behavior inside isolated Bun environments without turning the normal development loop into a remote-only workflow.

## When to use

- you changed install, ensure, exec, self-upgrade, or other lifecycle code that may interact with the local environment
- you want a clean Linux HOME and PATH without using your host machine's global tool state
- you want an extra validation layer after local `bun run test`, not a replacement for it

## Inputs

- `bun run test`
- `bun run test:container`
- `bun run test:sandbox`
- Docker or Modal availability on the current machine

## Prerequisites

- For `bun run test:container`: Docker CLI available on `PATH`
- For `bun run test:sandbox`: Modal CLI available on `PATH`
- For `bun run test:sandbox`: an authenticated Modal profile, usually created with `modal setup`
- network access for the isolated environment to install dependencies

## Default local isolation command

```bash
bun run test:container
```

This command mounts the current checkout into a local Docker container based on the repository's default Bun image, copies the checkout to an internal temporary work directory, installs repository dependencies there, and then executes the lifecycle smoke script.

The default local lifecycle smoke agents are `pi,qoder`.

Default scenarios:

- `managed`: Quantex installs, inspects, resolves, ensures, updates, uninstalls, and re-inspects the agent.
- `adopt-preinstalled`: the sandbox preinstalls the agent outside Quantex first, then verifies `quantex install <agent>` adopts and tracks that existing install.
- `ambiguous-multi-method`: the sandbox places a fake multi-install-method agent binary in PATH and verifies Quantex does not guess an install source.
- `self-binary`: the sandbox builds a Linux standalone Quantex binary, installs it into the isolated HOME, then verifies binary-entrypoint command discovery, agent inspection, and `upgrade --check` self-inspection.

For each selected agent, the `managed` scenario executes the real Quantex CLI flow:

- inspect before install
- install
- inspect after install
- resolve
- ensure idempotency
- exec dry run
- update
- uninstall
- inspect after uninstall

## Modal-backed remote isolation

When you want to verify the Modal path itself or exercise the same slice in the dedicated GitHub Actions transport, run:

```bash
bun run test:sandbox
```

The Modal command uses the same lifecycle smoke script and mounted-checkout shape as the Docker path, but requires a working local `modal` CLI plus credentials.

## Custom agent list

To override the default agent list, pass agent slugs after `--`:

```bash
bun run test:container -- pi qoder
bun run test:sandbox -- pi qoder
```

The forwarded arguments replace the default agent list for that invocation. You can also set `QTX_ISOLATION_AGENTS=pi,qoder`.

To limit scenarios, set `QTX_ISOLATION_SCENARIOS`:

```bash
QTX_ISOLATION_SCENARIOS=managed,adopt-preinstalled bun run test:container
QTX_ISOLATION_SCENARIOS=self-binary bun run test:container
QTX_ISOLATION_SCENARIOS=managed QTX_ISOLATION_AGENTS=qoder bun run test:container
```

Individual lifecycle commands time out after `QTX_ISOLATION_COMMAND_TIMEOUT_MS` milliseconds, defaulting to 300 seconds. Broader real-agent runs may need a higher timeout when upstream packages are slow.

For local broad-agent coverage without the slower upstream install path, `qoder` is the preferred multi-install-method agent and is included in the local default:

```bash
QTX_ISOLATION_SCENARIOS=managed QTX_ISOLATION_AGENTS=qoder bun run test:container
```

The dedicated GitHub Actions workflow runs the Modal path with `QTX_ISOLATION_AGENTS=pi,opencode` and a longer command timeout so remote validation covers the lightweight baseline plus opencode under better network conditions. Protected-branch pushes only trigger the workflow when lifecycle-sensitive files change; docs-only and OpenSpec archive-only merges do not start Modal automatically.

## Triage order

1. Run local validation first:

   ```bash
   bun run lint
   bun run format:check
   bun run typecheck
   bun run test
   ```

2. Run `bun run test:container` when the change is sensitive to HOME, PATH, global tools, or filesystem isolation and you want a local fallback that does not require Modal.
3. Run `bun run test:sandbox` when you also want to validate the Modal transport or reproduce the dedicated GitHub Actions workflow.
4. If an isolated run fails, compare whether the failure is code-related or environment-related by rerunning the same agent list locally.
5. If Modal setup is missing, install or repair the local Modal CLI before treating the failure as a product regression.

## Recovery

If `bun run test:container` reports that `docker` is missing, install or start a compatible Docker runtime before retrying.

If `bun run test:sandbox` reports that `modal` is missing, install the CLI and authenticate:

```bash
pip install modal
modal setup
```

If the sandbox cannot reach the network or registry, retry after confirming Modal workspace health and outbound access.

If the isolated run is too broad or slow, narrow the agent list with explicit arguments instead of editing the repository default immediately.

## Escalation

Stop and ask for human input when:

- the change appears to require platform-specific validation outside Linux
- Modal account policy or credentials are unavailable to the current contributor
- the isolation layer needs to become merge-gating CI instead of an opt-in maintainer tool
- a new scenario needs to mutate real external account state instead of a disposable package install inside the sandbox

## Related artifacts

- [README.md](../../README.md)
- [Code Quality Tooling Spec](../../openspec/specs/code-quality-tooling/spec.md)
- [OpenSpec change add-modal-sandbox-test-layer](../../openspec/changes/add-modal-sandbox-test-layer/proposal.md)
