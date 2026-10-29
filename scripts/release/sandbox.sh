#!/bin/sh
# Builds the release binary, packages it as a GitHub release would, and installs it with
# install.sh into an isolated HOME, for the manual checks in
# docs/runbooks/manual-verification.md. macOS and Linux only.
#
#   sh scripts/release/sandbox.sh <dir>
#   <dir>/shell
#
# `<dir>/shell` opens a shell whose HOME, npm prefix, and bun directory live under <dir>,
# so installs and ~/.quantex changes stay there. Set QUANTEX_V1_BIN to a v1 binary to get
# `quantex-v1` in that shell; by default the `quantex` on PATH is used if it is 1.x.
set -eu

dir="${1:?usage: sh scripts/release/sandbox.sh <dir>}"
root="$(cd "$(dirname "$0")/../.." && pwd)"
mkdir -p "$dir"
dir="$(cd "$dir" && pwd)"

case "$(uname -s)" in
  Darwin) platform="darwin" ;;
  Linux) platform="linux" ;;
  *) echo "sandbox.sh supports macOS and Linux" >&2; exit 1 ;;
esac
case "$(uname -m)" in
  arm64 | aarch64) arch="arm64" ;;
  x86_64 | amd64) arch="x64" ;;
  *) echo "Unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac

v1="${QUANTEX_V1_BIN:-}"
if [ -z "$v1" ] && command -v quantex >/dev/null 2>&1; then
  case "$(quantex --version 2>/dev/null)" in
    1.*) v1="$(command -v quantex)" ;;
  esac
fi

(cd "$root" && cargo build --release -p quantex)
version="$("$root/target/release/quantex" --version)"

# The packaging tool wants all five binaries; only this platform's one is real.
rm -rf "$dir/binaries" "$dir/assets" "$dir/home" "$dir/tools"
mkdir -p "$dir/binaries" "$dir/home" "$dir/tools"
for name in quantex-darwin-arm64 quantex-darwin-x64 quantex-linux-arm64 quantex-linux-x64 quantex-windows-x64.exe; do
  printf 'placeholder\n' >"$dir/binaries/$name"
done
cp "$root/target/release/quantex" "$dir/binaries/quantex-$platform-$arch"
(cd "$root" && cargo run --quiet -p quantex-release -- package --version "$version" --binaries "$dir/binaries" --out "$dir/assets")

# Link package managers by their real path: version-manager shims look under HOME.
for tool in node npm npx bun bunx; do
  if found="$(command -v "$tool" 2>/dev/null)"; then
    real="$(cd "$(dirname "$found")" && pwd -P)/$(basename "$found")"
    case "$real" in
      */shims/*) real="$(mise which "$tool" 2>/dev/null || printf '%s' "$real")" ;;
    esac
    ln -sf "$real" "$dir/tools/$tool"
  fi
done
if [ -n "$v1" ]; then
  ln -sf "$v1" "$dir/tools/quantex-v1"
fi

home="$dir/home"
# npm cannot list global packages under a prefix that does not exist yet.
mkdir -p "$home/.npm-global/bin" "$home/.npm-global/lib"
path="$home/.local/bin:$home/.npm-global/bin:$home/.bun/bin:$dir/tools:/usr/bin:/bin:/usr/sbin:/sbin"
HOME="$home" PATH="$path" QUANTEX_DOWNLOAD_BASE="file://$dir/assets" sh "$root/install.sh"

printf "PS1='(qtx-sandbox) %%~ %%# '\n" >"$home/.zshrc"
printf "PS1='(qtx-sandbox) \\\\w \\\\$ '\n" >"$home/.bashrc"
cat >"$dir/shell" <<EOF
#!/bin/sh
cd "$home" || exit 1
exec env HOME="$home" ZDOTDIR="$home" NPM_CONFIG_PREFIX="$home/.npm-global" BUN_INSTALL="$home/.bun" \\
  PATH="$path" "\${SHELL:-/bin/sh}" -i
EOF
chmod +x "$dir/shell"

# `compare` runs read-only per-agent commands with v1 and this build in the caller's real
# HOME. Catalog-wide output (list, doctor, capabilities) differs on purpose since 2.0.0-beta.2.
if [ -n "$v1" ]; then
  cat >"$dir/compare" <<EOF
#!/bin/sh
# Read-only: neither binary changes state.json or config.json for these commands.
v1="$v1"
rust="$home/.local/bin/quantex"
normalize() { jq -S 'del(.meta) | del(.data.self.currentVersion, .data.self.installSource)'; }
status=0
compare() {
  a="\$("\$v1" "\$@" --json 2>/dev/null | normalize)"
  b="\$("\$rust" "\$@" --json 2>/dev/null | normalize)"
  if [ "\$a" = "\$b" ]; then
    echo "same  \$*"
  else
    echo "DIFF  \$*"
    printf '%s\n' "\$a" >"\${TMPDIR:-/tmp}/qtx-v1.json"
    printf '%s\n' "\$b" >"\${TMPDIR:-/tmp}/qtx-rust.json"
    diff "\${TMPDIR:-/tmp}/qtx-v1.json" "\${TMPDIR:-/tmp}/qtx-rust.json" | head -20
    status=1
  fi
}
compare update --all --dry-run
for agent in \$("\$rust" list --json | jq -r '.data.agents[] | select(.installed) | .name'); do
  compare inspect "\$agent"
  compare resolve "\$agent"
  compare ensure "\$agent" --dry-run
done
exit \$status
EOF
  chmod +x "$dir/compare"
fi

echo
echo "quantex $version is installed in $home/.local/bin."
if [ -n "$v1" ]; then
  echo "quantex-v1 runs $v1 ($("$v1" --version))."
  echo "Compare both against your real HOME with: $dir/compare"
fi
echo "Open the sandbox shell with: $dir/shell"
