## Context

The release candidate pipeline already builds compressed standalone archives, generates `manifest.json` and `SHA256SUMS.txt`, smoke-tests the current runner's archive, and verifies the uploaded GitHub Release assets. Those checks use the repository's release-artifact constants. The documented installers independently derive their archive names, so a constant or archive migration can leave the release pipeline green while a user-facing installer returns a 404.

The installer check must therefore use the public download URLs of the exact release being published. It must cover the hosted Linux, macOS, and Windows environments, avoid touching a runner's normal user installation, and leave an actionable release status when a platform-specific check fails.

## Goals / Non-Goals

**Goals:**

- Exercise the versioned `install.sh` and `install.ps1` files end to end against the exact public GitHub Release.
- Cover Linux and macOS with `install.sh`, and Windows with `install.ps1`.
- Verify the installed executable and its documented alias, including that the executable reports the expected release version.
- Make the overall release workflow fail when any installer leg fails and identify the failing installer and runner.
- Define a retry and remediation policy that does not move or delete an immutable published release.

**Non-Goals:**

- Changing either installer, the release asset matrix, archive formats, or native Windows ARM64 support.
- Replacing the existing local release-artifact smoke test or static installer tests.
- Testing arbitrary developer operating systems or third-party runner images beyond the hosted matrix.
- Adding a new repository-local workflow wrapper or runtime dependency.

## Decisions

### 1. Use a post-publish matrix job in `release.yml`

The installer URLs intentionally target the public release download endpoint, so the check cannot run before the GitHub Release is made non-draft. A job that depends on the existing publish job keeps the check attached to the same release workflow and makes its result visible as part of release closure. A separate `release: published` workflow would be asynchronous and would not make the publication workflow itself fail; the existing local `release:smoke` command cannot exercise public URLs at all.

The matrix runs with `fail-fast: false` so Linux, macOS, and Windows report independently when more than one platform is broken.

### 2. Pin both the installer source and download target to the immutable tag

Each matrix leg checks out the exact `v<version>` tag and sets `QUANTEX_REPO` and `QUANTEX_VERSION` to the same release identity. This verifies the installer that belongs to the release rather than `main` or whichever version is currently `latest`, and it makes a rerun deterministic.

### 3. Use native runner shells and scratch paths

The POSIX legs invoke `bash ./install.sh`; the Windows leg invokes `pwsh -File ./install.ps1`. No Bun setup or new dependency is needed for the installer check. `QUANTEX_INSTALL_DIR` points into `runner.temp`, and all post-install assertions use that path. The smoke commands run both the primary executable and the `qtx` alias and require the expected version in their output.

### 4. Treat failure as a post-publish gate, not a rollback trigger

The GitHub Release, tag, and npm publication remain intact if the matrix fails: deleting or moving an immutable release after users may have downloaded it is not a safe recovery mechanism. The workflow is nevertheless failed and the error names the installer and runner. Maintainers must inspect whether the failure is transient or a real compatibility defect, fix the source, and rerun `release.yml` at the same tag when the public assets are still valid. A real asset or installer mismatch requires normal corrective release work; it must not be hidden by retagging the existing version.

### 5. Keep static regression coverage beside release workflow tests

The workflow test will assert that the job depends on the public-release closure, covers all three hosted runner families, pins the repository and tag, uses a scratch directory, and invokes both installer files. This protects the contract without pretending that a Linux unit-test process can emulate macOS or Windows hosted runners.

## Risks / Trade-offs

- **[Public release is visible before the final check]** → Keep the post-publish failure policy explicit, fail the overall workflow, preserve the immutable release, and support a same-tag rerun after remediation.
- **[Hosted-runner networking or GitHub CDN transiently fails]** → Run all matrix legs independently, include the installer and runner in the error, and rerun the same tag before changing release content.
- **[Hosted macOS architecture changes]** → Use the standard `macos-latest` image and let the real installer resolve the platform architecture; the existing release matrix and installer failure message remain the source of evidence if no matching asset exists.
- **[The checked-out script and public assets drift in a future workflow change]** → Pin checkout to the release tag and keep the workflow wiring under regression tests; any drift is surfaced as a failed installer leg.

## Migration Plan

1. Merge the workflow, regression test, runbook, and OpenSpec change.
2. The next tag-triggered `release.yml` run will publish as before and then execute the three installer legs.
3. If a leg fails, preserve the tag and public release, inspect the named installer failure, and rerun the same release workflow only after deciding whether the failure was transient or needs a corrective change.
4. After the implementation is merged and accepted, sync the delta into `openspec/specs/release-workflow/spec.md` through the normal archive-closure flow.

## Open Questions

None. The required failure policy is the explicit post-publish, fail-the-workflow, no-retag policy above.
