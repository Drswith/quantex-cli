## 1. Workflow

- [x] 1.1 Add release relevance detection to `.github/workflows/release.yml`.
- [x] 1.2 Gate release bot token creation and release-please execution on that relevance result.
- [x] 1.3 Keep release artifact, publish, and upload steps gated on `release_created`.

## 2. Validation And Delivery

- [x] 2.1 Run OpenSpec validation.
- [x] 2.2 Run project memory, lint, typecheck, and test checks.
- [x] 2.3 Record that delivery reports must state merge, release, and archive closure state explicitly.
