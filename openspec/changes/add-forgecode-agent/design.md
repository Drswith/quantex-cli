# Design: add-forgecode-agent

## Approach

Add ForgeCode as a new agent definition following the established pattern used by other agents (Crush, Kimi, Qwen, etc.).

## Key decisions

1. **Canonical name `forgecode`**: The npm package is `forgecode` and the product is called ForgeCode. Using `forgecode` as canonical name avoids collision with the generic `forge` binary name and matches user expectations (`quantex install forgecode`).

2. **Alias `forge`**: The installed binary is `forge`, so adding it as a lookup alias lets users run `quantex forge` or look it up by binary name.

3. **Install methods**: ForgeCode supports npm (`forgecode` package) and an official curl/PowerShell install script. No Homebrew or winget methods are documented yet. The script installs are placed last as fallback options.

4. **Self-update**: `forge update` is the documented self-update command.

5. **No Windows winget**: No winget package is documented for ForgeCode yet.
