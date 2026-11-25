# Migrate OpenCode 1 to OpenCode 2

Quantex 2.0.0-beta.9 installs OpenCode 2 through every supported route:

| Provider | Platforms | Source |
| --- | --- | --- |
| npm | macOS, Linux, Windows | `@opencode/cli` |
| Bun | macOS, Linux, Windows | `@opencode/cli` |
| Official installer | macOS, Linux | `https://opencode.ai/v2/install` |

`opencode-ai` and `https://opencode.ai/install` still distribute OpenCode 1. Refreshing version metadata does not move an installation between these sources. Quantex reports an existing v1 install as `manual-required` during updates, including `update --all`; it does not perform a major-version migration in the background.

## Before migrating

Stop OpenCode sessions and keep a backup of your OpenCode configuration and session data, including custom XDG locations and project `.opencode/` directories. Review the [upstream migration guide](https://opencode.ai/docs/migrate-v1): supported v1 configuration can remain, but plugins and server API integrations need porting. OpenCode itself handles its data/config compatibility; Quantex does not rewrite or delete those files.

Inspect the recorded source:

```sh
qtx info opencode --json
```

## An npm or Bun install recorded by Quantex

`AGENT_PACKAGE_SUPERSEDED` identifies the old `opencode-ai` package. After upgrading Quantex to beta.9 or later, run these separately:

```sh
qtx uninstall opencode
qtx install opencode
```

The first command removes the old package using its recorded package manager. The second installs v2 using your current `defaultPackageManager` preference. To keep npm or Bun, set `qtx config set defaultPackageManager npm` or `bun` before installing; this is a global preference for future installations. Quantex allows the selected package's required installation scripts, including Bun's trust step.

Do not only overwrite the binary or edit `state.json`: the package manager must confirm the new package and Quantex must record `@opencode/cli`. If installation fails after removal, preserve the logs and retry installation after correcting the cause; the user data remains in place.

## An official-script install recorded by Quantex

`AGENT_MAJOR_UPGRADE_REQUIRED` identifies a script-installed 1.x executable. Run the v2 installer explicitly:

```sh
curl -fsSL https://opencode.ai/v2/install | bash
```

The official installer replaces `~/.opencode/bin/opencode`. Keep the existing Quantex record: after the executable reports 2.x, `qtx update opencode` resumes the agent's normal `opencode upgrade` path. Uninstalling and reinstalling through Quantex alone does not replace a script install: uninstall keeps its files and install adopts the existing executable.

## Verify

```sh
opencode --version
qtx info opencode --json
qtx update opencode --refresh
```

Confirm that the executable is 2.x, the intended install source is recorded, and no migration warning remains. Check models, credentials, agents, permissions, MCP servers, plugins, and existing sessions in OpenCode. Do not run v1 against configuration converted to v2-only syntax.
