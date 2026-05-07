## Context

Quantex runs Bun global install and update commands for Bun-managed agents, then checks `bun pm -g untrusted` so it can trust requested packages whose lifecycle scripts were blocked. This matters for packages such as Claude Code, where the Windows package ships a small placeholder binary and relies on `postinstall` to place the real native executable.

The current parser recognizes only `./node_modules/<package> @<version>` output. Bun on Windows emits the same package list with backslashes, such as `.\node_modules\@anthropic-ai\claude-code @2.1.132`, so the package is not trusted even though Quantex reports the update as successful.

## Goals / Non-Goals

**Goals:**

- Parse Bun untrusted package output with POSIX or Windows path separators.
- Keep trust scoped to packages explicitly requested by the install or update operation.
- Preserve current behavior for non-matching lines and failed Bun commands.
- Cover the parser with regression tests for scoped package names and Windows-style paths.

**Non-Goals:**

- Change Quantex into a general Bun repair tool.
- Trust every blocked transitive lifecycle script by default.
- Change structured output schemas or command catalog entries.

## Decisions

- Normalize path separators before matching package names. This keeps the parser small and avoids duplicating regexes for each platform.
- Continue filtering parsed untrusted packages against the requested package names. This preserves the current least-surprise behavior and avoids trusting unrelated blocked scripts from global dependencies.
- Export only the small parser helper for tests. The install/update execution flow remains unchanged, while the platform-sensitive behavior becomes directly testable without invoking global Bun.

## Risks / Trade-offs

- Windows path output could contain future Bun formatting changes -> keep parsing conservative around `node_modules/<package> @` and ignore unknown lines.
- A requested package might depend on a transitive package whose blocked script is also required -> this change keeps existing trust scope unchanged; broader trust policy would need a separate OpenSpec decision.
