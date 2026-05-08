## Context

The repository already has an optional isolation layer that runs real Quantex lifecycle flows inside Docker or Modal-backed Bun environments. That layer covers managed agent lifecycle, preinstalled adoption, ambiguous PATH detection, and standalone-binary self inspection. It does not cover the highest-risk self-upgrade path: Quantex installed through Bun and then upgrading itself through a managed package flow.

The self-upgrade bugs reported so far were end-to-end failures. Unit tests helped after the fact, but the escaping behavior depended on the interaction between real package-manager installs, a real Quantex entrypoint, registry metadata resolution, and post-upgrade verification. The isolation layer is the right place to protect that chain.

## Goals / Non-Goals

**Goals:**

- Add a deterministic managed self-upgrade smoke scenario to the existing isolation layer.
- Keep the scenario local to the sandbox process rather than depending on public npm release timing.
- Reuse the current `scripts/lifecycle-smoke.ts` entrypoint so Docker and Modal continue to exercise the same scenario set.
- Validate the specific Bun-managed flow that has produced the recent self-upgrade regressions.

**Non-Goals:**

- Re-architecting the self-upgrade implementation in this change.
- Covering every managed self-upgrade provider in the first sandbox pass.
- Turning the isolation layer into a general-purpose local registry framework.
- Replacing unit and integration tests with sandbox-only validation.

## Decisions

- Add a new `self-managed` lifecycle smoke scenario inside the existing lifecycle smoke script.
  Rationale: the current Docker and Modal harnesses already delegate to `scripts/lifecycle-smoke.ts`, so extending that script keeps both transports aligned without introducing a second remote entrypoint.

- Use an ephemeral local npm-style registry served from inside the sandbox process.
  Rationale: managed self-upgrade needs a deterministic upgrade target. A local registry avoids dependency on public npm freshness, mirror lag, or release timing while still exercising Quantex through its real managed self-upgrade path.

- Generate two local Quantex package tarballs for the scenario: a seeded older version and the current checkout version.
  Rationale: the scenario must start from a version that is semantically older than the current checkout, then upgrade to the current version. Packaging both tarballs locally lets the test control that version graph precisely.

- Seed the older package by rewriting the packaged version strings instead of maintaining a second source tree.
  Rationale: the self-upgrade sandbox only needs an older packaged artifact, not a maintained historical branch. Rewriting the staged package contents keeps the fixture lightweight and local to the scenario.

- Scope the first managed self-upgrade sandbox scenario to Bun installs.
  Rationale: Bun is the repository default package manager and the source of the recent user-facing self-upgrade failures. One stable Bun scenario provides useful regression coverage without doubling runtime and fixture complexity in the first pass.

## Risks / Trade-offs

- [Longer isolation runtime] Packaging tarballs and running a local registry increases sandbox duration. → Mitigation: keep the fixture self-contained, reuse the current checkout build output, and limit the first managed self-upgrade scenario to Bun.
- [Fixture drift] The sandbox registry could diverge from what Bun expects from a real npm registry. → Mitigation: use a minimal metadata shape proven by a direct `bun add -g` local-registry prototype and keep the scenario focused on the fields Quantex itself consumes.
- [Packaged-version rewriting misses a new embedded version string] The seeded “older version” package could still report the current version if future build output changes. → Mitigation: assert the seeded `qtx --version` value before running `upgrade --check`, so the scenario fails early if the seed package stops behaving like an older install.
