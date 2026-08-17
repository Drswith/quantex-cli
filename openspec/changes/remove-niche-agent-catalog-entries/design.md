## Context

Five catalog entries are being withdrawn. Four of them — `jcode`, `deepcode`, `genie`, `vtcode` — are part of the v1 root export snapshot, pinned two ways:

- `test/fixtures/compatibility/v1/root-exports.json` is compared with `toEqual` against `Object.keys(await import('src/index')).sort()`, so the export set is an exact-match contract, not a superset check.
- `scripts/release/verify-package-distribution.ts` generates a TypeScript consumer that imports every name in that fixture from the published package and compiles it, so the contract is also enforced against real build output.

`forgecode` postdates the snapshot and appears in neither, so only four exports are at stake.

## Goals / Non-Goals

**Goals**

- Withdraw five entries from the catalog without misrepresenting why.
- Keep the change non-breaking, so it merges to `main` while stable v2 remains deferred.
- Keep the `deno` provider working after its only catalog consumer leaves.

**Non-Goals**

- Ending the v1 root export window. That is a separate future major change.
- Removing provider implementations.
- Migrating or invalidating persisted state for users who already installed these agents.

## Decisions

### The withdrawn symbols are retained, which is what keeps this a minor

Removing an agent from the catalog is a CLI capability change. Removing a symbol from the package root is a library API break. These five withdrawals do the first; only four of them would also do the second, and that second part is what would force a major.

The first draft of this change did remove the exports, and accepted a major. That was the wrong trade. `major-release-readiness` defers every stable `2.x` until a separate reviewed change records the completed v2 refactor plus 90 elapsed days, and enforcement sits at three points — Release PR validation, tag planning, and publication. A breaking commit on `main` does not merely delay its own release: release-please then computes `2.0.0` for every subsequent push, `release-pr-policy.ts` rejects that Release PR, and **no 1.x release can be cut either**. Paying a frozen release train to avoid keeping four small frozen objects is a bad exchange.

So the four symbols stay, exported from `src/agents/withdrawn` as frozen definitions. The module reuses the catalog's own `toAgentDefinition` and `catalogSourceSchema`, so a retained definition is normalized exactly like a catalog entry — it simply never joins the catalog. `toAgentDefinition` is newly exported from `src/agents/catalog.ts` but deliberately not re-exported from `src/agents/index.ts`, keeping it off the v1 root surface.

The retained objects are genuinely inert: `getAllAgents`, `getAgentByNameOrAlias`, and `getAgentByLookupName` never return them, and `test/agents.test.ts` asserts all three, plus that no retained object is identity-equal to a catalog entry.

Rejected alternative: keep the entries in the catalog behind a `hidden` or `unsupported` flag. That threads a new supported/unsupported distinction through listing, lookup, install routing, canary selection, and every consumer of `getAllAgents`, to model something the catalog already models by absence.

### The declaration pin moves, and the change proves it is not an API change

`test/fixtures/compatibility/v1/root-declaration.json` pins `dist/index.d.mts` by exact byte count and sha256. Declaring the four constants together in one module rather than interleaved among catalog agents moves them within the emitted file, so the pin changes from 49207 to 49262 bytes.

The emitted content for those symbols is identical. Both before and after, the declaration file contains exactly:

```
declare const deepcode: AgentDefinition;
declare const genie: AgentDefinition;
declare const jcode: AgentDefinition;
declare const vtcode: AgentDefinition;
```

and the terminal `export { ... }` list is character-for-character unchanged, including all four names. Only the line positions differ (65/69/72/84 becomes 625–628). The `compatibility-contract` delta records that a pin update of this kind must carry that evidence, so a future reader does not have to re-derive whether the API moved.

This is also why the retained module documents itself with `//` line comments rather than a JSDoc block: tsdown emits JSDoc into the declaration file, which would change the pinned bytes for a reason unrelated to the API.

### `forgecode` is removed outright

It is not in the v1 snapshot, so retaining it would invent a compatibility obligation that never existed. It is deleted with no residue.

### The `deno` provider outlives its only catalog consumer

`genie` is the sole `deno`-provider entry. Provider support is scoped to the provider, not to whether some agent currently uses it, so the implementation stays and its tests run on synthetic identifiers. Tying provider coverage to catalog membership would mean a future `deno`-based agent arrives to find the provider already rotted. `binary` has had zero catalog consumers all along, so this is an established state rather than a new one.

### State is preserved, not migrated

A user who installed `vtcode` through Quantex keeps their `installedAgents` record. Quantex reads unknown entries as untracked agents already, which is the correct reading — the install is real, Quantex simply no longer manages it. Deleting those records would destroy evidence of something still on disk.

## Risks / Trade-offs

- **Four exported definitions describe agents Quantex no longer supports.** A consumer could read `vtcode` from the package root and assume it is installable. Mitigated by the `compatibility-contract` requirement stating the symbol is frozen data, by the module's own comment, and by tests asserting the definitions are unreachable from lookup. The alternative — breaking those consumers — costs more.
- **The retained module is a small ongoing carrying cost.** It is bounded: no new entries join it except through a withdrawal, and the whole module retires with the v1 export window.
- **The root-declaration digest is build-dependent**, and per repository experience that contract fails only in CI. It is regenerated from a real `bun run build` here and must be re-verified after any rebase that touches exported types.
- **`jcode` is the largest project in the removal set by stars.** Its withdrawal is the one most likely to draw a "why is this gone" question. The requirement text records that the basis was Quantex scope, not upstream health.
