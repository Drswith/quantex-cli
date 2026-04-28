## Context

Issue #75 promotes the accepted direction from Discussion #69 into implementation. The work changes product-facing documentation rather than CLI code, but it spans three surfaces with different audiences: the Chinese README, the English README, and the repo-published Quantex skill for coding agents.

The main ambiguity is not wording alone. The no-install commands must reflect how the published package actually executes today. Validation showed that:

- `npx --package quantex-cli qtx ...` and `npm exec --package quantex-cli -- qtx ...` work when the runtime environment includes `bun`.
- `pnpm dlx quantex-cli ...` is ambiguous because the package exposes multiple bins, so the explicit `pnpm --package=quantex-cli dlx qtx ...` form is safer.
- `bunx -p quantex-cli qtx ...` can resolve to an already installed global `qtx`, while `bunx quantex-cli ...` correctly executes the published package.
- The published CLI entrypoint uses `#!/usr/bin/env bun`, so “no-install” still assumes the machine has the required runtime available on `PATH`.

## Goals / Non-Goals

**Goals:**

- Make `qtx` the recommended short entry point in product-facing README examples.
- Keep `quantex` explicitly visible as the equivalent long-form command for searchability and self-explanatory examples.
- Add a first-class no-install section that only promotes read-only discovery commands and uses validated command forms.
- Keep README and skill wording aligned enough that users and agents do not infer contradictory guidance.

**Non-Goals:**

- Change CLI behavior, binary layout, or self-upgrade semantics.
- Guarantee a truly dependency-free tryout path.
- Rewrite the skill to prefer the short alias for automation where the explicit `quantex` form is still clearer.

## Decisions

### Prefer `qtx` in user-facing quick paths, keep `quantex` visible elsewhere

The README hero, quick start, and supported-agent examples will prefer `qtx` because that is the project's desired ergonomic entry point. The command overview will continue to show `quantex` alongside `qtx` where discoverability and grep-ability matter.

Alternative considered: switch every example to `qtx`.
Rejected because the long form remains valuable for search, scripts, and self-explanatory reference snippets.

### Promote no-install usage only for read-only commands

The new no-install section will focus on commands such as `list`, `info`, `inspect`, `doctor`, `capabilities`, `commands`, and `schema`. Commands that install, update, uninstall, or write Quantex state will continue to route users to normal installation guidance.

Alternative considered: promote no-install execution for the whole CLI.
Rejected because it conflicts with the tracked-install-source and self-upgrade story already documented elsewhere in the product.

### Document verified package-manager forms instead of assuming symmetry

The no-install section will only recommend command forms that were validated against the published package behavior:

- `npx --yes --package quantex-cli qtx ...`
- `npm exec --yes --package quantex-cli -- qtx ...`
- `pnpm --package=quantex-cli dlx qtx ...`
- `bunx quantex-cli ...`

The docs will also state that the current published package executes through `bun`, so these trial commands still require the runtime environment Quantex expects today.

Alternative considered: present `npx`, `bunx`, and `pnpm dlx` as interchangeable variants of the same syntax.
Rejected because the package exposes multiple bins and current `bunx` / `pnpm` invocation forms are not symmetric in practice.

## Risks / Trade-offs

- [Users may read “no-install” as “no prerequisites”] → Clarify that the commands avoid global Quantex installation, not runtime prerequisites.
- [The validated package-manager forms may drift as packaging changes] → Capture the expectation in OpenSpec and keep examples narrowly focused on read-only discovery commands.
- [README and skill wording could diverge again later] → Update both in one change and keep the skill aligned on equivalence and discovery guidance.
