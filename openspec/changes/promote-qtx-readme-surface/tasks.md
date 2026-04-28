## 1. Product Surface Updates

- [x] 1.1 Update `README.md` to recommend `qtx` in onboarding paths while keeping `quantex` visibly equivalent.
- [x] 1.2 Add a read-only no-install try-it-out section to `README.md` with validated command forms and runtime caveats.
- [x] 1.3 Mirror the same entry-point and no-install guidance in `README.en.md`.

## 2. Agent Surface Alignment

- [x] 2.1 Update `skills/quantex-cli/SKILL.md` so the agent-facing guidance acknowledges the preferred `qtx` entry point without weakening the explicit automation recommendations.
- [x] 2.2 Sync `openspec/specs/product-readme/spec.md` with the accepted README contract changes.

## 3. Validation

- [x] 3.1 Run `bun run lint` and `bun run typecheck`.
- [x] 3.2 Run `bun run openspec:validate`.

## 4. Delivery Closure

- [ ] 4.1 Commit the README change set with linked issue/OpenSpec context.
- [ ] 4.2 Push the branch and open a PR linked to Issue #75 and the OpenSpec change.
- [ ] 4.3 Comment on Discussion #69 with the issue/PR/follow-up links and close it once the implementation handoff is durable.
