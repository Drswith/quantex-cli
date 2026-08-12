## Why

The full real-agent canary was stabilized by marking Claude cleanup and four runnable agents as skipped, which made the workflow green without completing the lifecycle evidence the full scope is meant to provide. Follow-up review and isolated installer checks show that Goose, Junie, and Vibe have credential-free automation paths, while Devin can expose a verified binary lifecycle separately from account setup.

## What Changes

- Remove the reviewed pre-install and cleanup skip tables from the full canary matrix; a selected provider that cannot run now fails its advisory job instead of being reported as a pass or hidden behind an agent-level skip.
- Run Goose with its official non-interactive configuration switch, remove Junie's misleading Bun/npm managed candidates in favor of its official script installer, and route Vibe through a production-selectable uv preference.
- Exercise Devin as an explicitly labelled binary-lifecycle canary: the official installer acquires the verified binary, Quantex adopts and probes it, and account authentication remains a separately reported credentialed setup boundary.
- Disable Claude update and migration paths during the single-source lifecycle probe, require a clean Bun uninstall, and add a deliberate second-source conflict probe that must produce the typed `conflicting-source` result before final cleanup.
- Reconcile Bun's stale global-bin symlink only when Quantex proves that the unchanged link was declared by the removed package and points into that package or one of its declared dependencies.
- Retain Autohand's official script installer while adding its official npm package as a managed alternative, so the full canary can verify a deterministic package-owned lifecycle when a mutable native release asset fails its own startup probe.
- Add `uv` as a supported `defaultPackageManager` preference in both configuration validation and Core method ordering, and document the expanded configuration surface.
- Strengthen catalog probe metadata so the selected Goose, Junie, and Devin routes must expose version evidence in `inspect` and `list`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-canary-validation`: Replace agent-level skips with explicit runnable coverage modes, non-interactive installer preparation, clean Claude teardown, and a deliberate source-conflict oracle.
- `agent-uninstall`: Remove a Bun-owned global-bin symlink left behind after conclusive package removal while preserving changed, regular-file, and unproven alternate-source paths.
- `agent-catalog`: Require installed-version evidence for the credential-free script routes selected for Goose, Junie, and Devin canaries, and stop claiming that Junie's package wrappers provide a managed uninstall boundary.
- `config-surface`: Allow users and the canary to select uv as the preferred managed installer when an agent exposes a uv candidate.
- `product-readme`: Document uv as a supported `defaultPackageManager` value without implying that Quantex installs uv automatically.

## Impact

The change affects the advisory agent-canary workflow, its matrix and lifecycle smoke policy, selected catalog probe metadata, configuration validation, bilingual README guidance, deterministic tests, and the real full-scope GitHub runner validation. It does not add agent credentials, make the canary a required merge gate, or claim that Devin account authentication passed when only its binary lifecycle was exercised.
