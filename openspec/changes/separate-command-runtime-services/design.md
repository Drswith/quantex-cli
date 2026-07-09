## Context

The runtime facade currently performs four different jobs: replay and persist idempotency records, race command work against deadlines and process signals, translate runtime failures into public output, and finalize successful work with passive self-update notices. These concerns share global CLI context and are covered only through the large facade test suite.

## Goals / Non-Goals

**Goals:**

- Make timeout and signal races command-neutral and directly testable.
- Make idempotency eligibility, lifecycle validation, metadata refresh, and persistence directly testable.
- Leave public result/event construction and rendering in the runtime facade.
- Preserve the exact execution order and compatibility contract.

**Non-Goals:**

- Changing CLI flags, timeout values, grace duration, cancellation-handler behavior, or signal support.
- Changing idempotency storage format, TTL, target semantics, or lifecycle validity rules.
- Replacing global CLI context in this change.
- Adding retries, background execution, daemon behavior, or workflow orchestration.

## Decisions

### Represent cancellation as command-neutral outcomes

Add `executeWithRuntimeCancellation` that returns `completed`, `timed-out`, or `signal-cancelled`. It receives the command function, timeout, cancellation-state reader, cancellation cleanup callback, and signal source dependencies. It does not create `CommandResult` values or emit output.

The service retains the existing late-terminal grace rule: after a deadline, it waits up to `min(timeoutMs, 250)` for a concrete command result before performing cancellation cleanup and returning a timeout outcome.

### Represent idempotency lookup as replay, conflict, or miss

Add `resolveIdempotentExecution` that receives action, target, and explicit invocation metadata. It returns a command-neutral conflict, a refreshed replay result, or no match. A separate persistence function applies the existing success and dry-run rules.

Lifecycle validity checks continue to use agent inspection and remain part of idempotency policy, not the CLI facade.

### Keep output ownership in `command-runtime.ts`

`executeCommandWithRuntime` remains the only public entry point. It maps timeout, signal, idempotency conflict, replay, and state-read outcomes to the existing JSON, NDJSON, and human output functions. Passive self-update notices remain a facade finalization concern.

### Use explicit dependencies with dynamic defaults

Both services expose injectable dependencies and resolve their default module functions at call time. This preserves existing ESM spy behavior while enabling direct unit tests.

## Risks / Trade-offs

- **Risk: Timeout and signal race ordering changes.** → Capture deadline, late completion, cleanup, signal, and listener-removal behavior in direct tests before migration.
- **Risk: Idempotency replay metadata or lifecycle checks drift.** → Add direct tests for conflict, target mismatch, dry-run, stale lifecycle state, replay refresh, and persistence eligibility.
- **Risk: Runtime output is emitted twice.** → Services return outcomes only; the facade remains the sole emitter.
- **Trade-off: Global CLI context remains.** → This phase narrows its use to facade adaptation without expanding scope into a whole-context rewrite.

## Migration Plan

1. Run the existing runtime compatibility suite.
2. Add failing tests for the two new command-neutral services.
3. Implement cancellation and idempotency services.
4. Replace command-local policies with service outcomes and preserve output mapping.
5. Run focused and full repository validation.

Rollback restores the prior private functions in `command-runtime.ts`; no persisted data migration is involved.

## Open Questions

None.
