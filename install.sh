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

asset="quantex-$platform-$arch"

if [ "$VERSION" = "latest" ]; then
  download_url="https://github.com/$REPO/releases/latest/download/$asset"
else
  download_url="https://github.com/$REPO/releases/download/$VERSION/$asset"
fi

mkdir -p "$INSTALL_DIR"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT INT TERM

tmp_file="$tmp_dir/quantex"
state_dir="$HOME/.quantex"
state_file="$state_dir/state.json"

if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$download_url" -o "$tmp_file"
elif command -v wget >/dev/null 2>&1; then
  wget -qO "$tmp_file" "$download_url"
else
  echo "curl or wget is required to install quantex-cli" >&2
  exit 1
fi

chmod +x "$tmp_file"
mv "$tmp_file" "$INSTALL_DIR/quantex"
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
