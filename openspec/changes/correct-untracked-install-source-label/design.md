## Context

`formatInstalledSource(state)` in `src/utils/install.ts` renders one of four source labels. Three describe a tracked install (`managed via <type>`, `script installer`, `binary installer`). The fourth is the `!state` branch: Quantex found an executable it has no install record for. That branch returns `detected in PATH`.

Before PR #614, the `!state` branch was reachable only when the executable resolved through `PATH`, so the label was true by construction. PR #614 widened resolution to `PATH` first, then a fixed set of known install directories (`src/utils/executable-search-paths.ts`). The `!state` branch is now reachable through either route, and the label is asserted unconditionally.

The label is not confined to one renderer. It flows through `src/inspection/agents.ts` and `src/compatibility/agent-inspection.ts` into `sourceLabel`, which is printed as `Source:` by `inspect`, `info`, and `resolve`, printed as a `Source` column by `doctor`, and pattern-matched by `formatListSource` in `src/commands/list.ts` — where the exact string `detected in PATH` is what produces the `PATH` value in the `list` Source column. Two warning messages assert the same claim in prose.

## Goals / Non-Goals

**Goals:**

- Make every human-facing statement about an untracked agent's source true under the widened resolution rule.
- Keep the correction confined to prose, so no machine consumer has to change.
- Record explicitly which identifiers are frozen, so a later cleanup pass does not "finish the job" by renaming them.

**Non-Goals:**

- Do not report *which* of the two resolution routes was used. That would require threading resolution provenance from the observation layer into `formatInstalledSource`, which is a pure function of `InstalledAgentState` and by definition has no state in this branch.
- Do not rename `isBinaryInPath` / `getBinaryPath`. PR #614 already settled that: they are pinned by the v1 root-export fixture and carry documented compatibility delegates.
- Do not change the resolution rule itself. This change is about describing it accurately.

## Decisions

1. **Rename the label rather than only fixing the `doctor` and `update` warnings.**
   - The prompt offered keeping `detected in PATH` and correcting only the two warning strings. Rejected: the label itself is the primary user-facing claim and it is the one printed directly beside the contradicting `binaryPath`. `inspect`, `info`, `resolve`, `list`, and `doctor` all render it, and `list` escalates it into a bare `PATH` column value with no adjacent path to contradict it. Fixing the warnings while leaving the label would correct the two least prominent statements and leave five surfaces asserting the falsehood.
   - The compatibility suite pinning the string is a reason to record the decision, not a reason to preserve a false statement. `test/compatibility/agent-inspection.test.ts` is titled "preserves historical inspection **meanings**"; the meaning of the `!state` branch is "Quantex has no install record for this executable", and `detected in PATH` is a stale rendering of that meaning, not the meaning itself.

2. **The replacement is `detected on disk`, not `detected`.**
   - `detected` alone loses the contrast with the three tracked labels, which all name a source. `detected on disk` states the actual evidence: a file exists and is executable, and Quantex did not install it.
   - It is true under both resolution routes, so it does not need to be revisited if the known-directory set changes.
   - The `list` column maps it to `detected` — the column is a narrow optional column whose siblings are single words (`bun`, `npm`, `script`, `binary`), and the full label is available from `qtx inspect`, which the list footer already points to.

3. **Human-readable label prose is correctable; machine identifiers are frozen.**
   - `sourceLabel` is declared `{ type: 'string' }` in `src/command-contract/schemas.ts` — free-form, with no enum. The compatibility-contract requirement freezes "field names, types, requiredness, meanings, and version semantics" and forbids removing, renaming, or incompatibly reinterpreting a *field*. The field keeps its name, type, requiredness, and meaning ("a human-readable description of the install source"). Only the prose it carries becomes accurate.
   - A consumer that string-matches `sourceLabel` is matching on prose that the `human-readable-output` capability already governs. The stable discriminator for exactly this case already exists and is unchanged: `resolve` emits `installSource: 'detected-in-path'`.
   - That discriminator, `inPath`, and the `AGENT_UNTRACKED_IN_PATH` issue code stay as-is. They are keyed on by consumers and by `doctor`'s own issue routing, and their names — like `isBinaryInPath` — are historical identifiers whose widened meaning PR #614 deliberately accepted. Renaming them would be a genuine v1 break for no user-visible gain.
   - Consequence worth stating plainly: after this change the identifier `detected-in-path` and the label `detected on disk` describe the same condition with different words. That asymmetry is intentional and is the price of not breaking machine consumers; the new compatibility-contract requirement records it so it is not read as an oversight.

4. **`doctor`'s `SELF_INSTALLER_MISSING` message is left alone.**
   - It says a *package manager* (`bun`/`npm`) "is not available in PATH". That is a real `PATH` lookup against a package manager binary, not an agent executable resolved under the widened rule, and the statement is correct. Rewording it would spread this change into an unrelated surface.

## Risks / Trade-offs

- **A downstream consumer string-matching `detected in PATH` breaks.** Accepted. The v1 contract points such consumers at `installSource`, which is unchanged; the alternative is preserving a false statement indefinitely. The change is recorded here and in the compatibility-contract delta so the reasoning survives.
- **`list` shows `detected` where it showed `PATH`.** Slightly less specific, but the previous value was specific and wrong. Users needing the source run `qtx inspect`, which the list footer already directs them to.
- **The label no longer distinguishes the two resolution routes.** Deliberate (Non-Goals). Users who need the location read `binaryPath`, which `inspect` and `resolve` both print and which is the field that was already telling the truth.
