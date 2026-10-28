#!/usr/bin/env sh
# Checks that an installed v1 binary can `quantex upgrade` to a release built here.
#
# Usage: v1-upgrade-check.sh <assets-dir> <v1-binary> <expected-version>
#
# <assets-dir> holds the output of `quantex-release package`. The release is served
# from 127.0.0.1, and the v1 binary finds its manifest through the response cache, the
# same way it falls back when GitHub is unreachable.

set -eu

assets="$(cd "$1" && pwd)"
v1_binary="$2"
expected="$3"

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) asset="quantex-darwin-arm64.tar.gz" ;;
  Darwin-x86_64) asset="quantex-darwin-x64.tar.gz" ;;
  Linux-aarch64 | Linux-arm64) asset="quantex-linux-arm64.tar.gz" ;;
  Linux-x86_64) asset="quantex-linux-x64.tar.gz" ;;
  *)
    echo "unsupported platform: $(uname -s)-$(uname -m)" >&2
    exit 1
    ;;
esac

work="$(mktemp -d)"
server=""
cleanup() {
  if [ -n "$server" ]; then kill "$server" 2>/dev/null || true; fi
  rm -rf "$work"
}
trap cleanup EXIT

port="$(python3 -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])')"
python3 -m http.server --bind 127.0.0.1 --directory "$assets" "$port" >"$work/server.log" 2>&1 &
server=$!
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:$port/manifest.json')" 2>/dev/null; then
    break
  fi
  sleep 0.5
done

mkdir -p "$work/home/.quantex/cache" "$work/app"
cp "$v1_binary" "$work/app/quantex"
chmod +x "$work/app/quantex"
printf '{"networkRetries": 0, "networkTimeoutMs": 1}\n' >"$work/home/.quantex/config.json"

python3 - "$assets/manifest.json" "$work/home/.quantex/cache/versions.json" "http://127.0.0.1:$port" <<'PY'
import json, sys, time
manifest_path, cache_path, base = sys.argv[1:4]
manifest = json.load(open(manifest_path))
for asset in manifest["assets"]:
    asset["downloadUrl"] = f"{base}/{asset['name']}"
now = int(time.time() * 1000)
entry = {"body": json.dumps(manifest), "expiresAt": now + 3_600_000, "fetchedAt": now}
json.dump({"entries": {"self:manifest:stable": entry}}, open(cache_path, "w"))
PY

before="$(HOME="$work/home" "$work/app/quantex" --version)"
echo "v1 binary reports $before; upgrading to $expected through $asset"
HOME="$work/home" "$work/app/quantex" upgrade --json >"$work/upgrade.json" || {
  cat "$work/upgrade.json" >&2
  exit 1
}
python3 - "$work/upgrade.json" <<'PY'
import json, sys
result = json.load(open(sys.argv[1]))
assert result["ok"] is True and result["data"]["status"] == "updated", result
PY
after="$(HOME="$work/home" "$work/app/quantex" --version)"
if [ "$after" != "$expected" ]; then
  echo "upgraded binary reports $after, expected $expected" >&2
  exit 1
fi
leftovers="$(ls -A "$work/app" | grep -v '^quantex$' || true)"
if [ -n "$leftovers" ]; then
  echo "upgrade left files behind: $leftovers" >&2
  exit 1
fi
echo "v1 upgraded to $after"
