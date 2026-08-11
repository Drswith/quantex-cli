## 1. Deterministic canary selection

- [x] 1.1 Implement the catalog-driven quick/full matrix resolver with provider and version-probe metadata.
- [x] 1.2 Add the matrix resolver package entry point and deterministic Vitest coverage, including missing-anchor and invalid-scope failures.

## 2. Smoke and observation contracts

- [x] 2.1 Add the focused lifecycle-smoke `probe` scenario with installed-version assertions, list/inspect refreshes, and failure cleanup.
- [x] 2.2 Add stdout-preferred/stderr-fallback version parsing to the legacy and Core observation paths.
- [x] 2.3 Add regression tests for stderr-only version output, stdout precedence, and non-zero probe exits.

## 3. CI and repository routing

- [x] 3.1 Add the advisory GitHub-hosted agent canary workflow with quick pull-request and full schedule/manual matrix scopes.
- [x] 3.2 Update path taxonomy and workflow tests so canary changes are classified and the workflow contract is executable.

## 4. Documentation and validation

- [x] 4.1 Update the isolation runbook and contributor guidance to distinguish quick real canaries, full scheduled sweeps, and Modal/Docker transport checks.
- [x] 4.2 Run lint, format check, typecheck, test, OpenSpec validation, and memory validation; record any external-runner limitations.
- [x] 4.3 Mark completed tasks and report local, repository, PR, release, and archive-closure status.

## 5. Full-scope failure repair

- [x] 5.1 Compare the scheduled run `31244555662` with manual full run `31449277089` and classify every stable failure by provider capability, installer precondition, toolchain, or semantic assertion.
- [x] 5.2 Amend the canary contract so provider selection, explicit runner incompatibilities, failure cleanup, and install-only cleanup are represented honestly.
- [x] 5.3 Make full-scope provider selection prefer CI-ready managed candidates while retaining every Linux catalog agent and explicit skip reasons in the matrix.
- [x] 5.4 Provision selected uv and Deno toolchains and allow the canary to use the current compatible Bun release without changing the repository build/release pin.
- [x] 5.5 Make the probe select the matrix provider, preserve failed installs for outer cleanup, and assert physical removal only when the provider supports uninstall.
- [x] 5.6 Add deterministic matrix, smoke-policy, workflow, and regression coverage for the repaired behavior.
- [x] 5.7 Update the isolation runbook with pass/fail/skip and provider-capability semantics.

## 6. Follow-up validation and delivery

- [x] 6.1 Run focused tests, lint, format check, typecheck, the full test suite, OpenSpec validation, and memory validation.
- [ ] 6.2 Push the repair branch and dispatch a full canary run against the branch; triage any remaining failures without weakening semantic assertions.
- [ ] 6.3 Deliver the repair through PR and report validation, merge, release, and archive-closure states separately.
