# Proposal: unify-runtime-bootstrap-stubs

## Why

The repository checks in four agent-runtime bootstrap entries, and one of them is built differently from the other three.

`.agents/skills/quantex-agent-runtime/SKILL.md`, `.codex/skills/quantex-agent-runtime/SKILL.md`, and `.github/skills/quantex-agent-runtime/SKILL.md` are regular files holding a byte-identical copy of `skills/quantex-agent-runtime/bootstrap-stub.md` — a 17-line pointer at the central runtime. `bun run memory:check` and `test/project-memory.test.ts` assert that parity, so they cannot drift.

`.claude/skills/quantex-agent-runtime` is a git symlink (mode `120000`) to the `skills/quantex-agent-runtime` **directory**. It is a different mechanism carrying different content — Claude Code discovers the full 178-line runtime skill where every other agent discovers the pointer — and nothing in CI reads through it, so it is the one bootstrap entry with no verification at all.

Two costs follow from the exception:

- **It is unverified.** The stub-parity check enumerates three paths. If the symlink target moves or the link breaks, `memory:check`, `bun run test`, and every CI job stay green.
- **It is the least portable of the four.** Git records the entry as a symlink, but a checkout on a filesystem or platform without symlink support materializes it as a regular file whose contents are the literal target path. Because nothing reads it, that degradation is silent — and the repository runs a `test (windows-latest)` job precisely because platform differences are expected here.

The symlink also makes Claude's runtime entry a materially different contract from every other agent's: `project-memory` requires agent-specific integration files to stay short routes to the central runtime, and one agent instead getting the whole workflow body inlined into its discovery surface is a divergence the spec never sanctioned.

## What Changes

- **Replace the `.claude` symlink with a stub copy.** `.claude/skills/quantex-agent-runtime` becomes a regular directory containing `SKILL.md`, byte-identical to `skills/quantex-agent-runtime/bootstrap-stub.md`, exactly like the other three entries. Claude Code reads the pointer and follows it to `skills/quantex-agent-runtime/SKILL.md`, which is the path every other agent already takes.
- **Extend stub-parity enforcement to four paths.** `scripts/ci/check-project-memory.ts` and `test/project-memory.test.ts` add `.claude/skills/quantex-agent-runtime/SKILL.md` to the enumerated stub set, so the previously unchecked entry gains the same byte-parity guard.
- **Promote the parity rule from tooling to contract.** `project-memory` gains a requirement stating that every checked-in agent bootstrap entry is a regular-file copy of the single canonical template and that no agent directory reaches the central runtime by symlink, so the exception cannot be reintroduced without a spec change.
- Update `docs/adr/0009-workflow-v2.md`, whose single-sourcing note enumerates three stubs.

Non-goals: the canonical `skills/quantex-agent-runtime/SKILL.md` body, the stub text itself, and the set of supported agent directories are all unchanged. This change does not add or remove an agent integration.

## Capabilities

- **New Capabilities**: none.
- **Modified Capabilities**:
  - `project-memory` — the thin-agent-files requirement gains an explicit form contract: bootstrap entries are byte-identical regular-file copies of one template, symlinked agent entries are not permitted, and `memory:check` covers every checked-in entry.

## Impact

- `.claude/skills/quantex-agent-runtime` (symlink deleted; directory with `SKILL.md` added)
- `scripts/ci/check-project-memory.ts`, `test/project-memory.test.ts`
- `openspec/specs/project-memory/spec.md`
- `docs/adr/0009-workflow-v2.md`

No CLI behavior, structured output, agent catalog, config, state, release, or packaging surface changes. The published npm package is unaffected — none of these paths ship in it.

## Intake classification

Durable-process and project-memory change: it alters how agent runtime entries are structured and adds a spec-level requirement. OpenSpec required.
