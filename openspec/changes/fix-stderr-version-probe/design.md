## Context

Quantex has two installed-executable version probe paths. The shared utility path uses `readProcessOutput`/`readProcessOutputWithContext`, while the production core observation path uses `runReadOnlyCommand`. Both capture stdout and stderr, but both currently parse stdout only. A successful Pi probe can therefore return exit code 0 with the version only on stderr and be exposed as an unknown installed version.

The fix crosses these two observation implementations but does not change the lifecycle evidence model: PATH executable evidence remains distinct from provider/package evidence, and existing version parser and exit-code semantics remain authoritative.

## Goals / Non-Goals

**Goals:**

- Make successful version probes resilient to CLIs that emit their version on stderr.
- Preserve stdout as the preferred evidence when both streams are populated.
- Apply identical fallback semantics to the shared and core probe paths.
- Cover default parsing, custom parser fallback, stdout precedence, and non-zero exits with focused regression tests.

**Non-Goals:**

- Do not concatenate stdout and stderr, because warnings from one stream could contaminate the version value from the other.
- Do not change the parser's existing first-line and version-pattern behavior.
- Do not merge provider-observed package versions into PATH executable inspection.
- Do not add agent-specific catalog metadata or a managed package fallback.

## Decisions

1. **Parse stdout first, then stderr only when stdout returns no version.**
   - This preserves the current behavior for agents that use stdout and supports stderr-only agents without changing the public version shape.
   - Alternative: concatenate both streams. Rejected because diagnostics or warnings could become a false version or alter custom-parser input.
   - Alternative: add a per-agent stream setting. Rejected because the failure is a valid generic probe behavior and would require unnecessary catalog schema/API surface.

2. **Reuse the existing parser independently for each stream.**
   - A custom parser receives one stream at a time, and returning `undefined` from the stdout attempt enables the stderr attempt.
   - Alternative: introduce a new parser callback with both streams. Rejected because it breaks the existing probe contract and is unnecessary for the reported failure.

3. **Keep non-zero exits authoritative.**
   - A process that fails is not a successful version probe even if stderr happens to contain a version-like string.
   - Alternative: parse stderr on failure. Rejected because it could convert error messages or partial output into installed-version evidence.

4. **Test both implementations at their existing boundaries.**
   - `getInstalledVersion` is covered through its existing mocked process tests, and core observation is covered through a temporary executable and `createProductionCoreReadPorts`.
   - This proves the two code paths do not drift while avoiding changes to public APIs.

## Risks / Trade-offs

- [A CLI writes a warning as the only stdout line and a valid version to stderr] → The existing parser treats a non-empty first line as a value, so stdout remains authoritative; this preserves backward compatibility but may require an agent-specific parser if that CLI is encountered.
- [A custom parser is not safe for stderr input] → The existing callback contract is stream-text based and tests will require undefined stdout results to permit stderr fallback; catalog-specific parsers remain responsible for their accepted input.
- [A probe emits a version only on stderr with a non-zero exit] → The result remains unknown, preserving the success gate and avoiding false installed evidence.

## Migration Plan

No data migration or dependency change is required. Ship the code and focused tests with the implementation PR; existing state files and structured output fields remain compatible. Rollback is a code revert if a probe-specific parser depends on stdout-only invocation behavior.

## Open Questions

None for this change. Future stream-specific probe behavior can be introduced as a separate catalog contract if a CLI needs semantics beyond independent stdout/stderr parsing.
