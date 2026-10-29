# Troubleshooting Quantex

Start with what Quantex observes, then act on the recorded source rather than around it:

```bash
quantex doctor --json
quantex info <agent> --json
quantex resolve <agent> --json
```

`doctor --json` lists `data.issues[]`, each with a `code`, a `suggestedAction`, `suggestedCommands`, and a `docsRef` pointing here or to [release-and-self-upgrade-debugging.md](release-and-self-upgrade-debugging.md). Prefer those fields over the human text.

## `doctor` issues

### `NO_MANAGED_INSTALLER`

Neither npm nor Bun is on `PATH`, so agents that are installed only through a package manager cannot be installed or updated. Agents with an official install script still work. Install Node.js (for npm) or Bun, then check `quantex doctor --json`, where `data.installers` reports each one.

### `AGENT_UNTRACKED_IN_PATH`

An agent is on disk but Quantex has no record of installing it, so `update --all` and `uninstall` leave it alone. `quantex info <agent> --json` shows the executable and what Quantex could tell about its source. To let Quantex manage it, run `quantex install <agent>`: when the executable sits where exactly one catalog method installs it (for example Bun's global bin), Quantex records that source without reinstalling; otherwise it reports `UNTRACKED_EXISTING_INSTALL` and leaves the install unmanaged. Remove the copy through whatever installed it, then `quantex install <agent>`, to bring it under Quantex.

### `AGENT_MANUAL_UPDATE_REQUIRED`

The agent's recorded source cannot be updated by Quantex (for example an install script without a self-update command). Follow `suggestedCommands`, or check the agent's homepage for its update path.

## Command failures

### `AGENT_NOT_INSTALLED` with `AGENT_STALE_STATE`

Quantex has a record for an agent whose executable is gone. Reconcile the record:

```bash
quantex uninstall <agent>
```

Then install again if you still want the agent.

### `INSTALL_FAILED`

`error.details.lifecycle` says which phase failed:

- `provider-unavailable`: none of the agent's installers is available; see `NO_MANAGED_INSTALLER`.
- `decision-indeterminate`: live and recorded evidence disagree, or a provider could not answer. `quantex info <agent> --json` shows the conflict; `error.details.reason` says what was inconclusive.
- `verification-failed`: the installer exited successfully but the agent is not where it should be. Quantex removed what it added where the package manager allows it. Check the installer output on stderr.
- `state-write-failed`: the install is in place, but `~/.quantex/state.json` could not be written. Fix the permission problem and run `quantex install <agent>` again. When the executable's location identifies its source, Quantex records the existing install without reinstalling; otherwise it is reported as `UNTRACKED_EXISTING_INSTALL` (see `AGENT_UNTRACKED_IN_PATH`).

### `UPDATE_FAILED`

Each `data.results[]` entry has its own `status` and `message`. A `failed` entry for an update that ran but did not reach the target version keeps the previous version recorded. `manual-required` entries are not failures: the source is untracked, superseded (see below), or cannot be updated automatically.

### `AGENT_PACKAGE_SUPERSEDED`

The agent was installed from a package its publisher has renamed or stopped publishing, so Quantex cannot compare versions across the rename. Move to the current package:

```bash
quantex uninstall <agent>
quantex install <agent>
```

### `UNINSTALL_UNMANAGED`

Quantex only removes installs it recorded. Remove the agent through whatever installed it.

### `RESOURCE_LOCKED`

Another Quantex process holds the agent lifecycle lock (`~/.quantex/locks/agent-lifecycle.lock`) or the state lock. Wait for it to finish. A lock whose owner process has exited is reclaimed automatically on the next run.

### `STATE_READ_ERROR`

`~/.quantex/state.json` is not valid. Quantex never overwrites a file it cannot read. Fix or move the file aside; a new one is created on the next change.

### `TIMEOUT` and `NETWORK_ERROR`

`--timeout` bounds the whole command, including version lookups and installer runs. Version lookups use `networkTimeoutMs` from `quantex config`, retry twice, and fall back to the cache when the network fails. Use `--refresh` to revalidate the cache or `--no-cache` to bypass it when a version looks stale.

### `INTERACTION_REQUIRED`

A prompt was needed but `--non-interactive` was set, or there was no terminal. Pass `--yes` to accept, or use `quantex exec <agent> --install if-missing -- ...` to state the install policy explicitly.
