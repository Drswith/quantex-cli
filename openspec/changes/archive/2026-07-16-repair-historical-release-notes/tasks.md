## 1. Historical documentation repair

- [x] 1.1 Add the post-`v0.29.0` lifecycle-refactor and compatibility summaries to the existing `v0.29.1` and `v1.1.0` changelog sections while preserving generated entries.
- [x] 1.2 Update the published GitHub Release bodies for `v0.29.1` and `v1.1.0` with matching curated summaries, without changing tags or packages.

## 2. Validation and delivery

- [x] 2.1 Run OpenSpec and repository documentation validation, inspect the diff, and confirm the change remains non-release-worthy.
- [x] 2.2 Commit, push, and open a validated docs PR after the published GitHub Release bodies are corrected.
- [x] 2.3 After the implementation PR merges, verify the repository changelog and GitHub Release bodies remain aligned and prepare the agent-driven archive closure.
