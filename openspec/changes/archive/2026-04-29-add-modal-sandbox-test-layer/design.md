## Context

Quantex is a CLI project, so most of its logic belongs in fast local tests. The gap is not unit coverage; the gap is a lightweight way to re-run a narrow slice of host-sensitive validation inside an isolated environment without asking contributors to manually prepare a VM or risk mutating their workstation state.

The repository already avoids orchestration-heavy project wrappers and prefers native tooling. That means the sandbox layer should stay thin, optional, and easy to reason about.

## Goals / Non-Goals

**Goals:**

- Provide one repository-native command for running a curated validation slice inside a Modal sandbox.
- Provide one repository-native local fallback command for running the same slice inside Docker when Modal is unavailable on the contributor machine.
- Keep the implementation small enough that Quantex does not grow workflow-platform behavior.
- Reuse official Modal primitives for mounting a local checkout and running commands in a remote container.
- Reuse a normal Bun container image for local isolation without introducing a repository-specific Dockerfile.
- Preserve `bun run test` as the default validation path for normal development.

**Non-Goals:**

- Replacing the local Vitest suite with remote execution.
- Turning every CI run into a Modal-backed workflow.
- Making the Modal sandbox workflow a merge-gating requirement in the first iteration.
- Adding project-specific PR, queue, or workflow orchestration commands around Modal.
- Building a general-purpose remote execution service inside Quantex itself.

## Decisions

- Use the Modal CLI's `modal shell` path as the transport instead of adding a repository-managed Python Modal app.
  Rationale: this keeps the integration thin, avoids adding a Python dependency graph to the repository, and uses official `--add-local` and `--image` support to mount the checkout into an isolated container.

- Add a local Docker transport that uses the same Bun image and mounted checkout shape as the Modal path.
  Rationale: contributors should be able to exercise the isolated test slice locally without needing Modal credentials or a local Modal CLI install.

- Mount the current repository into the sandbox and execute tests from that mount.
  Rationale: the official Modal docs support adding a local directory into the sandbox image/runtime, which gives us a fast path for validating the current checkout without a packaging step.

- Default to a real lifecycle smoke script instead of running the unit test suite in a container.
  Rationale: the isolation layer is intended to validate Quantex against a clean HOME, PATH, package-manager state, and real agent installs. The script exercises install, inspect, resolve, ensure, update, and uninstall for the selected agents.

- Include adoption and self-binary scenarios in the default smoke set.
  Rationale: Quantex must handle agents that were installed before Quantex started tracking them, and it must be able to inspect its own standalone binary install source and self-upgrade surface from an actual compiled entrypoint.

- Include an ambiguous multi-method scenario for agents such as Qoder.
  Rationale: agents with bun, npm, script, and brew install paths must not be silently adopted from a generic PATH hit unless Quantex can identify the actual install source.

- Use the pinned Bun version from `package.json` as the default sandbox image tag.
  Rationale: running inside `oven/bun:<version>` keeps the remote runtime aligned with the repository's local package-manager contract while avoiding ad hoc install logic inside the sandbox.

- Fail fast with actionable guidance when the Modal CLI is unavailable locally.
  Rationale: sandbox validation is optional, so the harness should clearly explain the missing prerequisite instead of failing with an opaque spawn error.

- Keep Modal-backed isolation in a dedicated GitHub Actions workflow instead of merging it into `ci.yml`.
  Rationale: the existing `ci.yml` workflow is the merge-gating path and intentionally avoids extra credentialed remote dependencies. A dedicated workflow keeps Modal tokens, scheduling, and failure modes isolated from the baseline CI contract.

## Risks / Trade-offs

- [Remote dependency drift] Modal login state, network availability, or registry access can fail independently of the code under test. → Mitigation: keep the command opt-in and document it as an additional validation layer rather than a mandatory local gate.
- [Container runtime drift] Docker and Modal may expose slightly different defaults even when they share the same base image. → Mitigation: keep the default agent list narrow and treat Docker as a local isolation fallback, not as proof that the Modal workflow itself is healthy.
- [False sense of isolation] A Linux sandbox does not cover macOS- or Windows-specific behavior. → Mitigation: scope the first version to host-sensitive generic flows and keep existing platform-specific CI and local tests in place.
- [Slow feedback] Real lifecycle smoke installs and removes agent packages. → Mitigation: run one low-risk default agent and allow explicit agent lists when contributors need broader validation.
- [Self-upgrade network variability] `upgrade --check` for standalone binaries depends on GitHub release metadata. → Mitigation: the smoke accepts check-unavailable results but still asserts that the binary entrypoint reports `installSource: binary` and `canAutoUpdate: true`.

## Migration Plan

- Add the OpenSpec delta describing the optional Docker and Modal isolation commands and the dedicated workflow.
- Implement a shared command builder plus `test:container` and `test:sandbox` wrapper scripts.
- Add a dedicated GitHub Actions workflow for Modal-backed isolation runs.
- Document prerequisites and intended use in the README maintainer section and a dedicated runbook.
- Validate with lint, format, typecheck, tests, and OpenSpec validation. The Modal-backed command itself is best-effort unless the local machine is authenticated with Modal.

## Open Questions

- None for the first slice. Broader coverage, PR-triggered remote runs, or non-Linux sandbox targets can be evaluated in later changes if the optional layer proves useful.
