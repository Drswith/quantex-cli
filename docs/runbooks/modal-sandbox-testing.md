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
- `bun run scripts/smoke/lifecycle-smoke.ts`
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
- `probe`: a focused real-agent check that installs, refreshes `inspect` and `list`, and verifies installed-version evidence when the catalog declares it. It verifies physical removal for providers that support uninstall; for install-only providers it clears Quantex tracking and relies on disposable-runner teardown for physical cleanup.
- `deno-managed`: the sandbox places a fake `deno` executable in PATH, then verifies Quantex routes a Deno-managed test agent through `deno install --global`, `deno install --global --force`, and `deno uninstall --global` while preserving executable name and package install arguments.
- `uv-managed`: the sandbox places a fake `uv` executable in PATH, then verifies Quantex routes a uv-managed test agent through `uv tool install`, `uv tool list`, `uv tool upgrade`, and `uv tool uninstall` while preserving package install arguments.
- `adopt-preinstalled`: the sandbox preinstalls the agent outside Quantex first, then verifies `quantex install <agent>` adopts and tracks that existing install.
- `ambiguous-multi-method`: the sandbox places a fake multi-install-method agent binary in PATH and verifies Quantex does not guess an install source.
- `self-binary`: the sandbox builds a Linux standalone Quantex binary, installs it into the isolated HOME, then verifies binary-entrypoint command discovery, agent inspection, and `upgrade --check` self-inspection.
- `self-managed`: the sandbox builds local Quantex package tarballs, serves them from a sandbox-local registry, seeds an older Bun-managed Quantex install, and verifies `quantex upgrade` upgrades that install to the current checkout version.

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
QTX_ISOLATION_SCENARIOS=deno-managed bun run test:container
QTX_ISOLATION_SCENARIOS=uv-managed bun run test:container
QTX_ISOLATION_SCENARIOS=self-binary bun run test:container
QTX_ISOLATION_SCENARIOS=self-managed bun run test:container
QTX_ISOLATION_SCENARIOS=managed QTX_ISOLATION_AGENTS=qoder bun run test:container
QTX_ISOLATION_SCENARIOS=probe QTX_CANARY_REQUIRE_VERSION=true QTX_ISOLATION_AGENTS=pi bun run test:container
```

Individual lifecycle commands time out after `QTX_ISOLATION_COMMAND_TIMEOUT_MS` milliseconds, defaulting to 300 seconds. Broader real-agent runs may need a higher timeout when upstream packages are slow.

For local broad-agent coverage without the slower upstream install path, `qoder` is the preferred multi-install-method agent and is included in the local default:

```bash
QTX_ISOLATION_SCENARIOS=managed QTX_ISOLATION_AGENTS=qoder bun run test:container
```

## Real-agent canary workflow

The repository also has an advisory GitHub Actions workflow at `.github/workflows/agent-canary.yml`. It is the high-frequency real-agent signal and does not require Modal credentials:

- Relevant pull requests run a quick matrix containing the maintained anchors `codex`, `opencode`, `pi`, and `qoder`.
- Manual dispatch can run the full catalog-driven Linux matrix. Each job uses a fresh `ubuntu-latest` runner, a runner-temporary `HOME`/`BUN_INSTALL`, one agent, and `QTX_ISOLATION_SCENARIOS=probe`.
- Matrix entries carry the selected catalog provider, installed-version requirement, lifecycle coverage mode, installer setup policy, update-isolation policy, and deliberate source-conflict flag. Full-scope entries do not carry an agent-level installation or cleanup skip.
- Candidate selection prefers Bun, npm, and uv because those are CI-ready providers the product configuration can reorder. Junie explicitly uses its official script candidate so the canary keeps provider-source verification strict instead of accepting the managed package's external shim. The workflow provisions Deno or uv when selected.
- Goose runs its official installer with `CONFIGURE=false`. Vibe runs through uv with the disposable local bin directory already on PATH. A provider or installer that cannot execute makes that advisory agent job red.
- Devin uses `binary-lifecycle` coverage: the bounded official installer step must acquire a working version-reporting executable, then Quantex must adopt, inspect, list, version, and untrack it. The job summary states that account setup and authentication are deferred; it does not call that layer passed or skipped.
- Claude disables upstream update and migration paths for the ordinary Bun lifecycle and must finish absent after uninstall. Its separate deliberate conflict probe adds a controlled fallback executable, requires the exact structured `conflicting-source` failure, removes the fixture, and completes final cleanup.
- A fresh uv tool directory reports `No tools installed` with exit zero. Quantex treats that explicit result as conclusive absence so catalog-first uv agents can install; unexplained empty uv output remains indeterminate and red.
- The canary uses its own compatible Bun version for current real-agent packages; Quantex build and release jobs retain the repository's reproducible Bun pin.
- The workflow is intentionally not a required branch-protection context. A registry or upstream installer outage remains visible as advisory evidence while deterministic provider tests continue to gate merges.

Do not run real-agent installation probes directly against a developer workstation. Use the Docker transport so HOME, PATH, package-manager roots, and installed agents remain inside the disposable container:

```bash
QTX_ISOLATION_SCENARIOS=probe \
  QTX_CANARY_REQUIRE_VERSION=true \
  QTX_ISOLATION_AGENTS=pi \
  bun run test:container
```

Use `bun run test:container` or `bun run test:sandbox` when you need the broader fake-provider, self-upgrade, filesystem, or transport scenarios. The two layers complement each other: canaries catch real upstream CLI stream and packaging behavior; isolation runs exercise Quantex's provider and sandbox contracts deterministically.

## Triage order

1. Run local validation first:

   ```bash
   bun run lint
   bun run format:check
   bun run typecheck
   bun run test
   ```

2. Run `bun run test:container` when the change is sensitive to HOME, PATH, global tools, or filesystem isolation and you want a local fallback that does not require Modal.
   For self-upgrade regressions, start with `QTX_ISOLATION_SCENARIOS=self-managed bun run test:container`.
3. Let the advisory `Agent Canaries` workflow provide the quick real-agent signal; use its matrix entry `(agent, provider, coverage)` when triaging an outcome. `full-lifecycle` requires the selected install/inspect/list/version/cleanup contract. `binary-lifecycle` verifies the same binary semantics while naming the credentialed setup boundary separately. A red entry means the selected provider, installer, semantic assertion, or cleanup contract failed and requires diagnosis.
4. Run `bun run test:sandbox` when you also want to validate the Modal transport or broad sandbox scenarios.
5. If an isolated run fails, compare whether the failure is code-related or environment-related by rerunning the same agent list through Docker; never reproduce a real installer directly in the host HOME.
6. If Modal setup is missing, install or repair the local Modal CLI only when the Modal transport itself is in scope.

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
- the isolation layer needs credentials or external state that cannot be safely represented in merge-gating CI
- a new scenario needs to mutate real external account state instead of a disposable package install inside the sandbox

## Related artifacts

- [README.md](../../README.md)
- [Code Quality Tooling Spec](../../openspec/specs/code-quality-tooling/spec.md)
- [OpenSpec change redesign-project-workflow](../../openspec/changes/redesign-project-workflow/proposal.md)
