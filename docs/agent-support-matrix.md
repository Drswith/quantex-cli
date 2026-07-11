# Agent Support Matrix

This page defines the review format and current live-doc handoff for Quantex agent-support coverage. It is a documentation and planning aid, not the runtime source of truth.

## Current Surfaces

- `supported` entries come from validated per-agent catalog data in `src/agents/catalog/*.json` and can be verified with `bun run dev -- list --json`.
- Provider, platform, target-kind, and probe coverage is generated from those normalized candidates in [`docs/generated/agent-provider-support.md`](generated/agent-provider-support.md); stale output fails catalog tests.
- Unsupported-candidate triage lives in GitHub issue [#134](https://github.com/Drswith/quantex-cli/issues/134). Keep per-agent implementation work in dedicated issues and OpenSpec changes; keep `#134` as the top-level backlog index until a successor issue is explicitly declared.
- Historical records under `openspec/changes/archive/`, `docs/sessions/`, `docs/postmortems/`, and `docs/archive/` remain point-in-time artifacts and should not be rewritten as the current support matrix.

## Current Supported Canonical Slugs

`amp`, `antigravity`, `auggie`, `autohand`, `claude`, `codebuddy`, `codewhale`, `codex`, `commandcode`, `copilot`, `crush`, `cursor`, `deepcode`, `devin`, `droid`, `forgecode`, `gemini`, `genie`, `goose`, `grok`, `hermes`, `jcode`, `junie`, `kilo`, `kimi`, `kiro`, `mimo`, `omp`, `openclaw`, `opencode`, `openhands`, `pi`, `qoder`, `qwen`, `reasonix`, `vibe`, `vtcode`

## Required Fields

| Field | Meaning |
|---|---|
| Product | The upstream product name shown to humans. |
| Canonical slug | The stable Quantex identifier used for lookup, docs, and future catalog work. |
| Binary command | The upstream executable command Quantex resolves or would resolve at runtime. |
| Aliases | Optional accepted lookup aliases, including executable aliases when they differ from the canonical slug. |
| Status | One of `supported`, `in-progress`, `candidate`, or `excluded`. |
| Notes | Short rationale, blockers, or exception details. |

## Naming Rule

Default rule:

- Use the upstream executable command as the canonical slug when the executable is stable, product-specific, and suitable as a user-facing identifier.

Exception rule:

- Keep a branded canonical slug when the executable command is too generic, ambiguous, or otherwise unsuitable as the primary Quantex identifier.
- In those cases, record the executable separately in `Binary command` and note the exception in `Notes`.
- Add the executable to `Aliases` when that improves lookup and does not weaken the branded slug.

## Status Meanings

| Status | Meaning |
|---|---|
| `supported` | Implemented in `src/agents/catalog/*.json`, validated by the catalog schema, and exposed by the Quantex catalog. |
| `in-progress` | Active implementation or spec work is underway in the repository. |
| `candidate` | Worth evaluating for support, but not yet accepted into implementation. |
| `excluded` | Intentionally outside the Quantex mainline support scope. |

## Example Rows

| Product | Canonical slug | Binary command | Aliases | Status | Notes |
|---|---|---|---|---|---|
| Claude Code | `claude` | `claude` | - | `supported` | Default rule: branded product and executable already match. |
| Command Code | `commandcode` | `command-code` | `command-code`, `cmd`, `cmdc` | `supported` | Quantex keeps a product-specific slug while the upstream binary keeps its hyphenated command. |
| Cursor CLI | `cursor` | `agent` | `agent` | `supported` | Exception rule: `agent` is too generic to use as the primary Quantex slug. |
| Bob | `bob` | `bob` | - | `candidate` | Has a CLI, but support should not start until backlog triage is ready for implementation. |
| Warp | `warp` | `warp` | - | `excluded` | Terminal product rather than a Quantex-style lifecycle agent CLI. |

## Maintenance Notes

- Prefer updating this page together with any catalog naming or support-status decisions.
- Keep candidate and excluded rationale in issue `#134` or an explicitly linked successor issue instead of duplicating a second long-lived backlog table here.
- Do not copy long installer details here; keep the matrix focused on identity, review fields, and where to find the live backlog.
- After changing catalog entries, run `bun run agent-catalog:generate` and commit the generated manifest, schema, support JSON, and provider-support matrix changes.
- If a supported-agent snapshot changes, update this page, the README tables, `skills/quantex-cli/references/command-recipes.md`, and issue `#134` in the same branch when backlog meaning changes.
