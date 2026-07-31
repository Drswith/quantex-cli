## 1. Activation contract

- [x] 1.1 Record the independent Core identity, version policy, OIDC publisher, recovery tag, and CLI isolation contract.
- [x] 1.2 Validate OpenSpec artifacts.

## 2. Public package boundary

- [x] 2.1 Promote `quantex-core@0.1.0`, update root development resolution, source imports, TypeScript paths, package checks, and consumer fixtures.
- [x] 2.2 Update English and Simplified Chinese SDK documentation and the Core package README.

## 3. Independent release closure

- [x] 3.1 Add a manual `release-core.yml` with OIDC, immutable Core tags, exact npm inspection, Core-only validation, and idempotent publication.
- [x] 3.2 Add focused release-workflow and package-contract tests, including no CLI release coupling.
- [x] 3.3 Update the release runbook for Core dispatch and recovery.

## 4. Verification and delivery

- [ ] 4.1 Run lint, format check, typecheck, tests, OpenSpec validation, memory check, Core build, and Core package check.
- [ ] 4.2 Commit, push, and create the activation PR with validated body.
- [ ] 4.3 Merge after required checks, dispatch `Release Core`, and verify npm/package-tag closure.
