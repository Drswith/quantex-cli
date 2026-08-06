## Why

Windows `install.ps1` downloads the release binary with `Invoke-WebRequest -OutFile` directly onto the live `quantex.exe` path. A mid-download network failure, process interrupt, or HTTP error after the destination file is opened can leave a truncated or corrupt live binary while the script exits. POSIX `install.sh` already stages into a temp file and only moves into place after a successful download, so Windows reinstall/upgrade through the documented installer is strictly less safe.

## What Changes

- Stage the Windows standalone download into a temporary file under a disposable directory.
- Replace `quantex.exe` only after the staged download exists and is non-empty.
- Copy the peer `qtx.exe` alias from the successfully replaced `quantex.exe`.
- Clean up the temporary directory on success or failure.
- Add a static regression test that asserts `install.ps1` no longer writes the network response directly to the live executable path.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `self-upgrade`: Windows standalone installer (`install.ps1`) MUST stage downloads before replacing live entry-point binaries.

## Impact

- `install.ps1` download/replace sequencing
- Static regression coverage under `test/`
- OpenSpec change `fix-windows-install-ps1-staged-download`
- Does not change README install commands, checksum verification, or Windows deferred self-upgrade replacement

## Work-intake classification

Observable install / upgrade path behavior for the documented Windows standalone installer → OpenSpec required before implementation.
