# Proposal: drop-windows-thread-pool

## Why

The `test (windows-latest)` job intermittently dies with `error: script "test" exited with code 5`. Every test file reports a pass, no assertion fails, and Vitest never prints its summary — the process disappears partway through. It always passes on re-run, so every occurrence costs a manual retry.

An A/B experiment isolated the cause. Two branches from the same commit differed only in whether the Windows job passed `--pool=threads`, and each received independent CI runs:

| arm | exit-5 rate |
| --- | ---: |
| `--pool=threads` (current) | **3 / 10** |
| default pool | **0 / 9** |

Supporting evidence rules out the alternatives. Vitest never returns 5 — its source sets only `1` and `130` — so the code comes from the Node process itself. Vitest runs under Node 24, not Bun, so this is not a Bun `worker_threads` gap. The last test file printed differs between occurrences, so it is not one bad test. Node exits `134` on heap exhaustion, not `5`, so it is not a simple out-of-memory.

`--pool=threads` runs every worker inside a single process sharing one V8 instance; the default `forks` pool gives each worker its own process. Windows was the only platform passing the flag and the only platform showing the failure, while macOS and Ubuntu run the same suite and the same Vitest without it.

The override has no recorded justification. It was added on 2026-04-23 in `a4fcd05` with an empty commit body, and `code-quality-tooling` then wrote it into the contract as "the established thread-pool invocation" — pinning an undocumented accident as a requirement.

## What Changes

- **Remove `--pool=threads` from the Windows test job.** All three platform jobs now run the same `bun run test`.
- **Restate the Windows coverage requirement** so it no longer mandates a thread-pool invocation, records why the override was removed, and forbids reintroducing a platform-specific pool without a recorded reason and evidence.

## Capabilities

- **Modified Capabilities**:
  - `code-quality-tooling` — Windows coverage no longer pins a pool override, and platform jobs are required to agree on the test command.

## Impact

- `.github/workflows/ci.yml`, `openspec/specs/code-quality-tooling/spec.md`

No product code, test, or release-surface changes.

## Honest limits

0/9 against 3/10 is a directional result, not proof. It is consistent with every other observation — Windows-only, threads-only, no failing test, not Vitest's own exit path — but the sample cannot exclude a rarer cause that the pool change merely masks. If exit 5 appears again after this lands, the pool was not the whole story and the investigation should resume from that fact rather than from this conclusion.

## Intake classification

Durable CI contract change removing a pinned invocation from `code-quality-tooling`; OpenSpec required.
