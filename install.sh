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

echo "Installed quantex to $INSTALL_DIR/quantex"
echo "Installed qtx symlink to $INSTALL_DIR/qtx"
echo "Make sure $INSTALL_DIR is in your PATH"
