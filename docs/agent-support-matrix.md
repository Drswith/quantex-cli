# Agent Support Matrix

This page defines the review format for Quantex agent-support coverage. It is a documentation and planning aid, not the runtime source of truth.

## Source Of Truth

- `supported` entries must match implemented definitions in `src/agents/definitions/*.ts`.
- `in-progress` entries should point to an active OpenSpec change when one exists.
- `candidate` and `excluded` entries are evaluation states only; they do not create product guarantees.

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
| `supported` | Implemented in `src/agents/definitions/*.ts` and exposed by the Quantex catalog. |
| `in-progress` | Active implementation or spec work is underway in the repository. |
| `candidate` | Worth evaluating for support, but not yet accepted into implementation. |
| `excluded` | Intentionally outside the Quantex mainline support scope. |

## Example Rows

| Product | Canonical slug | Binary command | Aliases | Status | Notes |
|---|---|---|---|---|---|
| Claude Code | `claude` | `claude` | - | `supported` | Default rule: branded product and executable already match. |
| GitHub Copilot CLI | `copilot` | `copilot` | - | `supported` | Quantex identifier follows the executable command. |
| Cursor CLI | `cursor` | `agent` | `agent` | `supported` | Exception rule: `agent` is too generic to use as the primary Quantex slug. |
| Crush | `crush` | `crush` | - | `in-progress` | Track through the active OpenSpec change while implementation is unfinished. |
| Warp | `warp` | `warp` | - | `excluded` | Terminal product rather than a Quantex-style lifecycle agent CLI. |

## Maintenance Notes

- Prefer updating this page together with any catalog naming or support-status decisions.
- Do not copy long installer details here; keep the matrix focused on identity and support state.
- If support-matrix maintenance becomes noisy, follow up with automation that derives supported rows from `src/agents/definitions/*.ts`.
