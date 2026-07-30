## Context

Installed agent state can record `packageInstallArgs`. Lifecycle receipts intentionally omit those arguments and only carry provider identity plus executable metadata. After install, observation currently prefers `receiptBinding ?? stateBinding`, so the binding used for managed update loses recorded arguments even when state and receipt agree on provider identity.

## Goals / Non-Goals

**Goals:**

- Preserve recorded install arguments on the observation binding used by update planning and execution when state and receipt identities agree.
- Keep the fix local to provider-binding composition / observation.
- Cover Cargo, uv, and Deno argument preservation with regression tests.

**Non-Goals:**

- Expanding lifecycle receipt schema to store arguments.
- Changing providerAdapters or package-manager command construction beyond receiving the corrected binding.
- Changing uninstall, ensure, or install selection unrelated to this observation merge.

## Decisions

1. **Merge at persisted-binding resolution, not at receipt schema.**  
   Receipts remain argument-free. When state and receipt bindings are identity-equal, compose a persisted binding that keeps receipt executable metadata and overlays state `target.arguments`.

2. **Keep `providerBindingsEqual` argument-agnostic.**  
   Identity conflict detection must not treat missing receipt arguments as a conflicting source. Argument overlay happens only after identity agreement.

3. **Prefer a shared helper over inlining in observation.**  
   Add `resolvePersistedProviderBinding(stateBinding, receiptBinding, defaultExecutableName?)` next to the existing resolvers so observation and tests share one composition rule.

## Risks / Trade-offs

- **[Risk] State arguments diverge from what the live package was last installed with** → Mitigation: installed state remains the recorded source of truth per existing agent-update requirements; this fix restores that contract rather than inventing catalog defaults.
- **[Risk] Future receipt schema adds arguments** → Mitigation: merge can later prefer receipt arguments when present; out of scope now.
