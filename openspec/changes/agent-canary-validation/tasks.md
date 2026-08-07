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
