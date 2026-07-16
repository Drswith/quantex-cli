## 1. Graduation Contract

- [x] 1.1 Add focused Release PR policy tests for the exact `0.29.1 -> 1.1.0` transition, the final-0.x boundary, burned `1.0.0`, wrong-base/wrong-target near misses, and ordinary post-`1.1.0` SemVer progression.
- [x] 1.2 Add a stable release configuration regression proving the repository has left pre-major planning and does not persist a `release-as` override in workflow or manifest configuration.
- [x] 1.3 Add resolver and workflow regressions proving the graduation implementation subject is release-worthy and the generated exact `1.1.0` Release PR cannot enter automatic squash merge.

## 2. Policy and Documentation

- [x] 2.1 Update stable Release PR policy so later 0.x versions and every pre-major graduation except exact `0.29.1 -> 1.1.0` fail closed while post-`1.1.0` releases continue normally.
- [x] 2.2 End the stable `bump-minor-pre-major` mode and update canonical release guidance with the final `0.29.1` baseline, one-shot `Release-As: 1.1.0` trigger, generated Release PR boundary, and manual rebase-first merge requirement.
- [x] 2.3 Record an independently resumable implementation, publication, verification, and archive-closure plan without manually changing source-controlled version files.
- [x] 2.4 Make the exact `main@0.29.1 -> chore: release 1.1.0` generated PR skip release-bot auto-merge before a token or merge request is created, while leaving ordinary Release PR automation unchanged.

## 3. Validation and Release Delivery

- [x] 3.1 Run focused release/governance tests, the full test suite with bounded local workers, lint, format check, typecheck, OpenSpec validation, memory check, and diff check; confirm zero local Bun fixture processes remain.
- [x] 3.2 Obtain independent review, validate a template-based PR body, create one commit carrying `Release-As: 1.1.0`, push, and open a Ready implementation PR to `main` with auto-merge disabled.
- [x] 3.3 After every required check passes, manually rebase-merge the locked implementation head, verify the merged commit retained the exact footer, and require release-please to create exactly the generated `chore: release 1.1.0` PR.
- [x] 3.4 Validate the generated Release PR scope and checks, disable any bot-created auto-merge request, manually rebase-merge its locked head, then verify green main CI, GitHub Release/tag/assets, npm `quantex-cli@1.1.0`, and npm `latest=1.1.0`.

## 4. Archive Closure

- [x] 4.1 After publication succeeds, synchronize the accepted graduation delta into the current `release-workflow` spec and prepare the exact repo-native archive command, validated PR body, and protected-main delivery path. Completing this readiness task earns its task credit; actual archive execution and PR merge remain mandatory external closure actions.
- [x] 4.2 Prepare the exact post-merge checks proving the change is absent from active state, present under the dated archive, the working tree is clean, archive-only CI is green, and no additional release is published. Completing this readiness task earns its task credit; the prepared verification MUST run and be reported after the archive PR merges.
