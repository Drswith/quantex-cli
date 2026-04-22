#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${SKILL_DIR}/../.." && pwd)"
SMOKE_AGENT="${QUANTEX_SMOKE_AGENT:-codex}"

run_quantex() {
  if [[ -n "${QUANTEX_BIN:-}" ]]; then
    "${QUANTEX_BIN}" "$@"
    return
  fi

  if [[ -f "${REPO_ROOT}/package.json" ]] && command -v bun >/dev/null 2>&1; then
    (
      cd "${REPO_ROOT}"
      bun run src/cli.ts "$@"
    )
    return
  fi

  if command -v quantex >/dev/null 2>&1; then
    quantex "$@"
    return
  fi

  echo "Unable to locate quantex. Set QUANTEX_BIN or run from the repo root with bun installed." >&2
  exit 1
}

check_json_command() {
  local label="$1"
  shift

  echo "==> ${label}: quantex $*"

  local output
  output="$(run_quantex "$@" 2>/dev/null)"

  printf '%s\n' "${output}" | python3 -c '
import json
import sys

label = sys.argv[1]
payload = json.load(sys.stdin)

required = ["ok", "action", "error", "meta", "warnings"]
missing = [key for key in required if key not in payload]
if missing:
    missing_text = ", ".join(missing)
    raise SystemExit(f"{label}: missing envelope fields: {missing_text}")

if payload["ok"] is not True:
    error = payload.get("error") or {}
    code = error.get("code", "UNKNOWN")
    message = error.get("message", "")
    raise SystemExit(f"{label}: command failed: {code} {message}".strip())

meta = payload["meta"]
for key in ("schemaVersion", "runId", "timestamp", "version"):
    if key not in meta:
        raise SystemExit(f"{label}: missing meta.{key}")

print(f"{label}: ok")
' "${label}"
}

echo "Quantex skill smoke check"

check_json_command "capabilities" capabilities --json
check_json_command "commands" commands --json
check_json_command "schema" schema --json
check_json_command "schema inspect" schema inspect --json
check_json_command "inspect ${SMOKE_AGENT}" inspect "${SMOKE_AGENT}" --json

INSPECT_OUTPUT="$(run_quantex inspect "${SMOKE_AGENT}" --json 2>/dev/null)"
INSTALLED_STATE="$(printf '%s\n' "${INSPECT_OUTPUT}" | python3 -c '
import json
import sys

payload = json.load(sys.stdin)
inspection = payload.get("data", {}).get("inspection", {})
installed = inspection.get("installed")
print("true" if installed else "false")
')"

if [[ "${INSTALLED_STATE}" == "true" ]]; then
  check_json_command "resolve ${SMOKE_AGENT}" resolve "${SMOKE_AGENT}" --json
else
  echo "==> resolve ${SMOKE_AGENT}: skipped because the agent is not currently installed"
fi

echo "Smoke check passed"
