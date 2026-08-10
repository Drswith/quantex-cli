## 1. Shared executable resolution

- [x] 1.1 Add a shared resolution module exposing the pure known-install-directory computation and the `PATH`-first resolver.
- [x] 1.2 Delegate `isBinaryInPath` and `getBinaryPath` to the shared resolver without changing their exported names or signatures.
- [x] 1.3 Route the Core provider observation executable adapter and the production Core read observation through the same directory computation.
- [x] 1.4 Add focused coverage for `PATH` precedence, known-directory fallback, absence, non-executable files, and the pure directory list across platforms.

## 2. Resolved-path execution and probing

- [x] 2.1 Launch agents through the resolved executable path when the observation carries one.
- [x] 2.2 Probe installed versions through the resolved path while preserving custom probe commands.
- [x] 2.3 Add regression coverage for launching and version probing an agent that resolves outside `PATH`.

## 3. Canary probe alignment

- [x] 3.1 Assert the lifecycle classification implied by the matrix entry's provider instead of requiring `managed`.
- [x] 3.2 Pass the selected provider through to the probe so the expected classification is derivable.

## 4. Validation and closure

- [x] 4.1 Run lint, format check, typecheck, and test.
- [x] 4.2 Run OpenSpec validation.
- [ ] 4.3 Report validation, OpenSpec, git, commit, push, PR, release, and archive-closure status.
