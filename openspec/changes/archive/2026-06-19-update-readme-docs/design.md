## Overview

This is a documentation sync only. The current CLI and catalog already expose the behavior being documented, so implementation is limited to README text and OpenSpec delta coverage.

## Source Of Truth

- Supported agent names come from `bun run dev -- list --json`, which reflects the current catalog and command surface.
- Configuration defaults come from `src/config/default.ts`.
- README requirements come from `openspec/specs/product-readme/spec.md`.

## Decisions

- Update both full product README pages, `README.md` and `README.zh-CN.md`, so language variants stay aligned.
- Keep `README.en.md` as a pointer file because the canonical English product landing page is already `README.md`.
- Do not add generated README tooling in this change; the update is small and localized.
- Represent `selfUpdateRegistry` as an optional override in prose instead of placing a fixed npm URL in the default JSON example.

## Non-Goals

- Do not change CLI behavior, schemas, package-manager behavior, agent catalog metadata, or release artifacts.
- Do not expand Quantex into workflow orchestration guidance.
- Do not introduce new root-level Markdown files.
