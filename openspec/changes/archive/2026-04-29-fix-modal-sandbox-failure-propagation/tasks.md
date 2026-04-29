## 1. Sandbox Failure Propagation

- [x] 1.1 Add an OpenSpec delta requiring Modal sandbox failure propagation independent of raw Modal CLI exit status.
- [x] 1.2 Add `opencode` package mapping for the preinstalled-agent adoption smoke scenario.
- [x] 1.3 Wrap Modal remote command output with a stable exit-code marker and make `test:sandbox` fail when the marker is missing or non-zero.
- [x] 1.4 Add unit coverage for Modal failure-marker parsing/invocation behavior.
- [x] 1.5 Run validation and deliver through PR.
