## Context

The standalone release matrix currently derives every asset name with a single `.tar.gz` suffix. That rule is shared by artifact generation, manifest/checksum validation, release smoke verification, and binary self-upgrade, so changing only the packaging command would leave Windows downloads or upgrades inconsistent. The fix must preserve the existing Unix tarball contract while introducing a native Windows ZIP contract without adding a platform-specific runtime dependency.

## Goals / Non-Goals

**Goals:**

- Define one canonical archive format and filename for each supported release target.
- Generate a single-entry `.zip` for Windows and gzip-compressed ustar archives for macOS/Linux.
- Make manifest validation, smoke verification, and self-upgrade use the same platform-aware naming and extraction rules.
- Keep archive extraction constrained to the expected regular-file entry and verify ZIP size/CRC before replacement.

**Non-Goals:**

- Do not publish both legacy and corrected Windows archives in the required asset matrix.
- Do not change the binary target matrix, release channels, checksum algorithm, or replacement/rollback behavior.
- Do not add a general-purpose archive library or support multi-file release archives.

## Decisions

1. **Use the executable target to choose the suffix.** Windows targets resolve to `quantex-windows-x64.exe.zip`; macOS and Linux targets retain the `.tar.gz` suffix. The shared release-artifact helper owns this mapping, so an archive with the wrong suffix is not accepted into the manifest or self-upgrade path.

2. **Implement the required single-file archive writer and reader in the existing release-artifact module.** The writer will emit deterministic gzip+ustar or ZIP (deflate when beneficial, stored otherwise) bytes. The reader will support the corresponding regular-file formats, reject encrypted/data-descriptor ZIP entries and extra or path-mismatched entries, and verify uncompressed size plus CRC for ZIP. This avoids relying on `zip`/`unzip` executables or introducing a new dependency into the CLI.

3. **Keep all consumers on the shared helpers.** Release generation will create the archive through the shared writer; manifest/checksum generation, release smoke verification, and self-upgrade will use the shared name parser and extractor. This prevents a future suffix-only fix from leaving a stale URL or extraction path behind.

4. **Treat the corrected Windows filename as a release migration.** The existing `quantex-windows-x64.exe.tar.gz` asset remains historical; the next corrected release publishes `quantex-windows-x64.exe.zip` and updates `manifest.json` and `SHA256SUMS.txt`. No mutable tag or old asset is rewritten.

## Risks / Trade-offs

- [Risk] A hand-rolled ZIP implementation could accept malformed or unsafe input. → Mitigation: only support one regular file, require the expected exact entry name, reject encryption/data descriptors/extra entries, and verify size and CRC before extraction.
- [Risk] Existing Windows links that hard-code the legacy filename stop working for corrected releases. → Mitigation: the release manifest and latest-download URL become the supported discovery path, and the filename migration is explicitly documented as a breaking asset-name correction.
- [Risk] Replacing the shell tar invocation changes archive generation internals. → Mitigation: retain ustar-compatible headers, gzip compression, deterministic metadata, and round-trip tests for Unix archives.

## Migration Plan

1. Merge the implementation and publish the next normal release through the existing release-please/tag workflow.
2. Verify that the release contains four `.tar.gz` Unix assets and the `.zip` Windows asset, with matching manifest and checksum entries.
3. Verify the current runner smoke test and Windows ZIP extraction/self-upgrade contract in CI.
4. Rollback, if necessary, by reverting the implementation in a new PR; do not move an existing tag or mutate historical release assets.

## Open Questions

None.
