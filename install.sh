#!/usr/bin/env sh

set -eu

REPO="${QUANTEX_REPO:-Drswith/quantex-cli}"
INSTALL_DIR="${QUANTEX_INSTALL_DIR:-$HOME/.local/bin}"
VERSION="${QUANTEX_VERSION:-latest}"

uname_os="$(uname -s)"
uname_arch="$(uname -m)"

case "$uname_os" in
  Darwin) platform="darwin" ;;
  Linux) platform="linux" ;;
  *)
    echo "Unsupported operating system: $uname_os" >&2
    exit 1
    ;;
esac

case "$uname_arch" in
  x86_64|amd64) arch="x64" ;;
  arm64|aarch64) arch="arm64" ;;
  *)
    echo "Unsupported architecture: $uname_arch" >&2
    exit 1
    ;;
esac

# Releases publish compressed archives; the archive entry is the binary name.
binary="quantex-$platform-$arch"
asset="$binary.tar.gz"

if [ -n "${QUANTEX_DOWNLOAD_BASE:-}" ]; then
  # Release CI candidate smoke serves local artifact bytes; strip a trailing slash
  # so "$release_url/$asset" joins cleanly.
  release_url="${QUANTEX_DOWNLOAD_BASE%/}"
elif [ "$VERSION" = "latest" ]; then
  release_url="https://github.com/$REPO/releases/latest/download"
else
  release_url="https://github.com/$REPO/releases/download/$VERSION"
fi

# Resolve every required tool before downloading, so a missing one fails with its
# own message instead of surfacing as an empty checksum or an extraction error.
if command -v curl >/dev/null 2>&1; then
  downloader="curl"
elif command -v wget >/dev/null 2>&1; then
  downloader="wget"
else
  echo "curl or wget is required to install quantex-cli" >&2
  exit 1
fi

if command -v sha256sum >/dev/null 2>&1; then
  sha256_tool="sha256sum"
elif command -v shasum >/dev/null 2>&1; then
  sha256_tool="shasum"
elif command -v openssl >/dev/null 2>&1; then
  sha256_tool="openssl"
else
  echo "sha256sum, shasum, or openssl is required to verify the quantex-cli download" >&2
  exit 1
fi

if ! command -v tar >/dev/null 2>&1; then
  echo "tar is required to extract the quantex-cli release archive" >&2
  exit 1
fi

download() {
  case "$downloader" in
    curl) curl -fsSL "$1" -o "$2" ;;
    wget) wget -qO "$2" "$1" ;;
  esac
}

file_sha256() {
  case "$sha256_tool" in
    sha256sum) sha256sum "$1" | awk '{ print $1 }' ;;
    shasum) shasum -a 256 "$1" | awk '{ print $1 }' ;;
    openssl) openssl dgst -sha256 "$1" | awk '{ print $NF }' ;;
  esac
}

mkdir -p "$INSTALL_DIR"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT INT TERM

tmp_archive="$tmp_dir/$asset"
tmp_checksums="$tmp_dir/SHA256SUMS.txt"
state_dir="$HOME/.quantex"
state_file="$state_dir/state.json"

download "$release_url/$asset" "$tmp_archive"
download "$release_url/SHA256SUMS.txt" "$tmp_checksums"

# SHA256SUMS.txt lists archive names; a leading "*" marks binary mode.
expected_checksum="$(awk -v name="$asset" '{ sub(/^\*/, "", $2); if ($2 == name) print $1 }' "$tmp_checksums")"
if [ -z "$expected_checksum" ]; then
  echo "SHA256SUMS.txt does not list $asset" >&2
  exit 1
fi

actual_checksum="$(file_sha256 "$tmp_archive")"
if [ "$actual_checksum" != "$expected_checksum" ]; then
  echo "Checksum mismatch for $asset" >&2
  echo "  expected $expected_checksum" >&2
  echo "  actual   $actual_checksum" >&2
  echo "Re-run the installer; a release published mid-download can cause this." >&2
  exit 1
fi

# Naming the member keeps extraction limited to the expected executable entry.
tar -xzf "$tmp_archive" -C "$tmp_dir" "$binary"

if [ ! -f "$tmp_dir/$binary" ]; then
  echo "Release archive did not contain $binary" >&2
  exit 1
fi

chmod +x "$tmp_dir/$binary"
mv "$tmp_dir/$binary" "$INSTALL_DIR/quantex"
ln -sf "$INSTALL_DIR/quantex" "$INSTALL_DIR/qtx"

mkdir -p "$state_dir"

record_binary_install_source() {
  python_bin=""
  if command -v python3 >/dev/null 2>&1; then
    python_bin="python3"
  elif command -v python >/dev/null 2>&1; then
    python_bin="python"
  else
    return 0
  fi

  "$python_bin" - "$state_file" <<'PY'
import json
import os
import sys
import tempfile
from pathlib import Path

state_path = Path(sys.argv[1])
state_path.parent.mkdir(parents=True, exist_ok=True)

def warn_and_skip(reason: str) -> None:
    print(f"Warning: leaving existing state.json untouched ({reason}).", file=sys.stderr)
    raise SystemExit(0)

if state_path.exists():
    try:
        state = json.loads(state_path.read_text())
    except Exception as error:
        warn_and_skip(f"unreadable or invalid JSON: {error}")
    if not isinstance(state, dict):
        warn_and_skip("root value is not a JSON object")
    if "installedAgents" in state and not isinstance(state["installedAgents"], dict):
        warn_and_skip("installedAgents is not an object")
    if "lifecycleReceipts" in state and not isinstance(state["lifecycleReceipts"], dict):
        warn_and_skip("lifecycleReceipts is not an object")
    if "self" in state and not isinstance(state["self"], dict):
        warn_and_skip("self is not an object")
    schema_version = state.get("schemaVersion")
    if schema_version is not None and schema_version != 2:
        warn_and_skip(f'unsupported schemaVersion "{schema_version}"')
else:
    state = {
        "schemaVersion": 2,
        "installedAgents": {},
        "lifecycleReceipts": {},
        "self": {},
    }

state.setdefault("installedAgents", {})
state.setdefault("lifecycleReceipts", {})
state.setdefault("self", {})
if not isinstance(state["self"], dict):
    warn_and_skip("self is not an object")
state["self"]["installSource"] = "binary"

fd, tmp_name = tempfile.mkstemp(prefix="state.", suffix=".tmp", dir=str(state_path.parent))
try:
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        handle.write(json.dumps(state, indent=2) + "\n")
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(tmp_name, state_path)
except Exception:
    try:
        os.unlink(tmp_name)
    except OSError:
        pass
    raise
PY
}

record_binary_install_source

echo "Installed quantex to $INSTALL_DIR/quantex"
echo "Installed qtx symlink to $INSTALL_DIR/qtx"
echo "Make sure $INSTALL_DIR is in your PATH"
