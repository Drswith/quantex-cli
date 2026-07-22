### Task 4: Schema-Versioned Idempotency Records and Fingerprints

**Files:**
- Create: `src/idempotency/canonical.ts`
- Create: `src/idempotency/schema.ts`
- Modify: `src/idempotency.ts`
- Test: `test/idempotency/canonical.test.ts`
- Test: `test/idempotency/schema.test.ts`
- Modify: `test/idempotency.test.ts`

**Interfaces:**
- Produces: `CanonicalMutationRequest`, `IdempotencyPostcondition`, `IdempotencyReceiptSnapshot`, and `VersionedIdempotencyRecord` with explicit schema version, expiry, canonical request payload, resolved-plan payload, receipt payload, postcondition payload, and a fingerprint beside each payload.
- Produces: `canonicalizeMutationRequest`, `fingerprintCanonicalValue`, `parseIdempotencyRecord`, and clock-injectable load/save functions. Loading returns a discriminated result: `missing`, `expired`, `invalid`, or `valid`, so corrupt evidence cannot be confused with absence.
- Keeps hashed filenames based on the raw caller key so distinct keys remain collision-resistant.

**Staged compatibility boundary:**
- Task 4 adds the versioned load/save API but does not route `src/command-runtime.ts` to it; Task 5 owns replay-policy adoption.
- Keep the current `loadIdempotencyRecord` / `saveIdempotencyRecord` legacy facade behavior and types compiling until Task 5. Give the strict discriminated versioned API explicit names so both paths can coexist temporarily.
- Use idempotency record `schemaVersion: 1` and retain the 24-hour production TTL.
- A versioned record still stores the successful public `CommandResult` needed for later replay, alongside fingerprinted canonical request, resolved-plan, receipt, and postcondition payloads.
- The parser must validate each stored payload fingerprint; invalid/corrupt/unsupported/legacy evidence remains byte-for-byte on disk.
- Canonical request construction accepts mutation-relevant options separately from presentation/runtime metadata. Only the mutation payload is fingerprinted; output mode, color, quiet, and run ID are excluded structurally rather than filtered from an arbitrary shared options bag.

- [ ] **Step 1: Add failing canonicalization and schema tests**

  Cover reordered equivalent batch targets, duplicate target normalization, target/option differences, `latest` resolved-plan changes, stable recursive key ordering, receipt/version changes, corrupt files, unsupported schema versions, expiration, and legacy unversioned records. Assert fingerprints never include output mode, color, quiet, or run ID. Assert the canonical postcondition and receipt payloads remain available to the live validator and match their stored fingerprints.

- [ ] **Step 2: Run storage tests to verify RED**

  Run: `bun run test -- test/idempotency.test.ts test/idempotency/canonical.test.ts test/idempotency/schema.test.ts`

  Expected: FAIL because current records contain only action, target, result, and timestamps.

- [ ] **Step 3: Implement canonical values and deterministic SHA-256 fingerprints**

  Canonicalize command-specific mutation meaning before serialization: sort object keys recursively, sort/deduplicate set-like target arrays, preserve order where order is semantic, and encode absent optional values consistently. Hash the canonical UTF-8 JSON.

- [ ] **Step 4: Implement strict record parsing and durable storage**

  Parse only the current schema into trusted records, delete only expired records, and write through a temporary file plus rename. Return corrupt, unsupported-schema, and legacy unversioned records as `invalid` with their original file retained; never silently treat them as a cache miss. Inject clock/TTL in tests while retaining the 24-hour production default.

- [ ] **Step 5: Verify GREEN and compatibility**

  Run: `bun run test -- test/idempotency.test.ts test/idempotency/canonical.test.ts test/idempotency/schema.test.ts test/state/schema.test.ts`

  Expected: PASS; lifecycle `state.json` schema remains unchanged because idempotency has its own versioned record boundary.

- [ ] **Step 6: Review and checkpoint**

  Request an independent persistence/schema review, then commit:

  ```bash
  git add src/idempotency.ts src/idempotency/canonical.ts src/idempotency/schema.ts test/idempotency.test.ts test/idempotency/canonical.test.ts test/idempotency/schema.test.ts
  git commit -m "refactor(idempotency): version replay evidence"
  ```
