## 1. Freeze the compatibility boundary

- [x] 1.1 Extend installation-routing coverage for exact legacy override handling, dry-run precedence, and selected-engine containment.
- [x] 1.2 Keep the promoted Core route explicitly limited to `install` and `ensure` without changing the legacy implementations.

## 2. Document and rehearse rollback

- [x] 2.1 Add a focused operator runbook for the per-invocation legacy rollback rehearsal and return to Core default.
- [x] 2.2 Update English and Simplified Chinese README guidance for the 1.5 soak, frozen legacy route, and later-major removal gate.

## 3. Validate and deliver

- [x] 3.1 Run routing-focused tests, lint, format check, typecheck, full tests, OpenSpec validation, and memory validation.
- [ ] 3.2 Commit, push, and open the implementation PR with a validated repository template body; report merge, archive, and release ownership separately.
