## Context

PR #621 converted the failing full catalog sweep into a stable advisory workflow, but it did so by adding pre-install skip reasons for Devin, Goose, Junie, and Vibe plus a cleanup-stage exception for Claude. Current upstream installers expose better credential-free paths: Goose supports `CONFIGURE=false`, Junie has an official non-interactive script, Vibe is distributed as a uv tool, and Devin installs a versioned binary before entering account setup. Claude is different: the canary must suppress update or migration side effects when testing a Bun-owned install, while Quantex's multi-source protection deserves a separate deliberate conflict oracle.

The workflow runs on fresh GitHub-hosted Linux runners. Local real-installer investigation is restricted to disposable Docker containers; local proxy throughput is not treated as upstream-agent evidence. The canary remains advisory because registries and installers are external dependencies.

## Goals / Non-Goals

**Goals:**

- Make every full-matrix agent job execute a named lifecycle coverage mode instead of returning before installation.
- Require clean provider-owned teardown for Claude's ordinary lifecycle and independently verify the typed multi-source conflict behavior.
- Exercise Goose, Junie, and Vibe through current credential-free upstream-supported routes.
- Exercise Devin binary acquisition, Quantex adoption, inspection, listing, version probing, and untracking while stating that account authentication is deferred.
- Make the Vibe uv route selectable by the same public configuration used in production.

**Non-Goals:**

- Supplying or inventing third-party account credentials.
- Claiming Devin account setup or an authenticated agent request passed in a credential-free job.
- Testing every provider for every catalog agent in one sweep.
- Turning the canary workflow into a general workflow orchestrator or required merge gate.

## Decisions

### Replace skip metadata with explicit coverage metadata

Matrix entries will carry a coverage mode, installer setup mode, update-isolation flag, and optional source-conflict probe flag. The probe will no longer accept an agent-level unsupported reason or cleanup exception. Provider unavailability and unexpected installer failures will fail that advisory job.

Alternative considered: retain skips but add clearer summaries. Rejected because the full sweep would still be green without lifecycle evidence for runnable agents.

### Use reviewed supported routes rather than forcing one provider shape

The selector will prefer production-selectable Bun, npm, and uv candidates. Junie's Bun/npm package is only a bootstrap wrapper: its postinstall downloads a distinct native version, writes the durable shim under `~/.local/bin`, and package removal leaves that external installation behind. The catalog will therefore stop advertising those wrappers as managed sources and retain the official script as the credential-free Linux route. Goose will retain its official script with interactive configuration disabled. Vibe will select uv after uv becomes a supported `defaultPackageManager` value in the Core ordering path as well as config validation.

Alternative considered: weaken provider-source verification for Junie's external shim or keep the wrapper and call package removal a successful uninstall. Rejected because both would misstate ownership: the wrapper's removal does not remove the runnable Junie installation. The official script route exposes the honest install/inspect/list/version/untrack boundary.

### Model Devin as binary lifecycle plus deferred account setup

The workflow will run the official installer in a bounded non-interactive step, require the installed `~/.local/bin/devin` executable and a successful `devin version`, then let Quantex adopt the single supported script source. The final `devin setup` portion may exit or wait for authentication; its status is not treated as installer completion. The job and summary will label account setup as deferred while still requiring install/inspect/list/version evidence for the binary lifecycle.

Alternative considered: delete the final installer line or reproduce the manifest downloader in repository code. Rejected because both fork upstream installer behavior. A future credentialed canary can extend the account-setup layer when a test identity and secret lifecycle exist.

### Split Claude clean ownership from conflict detection

The normal Claude job will set both current update-disable environment variables, construct a canary PATH that contains only the disposable tool roots plus system utilities, assert that no Claude executable is present, install through Bun, require version evidence, uninstall through Bun, and assert that Claude is absent. The same full job will then reinstall Claude, add a controlled fallback executable after the Bun path, require uninstall to return the exact `UNINSTALL_FAILED` plus `conflicting-source` outcome, remove the fixture, and finish cleanup. No part of either scenario is recorded as skipped. The PATH boundary excludes an unrelated Claude executable preinstalled on the hosted runner; it does not suppress any lifecycle step.

Alternative considered: accept the observed second executable as a cleanup exception. Rejected because it leaves the single-source cleanup postcondition unverified and conflates an upstream side effect with the intentional multi-source contract.

### Reconcile only a proven stale Bun global-bin link

Bun 1.3.14 can remove the top-level Claude package while retaining its platform optional dependencies and the original global-bin symlink to that dependency. Before Bun removal, Quantex will capture a link only when the target package manifest declares the requested binary, the path is a symbolic link inside Bun's reported global bin directory, and the link target belongs to that package or a declared runtime dependency. After Bun reports success and its package probe reports the top-level package absent, Quantex will unlink only if the same device, inode, and link target remain. The dependency payload is not recursively deleted because another package may still reference it.

Alternative considered: delete whichever `claude` is still found after uninstall. Rejected because it would erase a real alternate source and defeat the `conflicting-source` safety contract. Switching the canary to npm was also rejected because it would stop validating the Bun lifecycle that exposed the product defect.

### Treat uv as a public managed-installer preference

`defaultPackageManager` will accept `uv`, and both legacy and Core install-method ordering will place an existing uv catalog candidate ahead of other methods without installing uv automatically. The workflow will provision uv explicitly and add the disposable local bin directory to PATH before running the probe.

Alternative considered: add a canary-only hidden uv reorder. Rejected because it would validate a route users cannot select through the production configuration surface.

## Risks / Trade-offs

- [Upstream installer flags or paths drift] -> Keep routes visible in the catalog-driven matrix and let the advisory job fail with the upstream output instead of falling back to a skip.
- [Devin installer creates a binary and later fails for a reason unrelated to authentication] -> Require a successful direct version command and all Quantex semantic assertions, and label only account setup as deferred rather than claiming installer completion.
- [Junie script installations cannot be physically uninstalled by Quantex] -> Require Quantex untracking and rely on destruction of the dedicated runner for files owned by the install-only provider; do not retain Bun/npm candidates whose removal leaves the same files behind.
- [Claude update-disable variables change upstream] -> The clean lifecycle fails, exposing the drift; the workflow does not restore a cleanup exception automatically.
- [Bun changes its global-link layout] -> Ownership capture fails closed and the existing postcondition reports the remaining executable; Quantex never deletes a regular file or a changed/unproven link.
- [Local Docker architecture or proxy differs from GitHub Linux] -> Use Docker only for safe local investigation and make the dispatched GitHub full sweep the acceptance evidence.

## Migration Plan

1. Add the OpenSpec deltas and deterministic matrix, workflow, configuration, and smoke-policy tests.
2. Remove skip fields and add the new coverage/setup metadata.
3. Update catalog probes and uv configuration/documentation.
4. Run repository validation and Docker-confined focused investigation.
5. Push the branch, dispatch the full GitHub canary, and correct any runner-specific failures without weakening the semantic assertions.
6. Roll back by reverting the follow-up PR; do not reintroduce silent skips as an automatic fallback.

## Open Questions

- A credentialed Devin account-setup canary remains contingent on an approved disposable test identity and secret-rotation policy; it is not blocking binary-lifecycle automation.
