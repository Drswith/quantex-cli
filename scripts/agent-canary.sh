#!/usr/bin/env bash
# Runs one agent's real lifecycle through Quantex: install, info, update, uninstall, and
# install again (which adopts an official install that uninstall left on disk). The Agent
# Canaries workflow runs it on a throwaway runner; do not run it on your own machine.
#
# usage: QTX=path/to/quantex scripts/agent-canary.sh <agent>
# Each step's JSON and stderr land in $OUT (default canary-out); a table goes to
# $GITHUB_STEP_SUMMARY. Exits 1 when a step fails.
set -uo pipefail

agent=$1
qtx=${QTX:-qtx}
out=${OUT:-canary-out}
summary=${GITHUB_STEP_SUMMARY:-/dev/stdout}
mkdir -p "$out"
chmod +x "$qtx" 2>/dev/null || true
failed=0

detail='if .error then .error.message
  elif .data.installState then "installType \(.data.installState.installType)"
  elif .data.inspection then "\(.data.inspection.installedVersion // "no version") at \(.data.inspection.binaryPath // "-")"
  elif .data.results then (.data.results[0] | "\(.status) \(.installedVersion // "?") -> \(.latestVersion // "?")")
  else "" end'

run() { # step name, quantex arguments...
  local name=$1
  shift
  local start=$SECONDS
  "$qtx" "$@" --json --non-interactive >"$out/$name.json" 2>"$out/$name.log" </dev/null
  local code=$?
  local row
  row=$(jq -r "[(.ok | tostring), ([.warnings[]?.code] | join(\" \")), ($detail | gsub(\"[|\\n]\"; \" \"))] | join(\" | \")" "$out/$name.json" 2>/dev/null) ||
    row="no JSON | | $(tail -n 1 "$out/$name.log" | tr '|' ' ')"
  echo "| $name | $code | $row | $((SECONDS - start))s |" >>"$summary"
  return $code
}

# A runner image may already carry the agent; remove it so the install starts clean.
for _ in 1 2 3; do
  path=$("$qtx" info "$agent" --json 2>/dev/null | jq -r '.data.inspection | select(.installed) | .binaryPath // empty')
  [ -n "$path" ] || break
  command -v cygpath >/dev/null && path=$(cygpath -u "$path")
  echo "Removing the runner's own $path" >&2
  rm -f "$path" 2>/dev/null || sudo rm -f "$path"
done

{
  echo "### $agent on $(uname -s)"
  echo
  echo "| step | exit | ok | warnings | detail | time |"
  echo "| --- | --- | --- | --- | --- | --- |"
} >>"$summary"
run install install "$agent" --timeout 20m || failed=1
run info info "$agent" || failed=1
jq -e '.data.inspection.installed' "$out/info.json" >/dev/null 2>&1 || failed=1
run update update "$agent" --timeout 15m || failed=1
run uninstall uninstall "$agent" || failed=1
run reinstall install "$agent" --timeout 20m || failed=1
exit $failed
