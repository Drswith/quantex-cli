## 1. Untracked update source selection

- [x] 1.1 Pass resolved binary path into agent-update context and prefer path-inferred managed installer type when state is missing
- [x] 1.2 Fail closed for untracked agents with multiple managed methods and no identifiable path; keep single-method managed inference
- [x] 1.3 Add provider/planning regression coverage for npm-path preference and ambiguous multi-managed self-update fallthrough

## 2. Absent-package managed update guard

- [x] 2.1 Fail managed update/updateMany entry points when presence probing reports the target package absent
- [x] 2.2 Add Bun/npm package-manager regression tests for absent-package update refusal
