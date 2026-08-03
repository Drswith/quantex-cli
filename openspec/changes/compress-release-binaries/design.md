## Context

The release job compiles five standalone binaries, then hashes and uploads those raw files alongside `manifest.json` and `SHA256SUMS.txt`. The manifest is also the self-upgrade locator, so changing only the uploaded asset names would break binary-installed users.

## Goals / Non-Goals

**Goals:**

- Publish a smaller compressed asset for every supported target.
- Keep a deterministic target-to-asset mapping and SHA-256 verification.
- Keep self-upgrade atomic, rollback-capable, and independent of host archive utilities.

**Non-Goals:**

- Change supported platform targets, npm package distribution, or release seal/publish ordering.
- Introduce a general archive format or a multi-file SDK distribution.

## Decisions

- Use one `.tar.gz` archive per target, containing exactly its existing executable filename. A single format keeps documentation, manifest handling, and extraction behavior uniform across macOS, Linux, and Windows.
- Hash and publish archives, not the uncompressed binaries. This makes the release metadata prove the exact bytes users download.
- Extract archives in the compiled Bun runtime after checksum verification. This avoids assuming that `tar`, `unzip`, or a particular PowerShell version is present on a binary user's machine.
- Reject unsafe or malformed archives: extraction accepts exactly the expected regular-file entry and no path traversal. The existing executable replacement is reached only after this boundary.

## Risks / Trade-offs

- [Legacy raw-asset URLs disappear for new releases] -> manifest-driven self-upgrade and the runbook point to archive assets; previously published releases remain unchanged.
- [Archive parser defect] -> cover valid, mismatched, and traversal archive cases; retain verification and rollback tests.
- [`.tar.gz` is less familiar on Windows] -> the archive contains the clearly named `.exe`; the runtime handles extraction automatically.

## Migration Plan

1. Produce and validate archives in the local release artifact pipeline.
2. Switch candidate staging and GitHub upload to archives.
3. Make the manifest and binary provider resolve archive names, verify archive hashes, and safely extract before replacement.
4. Run artifact, self-upgrade, and release-smoke validation before merge. A release retry continues to reconcile an immutable candidate as before.
