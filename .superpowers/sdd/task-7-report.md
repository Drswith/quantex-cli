# Task 7 Report: Represent Script And Binary Effects

## Result

OpenSpec `4.7` is complete. Script and standalone-binary candidates now have closed first-party provider identities and typed targets can carry either an explicit shell-script effect or a direct executable argv effect. No dynamic registration or loading surface was added.

The maintained unmanaged install path projects existing string commands into shell-script effects and projects typed success back to the existing boolean workflow. Unix continues to use `sh -c`; Windows continues to use `powershell.exe -Command`. Direct executable effects bypass the shell.

## TDD evidence

- Red: effect tests failed until the install-effect adapter and typed effect model existed.
- Green: tests prove platform-specific shell projection, direct argv execution, typed missing-effect failure, and absence of update/uninstall operations.
- Package-manager compatibility proves legacy script installation retains its command and installed-state identity.

## Validation

- Focused provider/registry/package-manager suite: 3 files / 70 tests passed.
- Full suite: 75 files / 865 tests passed.
- lint: 0 warnings / 0 errors.
- format check, typecheck, OpenSpec 16/16, and memory check passed.

## Scope retained

- Existing catalog JSON remains unchanged; normalized candidate migration occurs in later catalog tasks.
- Script/binary observation remains typed `indeterminate` until candidates declare probes.
- Script/binary update and uninstall remain unsupported.
- Capability-table and update-bucket derivation remain OpenSpec `4.8`.
