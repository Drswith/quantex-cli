# relocate-core-state

Relocate deferred Core module src/state into packages/core (issue #759, slice 3 after providers). Product scope lock: only `src/state`; catalog/type-leaf stay neutral; invert/inject seams; freeze SDK/`--json`/state v2/receipts; no config fold; no #134/slim-down; draft PR.
