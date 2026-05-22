## Context

The uv managed installer implementation already has unit coverage for `uv tool install`, `uv tool upgrade`, `uv tool uninstall`, `uv tool list` parsing, managed state recording, update grouping, capability reporting, and catalog metadata. The gap is the optional isolation layer: `scripts/lifecycle-smoke.ts` can exercise generic managed installs through real catalog agents and has a fake Cargo package-manager scenario, but it has no uv-specific fake smoke.

The sandbox layer should validate Quantex's lifecycle contract with enough realism to catch command-shape or state-routing regressions, without depending on public package availability, upstream agent behavior, Python version installation, or network speed.

## Decisions

### Add a fake uv scenario instead of installing a real uv-distributed agent

The new `uv-managed` scenario will place a fake `uv` executable ahead of the normal `PATH`, then run a small lifecycle smoke against a generated test agent that declares a uv managed install method.

Rationale: this mirrors the existing fake Cargo smoke pattern and keeps the sandbox deterministic. The useful behavior to validate here is that Quantex chooses uv, preserves package install args, records managed state, updates through `uv tool upgrade`, and uninstalls through `uv tool uninstall`.

### Keep the scenario inside the existing lifecycle smoke entrypoint

Both Docker/container and Modal sandbox transports already delegate to `scripts/lifecycle-smoke.ts`. Adding a new scenario there keeps transports aligned and lets maintainers run only the uv scenario with `QTX_ISOLATION_SCENARIOS=uv-managed`.

### Include uv-managed in the PR sandbox profile

The fake uv scenario is local, deterministic, and does not require Modal to install real uv or Python dependencies. It should therefore be part of the trusted pull-request sandbox profile, not only the broader protected-branch default profile.

## Risks / Trade-offs

- [Does not prove upstream package installability] A fake uv executable does not validate that OpenHands, Kimi, or Mistral Vibe currently install from upstream. That is intentional; upstream verification belongs to catalog intake and targeted manual checks, while sandbox smoke protects Quantex lifecycle plumbing.
- [Fixture drift] The generated fake agent or fake uv output could stop matching the real package-manager adapter assumptions. Mitigation: assert the exact fake uv log lines for install, upgrade, uninstall, and list operations so drift is visible.
