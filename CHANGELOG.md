# Changelog


## [1.9.2](https://github.com/Drswith/quantex-cli/compare/v1.9.1...v1.9.2) (2026-08-13)


### Bug Fixes

* **uninstall:** stop reporting a source conflict for agents that were updated ([83fa533](https://github.com/Drswith/quantex-cli/commit/83fa53341eb7c192c2314a81ca3125b91f4117e1))

## [1.9.1](https://github.com/Drswith/quantex-cli/compare/v1.9.0...v1.9.1) (2026-08-13)


### Bug Fixes

* **release:** publish Windows binaries as ZIP ([2602707](https://github.com/Drswith/quantex-cli/commit/26027075b3b54d073be95157d44ca9a451b487f0))

## [1.9.0](https://github.com/Drswith/quantex-cli/compare/v1.8.12...v1.9.0) (2026-08-12)


### Features

* add uv installer preference and complete agent canary coverage ([524198c](https://github.com/Drswith/quantex-cli/commit/524198cc3329d659236a496c39177abbee999869))


### Bug Fixes

* allow fresh uv-managed agent installs and stabilize full catalog canaries ([920a853](https://github.com/Drswith/quantex-cli/commit/920a853ab1249e5e8351cb26877b67d619ba9d96))

## [1.8.12](https://github.com/Drswith/quantex-cli/compare/v1.8.11...v1.8.12) (2026-08-10)


### Bug Fixes

* tell you why an install failed instead of only that it failed ([960c085](https://github.com/Drswith/quantex-cli/commit/960c085c4c9909c10e6abacdd7305af416cc549a))

## [1.8.11](https://github.com/Drswith/quantex-cli/compare/v1.8.10...v1.8.11) (2026-08-10)


### Bug Fixes

* find agents installed to standard locations that are not yet on your PATH ([fbe17d4](https://github.com/Drswith/quantex-cli/commit/fbe17d42234700393d7302fe693aaecdb616aa94))
* **output:** report untracked agents as detected on disk instead of detected in PATH ([19d0b07](https://github.com/Drswith/quantex-cli/commit/19d0b0785ed6de9af98190411f162d9b41a21da5))

## [1.8.10](https://github.com/Drswith/quantex-cli/compare/v1.8.9...v1.8.10) (2026-08-07)


### Bug Fixes

* parse successful stderr-only agent version probes ([d313ffd](https://github.com/Drswith/quantex-cli/commit/d313ffdfb229167357de6f36899d77d6764c78b6))

## [1.8.9](https://github.com/Drswith/quantex-cli/compare/v1.8.8...v1.8.9) (2026-08-07)


### Bug Fixes

* detect installed agent versions emitted on stderr ([d24a994](https://github.com/Drswith/quantex-cli/commit/d24a9945829493a5d22425ed86e0c3fcbc7ad39f))
* detect installed agent versions emitted on stderr ([3c94c70](https://github.com/Drswith/quantex-cli/commit/3c94c70bdaf2e8895a5d65c076bb9e371f606460))
* detect installed agent versions emitted on stderr ([0441b2b](https://github.com/Drswith/quantex-cli/commit/0441b2b12b19c0dab1e31f79c0fb6db9608b0295))

## [1.8.8](https://github.com/Drswith/quantex-cli/compare/v1.8.7...v1.8.8) (2026-08-06)


### Bug Fixes

* **uninstall:** stop re-adding state when another copy stays on PATH ([09fb060](https://github.com/Drswith/quantex-cli/commit/09fb060658ef6f8830ddcd28694d9256b3980125))

## [1.8.7](https://github.com/Drswith/quantex-cli/compare/v1.8.6...v1.8.7) (2026-08-06)


### Bug Fixes

* **install:** stop install.sh from discarding or tearing state.json ([a85a6ae](https://github.com/Drswith/quantex-cli/commit/a85a6ae673a41a1a159225863832c9ff1e99d715))

## [1.8.6](https://github.com/Drswith/quantex-cli/compare/v1.8.2...v1.8.6) (2026-08-05)


### Bug Fixes

* preserve downloaded release candidate across checkout and fix tag dispatch permissions ([0c2e2fc](https://github.com/Drswith/quantex-cli/commit/0c2e2fc22c89fd24c43c3ddd0524d55bcc7126d0))
* handle squash-merge PR suffix in release title parsing ([d315ade](https://github.com/Drswith/quantex-cli/commit/d315adebb52eb861e48f871f22f4fedfde5bbef4))
* allow release from any reachable commit not just exact branch head ([2c4ef7c](https://github.com/Drswith/quantex-cli/commit/2c4ef7c))
* checkout before download and pass GITHUB_TOKEN for dispatch ([0165d06](https://github.com/Drswith/quantex-cli/commit/0165d06))


## [1.8.5](https://github.com/Drswith/quantex-cli/compare/v1.8.2...v1.8.5) (2026-08-05)


### Bug Fixes

* preserve downloaded release candidate across checkout and fix tag dispatch permissions ([0c2e2fc](https://github.com/Drswith/quantex-cli/commit/0c2e2fc22c89fd24c43c3ddd0524d55bcc7126d0))
* handle squash-merge PR suffix in release title parsing ([d315ade](https://github.com/Drswith/quantex-cli/commit/d315adebb52eb861e48f871f22f4fedfde5bbef4))
* allow release from any reachable commit not just exact branch head ([2c4ef7c](https://github.com/Drswith/quantex-cli/commit/2c4ef7c))


## [1.8.4](https://github.com/Drswith/quantex-cli/compare/v1.8.2...v1.8.4) (2026-08-05)


### Bug Fixes

* preserve downloaded release candidate across checkout and fix tag dispatch permissions ([0c2e2fc](https://github.com/Drswith/quantex-cli/commit/0c2e2fc22c89fd24c43c3ddd0524d55bcc7126d0))

This changelog is maintained by release-please Release PRs.


## [1.8.3](https://github.com/Drswith/quantex-cli/compare/v1.8.2...v1.8.3) (2026-08-05)


### Bug Fixes

* skip gh-shim ci-context test on Windows ([04ab970](https://github.com/Drswith/quantex-cli/commit/04ab9707f0347c956a08223b2bb549d17680c90f))

## [1.8.2](https://github.com/Drswith/quantex-cli/compare/v1.8.1...v1.8.2) (2026-08-04)


### Bug Fixes

* **release:** add tag backstop for manually merged Release PRs ([5bcf697](https://github.com/Drswith/quantex-cli/commit/5bcf69713d2d4bc35f24871583fdfdd7f2404829))

## [1.8.1](https://github.com/Drswith/quantex-cli/compare/v1.8.0...v1.8.1) (2026-08-03)


### Bug Fixes

* **release:** configure the annotated-tag identity on fresh runners ([5ac7f42](https://github.com/Drswith/quantex-cli/commit/5ac7f42aba08171b0428c54cb476f5e9d0ba2443))
* **release:** publish the exact candidate without a source checkout ([e515702](https://github.com/Drswith/quantex-cli/commit/e51570280563547bcbaaf6b53282fd7f558b0844))
* **test:** stabilize Windows command-family compatibility cleanup ([0ec6c2d](https://github.com/Drswith/quantex-cli/commit/0ec6c2d103f897378117f1c76fc8e62681289a7f))

## [1.8.0](https://github.com/Drswith/quantex-cli/compare/v1.7.1...v1.8.0) (2026-08-03)

### Features

* **list:** show available agent updates ([3325f0b](https://github.com/Drswith/quantex-cli/commit/3325f0bcd477aab12618c830a3e9853d5e2481c8))
* **release:** publish compressed standalone binaries ([fdd0d80](https://github.com/Drswith/quantex-cli/commit/fdd0d80437d0b9c445b75ab02fa3fd289e9654c3))

## [1.7.1](https://github.com/Drswith/quantex-cli/compare/v1.7.0...v1.7.1) (2026-08-03)


### Bug Fixes

* **update:** accept equivalent executable paths ([d4f6d45](https://github.com/Drswith/quantex-cli/commit/d4f6d456250715813a5ee232551e4743c6378601))

## [1.7.0](https://github.com/Drswith/quantex-cli/compare/v1.6.0...v1.7.0) (2026-08-03)


### Features

* **list:** show compact install source ([a0455c9](https://github.com/Drswith/quantex-cli/commit/a0455c92f8461d7ba06b91d9066f7e42470c06cd))

## [1.6.0](https://github.com/Drswith/quantex-cli/compare/v1.5.0...v1.6.0) (2026-07-31)


### Features

* **output:** improve human CLI readability across terminal widths ([7553c5d](https://github.com/Drswith/quantex-cli/commit/7553c5dbd4a7884675ac87750d95845c5c214382))


### Bug Fixes

* **self-upgrade:** discover newly published versions during explicit upgrade checks ([b2ed013](https://github.com/Drswith/quantex-cli/commit/b2ed0136b1463b3c2d3373ec4c1aabc3fd06a113))

## [1.5.0](https://github.com/Drswith/quantex-cli/compare/v1.4.0...v1.5.0) (2026-07-31)


### Features

* **compat:** start the second Core-default soak with a documented legacy recovery route ([263335d](https://github.com/Drswith/quantex-cli/commit/263335d88406680195506c047cd6550cdc589317))

## [1.4.0](https://github.com/Drswith/quantex-cli/compare/v1.3.0...v1.4.0) (2026-07-31)


### Features

* **core:** use the verified Core lifecycle engine by default for install and ensure, while retaining v1 dry-run planning and a safe legacy rollback route. ([c1e70ab](https://github.com/Drswith/quantex-cli/commit/c1e70ab9e982cac66242bd0aad36e1828779dd10))

## [1.3.0](https://github.com/Drswith/quantex-cli/compare/v1.2.0...v1.3.0) (2026-07-27)


### Features

* **core:** add verified install and ensure operations to the TypeScript SDK ([378ef08](https://github.com/Drswith/quantex-cli/commit/378ef0841005796a85deb6a50e8cf2dd9210249c))

## [1.2.0](https://github.com/Drswith/quantex-cli/compare/v1.1.3...v1.2.0) (2026-07-22)


### Features

* **core:** add a minimal read-only TypeScript SDK for agent discovery and inspection ([554c0e1](https://github.com/Drswith/quantex-cli/commit/554c0e197c53d0b776beb714a81f644b8cb49210))


### Bug Fixes

* **lifecycle:** clear tracked script/binary state on uninstall without requiring PATH absence ([6550610](https://github.com/Drswith/quantex-cli/commit/655061042a12e00a36819e08ae27a069318e87c3))

## [1.1.3](https://github.com/Drswith/quantex-cli/compare/v1.1.2...v1.1.3) (2026-07-20)


### Bug Fixes

* **lifecycle:** probe cargo/deno/pip/winget package presence for install verification and uninstall ([4508956](https://github.com/Drswith/quantex-cli/commit/45089565a5c6bfb873c209023f39c13a758367f3))

## [1.1.2](https://github.com/Drswith/quantex-cli/compare/v1.1.1...v1.1.2) (2026-07-19)


### Bug Fixes

* **update:** reconcile tracked self-updates and stale agent state ([0c3a2d8](https://github.com/Drswith/quantex-cli/commit/0c3a2d85b4e1a9c56768480899d84180fb301d80))

## [1.1.1](https://github.com/Drswith/quantex-cli/compare/v1.1.0...v1.1.1) (2026-07-19)


### Bug Fixes

* **lifecycle:** harden upgrade provider safety ([ed004ae](https://github.com/Drswith/quantex-cli/commit/ed004aefc5eff5b9ba39d4128e598b3eb436107c))

## [1.1.0](https://github.com/Drswith/quantex-cli/compare/v0.29.1...v1.1.0) (2026-07-16)

### Release summary

`v1.1.0` graduates Quantex onto its post-redesign release line. The generated breaking-change marker records that release-line transition; it does **not** intentionally remove the maintained v1 CLI commands and aliases, JSON/NDJSON envelopes and exit semantics, readable state/config projections, `qtx`/`quantex` binary entries, or maintained root-package exports.

No migration is required for those maintained v1 surfaces. The underlying lifecycle-engine refactor was delivered in the `v0.29.0..v0.29.1` range; its implementation summary and compatibility boundary appear in the `v0.29.1` notes below.

### ⚠ BREAKING CHANGES

* **release:** graduate post-redesign line

### Features

* **release:** graduate post-redesign line ([3b65af0](https://github.com/Drswith/quantex-cli/commit/3b65af03987ea16b02036912c9444e5314c211ba))

## [0.29.1](https://github.com/Drswith/quantex-cli/compare/v0.29.0...v0.29.1) (2026-07-16)

### Lifecycle-engine refactor

This release completes the internal lifecycle-engine redesign delivered after `v0.29.0`:

* lifecycle mutations now follow observation, planning, execution, postcondition verification, and receipt persistence stages;
* provider capabilities and catalog installation data are typed, declarative adapters rather than duplicated command-specific metadata;
* persisted state is versioned management evidence reconciled with the live environment, and idempotent replay requires the same request meaning plus a still-valid postcondition;
* command registration, discovery, schemas, and presentation flow from a single command-contract registry; and
* runtime dependencies use per-invocation context and ports, while Quantex self-upgrade remains a separate bounded context.

### Compatibility

The refactor preserves the maintained v1 external contract: stable command names and aliases, `qtx`/`quantex` entries, JSON/NDJSON envelopes, error and exit semantics, state/config projections, transparent agent process IO, and maintained root-package exports. Existing users do not need a migration for these surfaces.

### Bug Fixes

* **process:** clean up orphaned lifecycle test trees ([44f8477](https://github.com/Drswith/quantex-cli/commit/44f84771c51029a48e9a58513cdecf25e89d9404))
* **windows:** stabilize promotion validation ([05a1f63](https://github.com/Drswith/quantex-cli/commit/05a1f63e15cc41a6925f29410e5281d0987728c3))

## [0.29.0](https://github.com/Drswith/quantex-cli/compare/v0.28.1...v0.29.0) (2026-07-09)


### Features

* **agent-catalog:** add Grok Build support ([#435](https://github.com/Drswith/quantex-cli/issues/435)) ([42e1567](https://github.com/Drswith/quantex-cli/commit/42e1567f1c20155510a1560636d66826dff8b993))

## [0.28.1](https://github.com/Drswith/quantex-cli/compare/v0.28.0...v0.28.1) (2026-07-09)


### Bug Fixes

* **lifecycle:** refuse project-local npm adoption ([#432](https://github.com/Drswith/quantex-cli/issues/432)) ([8e42c4c](https://github.com/Drswith/quantex-cli/commit/8e42c4cfd2cec2047001093a92b66451b185e452))

## [0.28.0](https://github.com/Drswith/quantex-cli/compare/v0.27.1...v0.28.0) (2026-07-08)


### Features

* **agent-catalog:** add Command Code support ([c077435](https://github.com/Drswith/quantex-cli/commit/c077435f253a4a31c881b0d7319d1aaea7616cf6))

## [0.27.1](https://github.com/Drswith/quantex-cli/compare/v0.27.0...v0.27.1) (2026-07-08)


### Bug Fixes

* **install:** fail closed when batch install is cancelled mid-fleet ([1fd5de6](https://github.com/Drswith/quantex-cli/commit/1fd5de6e1f7305925b2c5364808d4ec9b77723b0))

## [0.27.0](https://github.com/Drswith/quantex-cli/compare/v0.26.0...v0.27.0) (2026-07-07)


### Features

* **agent-catalog:** add OpenClaw support ([#422](https://github.com/Drswith/quantex-cli/issues/422)) ([5de4833](https://github.com/Drswith/quantex-cli/commit/5de483311159f11df2e66b8abbfce62919ce7886))

## [0.26.0](https://github.com/Drswith/quantex-cli/compare/v0.25.10...v0.26.0) (2026-07-06)


### Features

* **agent-catalog:** add Hermes Agent support ([f3ca204](https://github.com/Drswith/quantex-cli/commit/f3ca20457211b655ee897b407413f554acf96012)), closes [#418](https://github.com/Drswith/quantex-cli/issues/418)

## [0.25.10](https://github.com/Drswith/quantex-cli/compare/v0.25.9...v0.25.10) (2026-07-06)


### Bug Fixes

* **update:** fail closed when update --all is cancelled mid-batch ([857f101](https://github.com/Drswith/quantex-cli/commit/857f1010c03ac767937e72812a69560b2d49865f))

## [0.25.9](https://github.com/Drswith/quantex-cli/compare/v0.25.8...v0.25.9) (2026-07-04)


### Bug Fixes

* **lifecycle:** fail closed on bun/mise/uv ghost uninstall probes ([60d9797](https://github.com/Drswith/quantex-cli/commit/60d97979db5a03440eb53f9855ce2e937c449631))

## [0.25.8](https://github.com/Drswith/quantex-cli/compare/v0.25.7...v0.25.8) (2026-07-03)


### Bug Fixes

* **uninstall:** explain unmanaged agent uninstall targets ([d484df9](https://github.com/Drswith/quantex-cli/commit/d484df92896fe50449d8ec2496cdc258ed80046b))

## [0.25.7](https://github.com/Drswith/quantex-cli/compare/v0.25.6...v0.25.7) (2026-07-03)


### Bug Fixes

* **lifecycle:** stop install fallback when cancellation races managed install ([79a26d4](https://github.com/Drswith/quantex-cli/commit/79a26d44f48a7433b62f582ccacf3cd2ac616805))

## [0.25.6](https://github.com/Drswith/quantex-cli/compare/v0.25.5...v0.25.6) (2026-07-02)


### Bug Fixes

* **lifecycle:** roll back bun install when trust verification fails ([ac25c92](https://github.com/Drswith/quantex-cli/commit/ac25c92a5bd99de5be7eadad8da75d99c9599807))

## [0.25.5](https://github.com/Drswith/quantex-cli/compare/v0.25.4...v0.25.5) (2026-07-01)


### Bug Fixes

* **lifecycle:** fail closed on inconclusive npm ghost probes ([8bd2d1b](https://github.com/Drswith/quantex-cli/commit/8bd2d1b817540b0d0385f44ad2f06d9db7e1a1c4))

## [0.25.4](https://github.com/Drswith/quantex-cli/compare/v0.25.3...v0.25.4) (2026-06-30)


### Bug Fixes

* **lifecycle:** recover uninstall ghost state when package is absent ([0b499c3](https://github.com/Drswith/quantex-cli/commit/0b499c300c164102983e3c1701eaff4a324f6fdf))

## [0.25.3](https://github.com/Drswith/quantex-cli/compare/v0.25.2...v0.25.3) (2026-06-28)


### Bug Fixes

* **lifecycle:** preserve state on cancelled updates ([#392](https://github.com/Drswith/quantex-cli/issues/392)) ([e4126d6](https://github.com/Drswith/quantex-cli/commit/e4126d6c8ed6fdefc2b48a417427f33b4c536923))

## [0.25.2](https://github.com/Drswith/quantex-cli/compare/v0.25.1...v0.25.2) (2026-06-24)


### Bug Fixes

* **lifecycle:** roll back state when cancellation races persistence ([7f077e3](https://github.com/Drswith/quantex-cli/commit/7f077e32bc8b51b04d579c5e8e2c506606fa38ed))

## [0.25.1](https://github.com/Drswith/quantex-cli/compare/v0.25.0...v0.25.1) (2026-06-22)


### Bug Fixes

* **cli:** harden lifecycle cancellation and replay ([8cca879](https://github.com/Drswith/quantex-cli/commit/8cca879b32932a4d7cd9f5ed4dae8726245c1729))

## [0.25.0](https://github.com/Drswith/quantex-cli/compare/v0.24.2...v0.25.0) (2026-06-18)


### Features

* **cli:** add Antigravity support and exec timeout grace ([662be3f](https://github.com/Drswith/quantex-cli/commit/662be3fd94ca42b57de5c3f27d013cffe518fa01))

## [0.24.2](https://github.com/Drswith/quantex-cli/compare/v0.24.1...v0.24.2) (2026-06-17)


### Bug Fixes

* **cli:** defer exec install cancel and preserve timeout failures ([2fa93f3](https://github.com/Drswith/quantex-cli/commit/2fa93f33fe1ad4844c5fd769875afcf9d6dff241))

## [0.24.1](https://github.com/Drswith/quantex-cli/compare/v0.24.0...v0.24.1) (2026-06-16)


### Bug Fixes

* **cli:** resolve critical lifecycle edge cases ([687172f](https://github.com/Drswith/quantex-cli/commit/687172f28b0c3ce72620241b868e27cc1a349246))

## [0.24.0](https://github.com/Drswith/quantex-cli/compare/v0.23.6...v0.24.0) (2026-06-11)


### Features

* **agent-catalog:** add MiMoCode support ([ddb5924](https://github.com/Drswith/quantex-cli/commit/ddb5924e1d6eaf16d15f00bb5e38c2dce7838c80))

## [0.23.6](https://github.com/Drswith/quantex-cli/compare/v0.23.5...v0.23.6) (2026-06-11)


### Bug Fixes

* **release:** recover missing npm publication ([3596555](https://github.com/Drswith/quantex-cli/commit/35965551b180741af2dc01b96841b55bb1e808a8))

## [0.23.5](https://github.com/Drswith/quantex-cli/compare/v0.23.4...v0.23.5) (2026-06-11)


### Bug Fixes

* **cli:** harden idempotency target matching and timeout success handling ([a8b6061](https://github.com/Drswith/quantex-cli/commit/a8b6061fb6532549e7bc874d4e77db38374a305e))

## [0.23.4](https://github.com/Drswith/quantex-cli/compare/v0.23.3...v0.23.4) (2026-06-10)


### Bug Fixes

* **cli:** use collision-safe idempotency key filenames ([e26e294](https://github.com/Drswith/quantex-cli/commit/e26e2948abc76771a50887ec77d5dbdba0ebfcd9))

## [0.23.3](https://github.com/Drswith/quantex-cli/compare/v0.23.2...v0.23.3) (2026-06-09)


### Bug Fixes

* **cli:** only persist successful idempotency records ([9160ac3](https://github.com/Drswith/quantex-cli/commit/9160ac36a8c1e36ff73e926ad38cc797a6c242d0))

## [0.23.2](https://github.com/Drswith/quantex-cli/compare/v0.23.1...v0.23.2) (2026-06-08)


### Bug Fixes

* **cli:** handle state read errors and install timeouts ([bc486ce](https://github.com/Drswith/quantex-cli/commit/bc486cefed938bcfcf40f0ed637f82ddf57c8b44))

## [0.23.1](https://github.com/Drswith/quantex-cli/compare/v0.23.0...v0.23.1) (2026-06-03)


### Bug Fixes

* **lifecycle:** untrack script and binary agents on uninstall ([47a7aab](https://github.com/Drswith/quantex-cli/commit/47a7aab325061c8021b8d10f282a5bc625883f25))

## [0.23.0](https://github.com/Drswith/quantex-cli/compare/v0.22.5...v0.23.0) (2026-06-03)


### Features

* **agent-catalog:** update kimi code cli distribution ([#332](https://github.com/Drswith/quantex-cli/issues/332)) ([5fa6f19](https://github.com/Drswith/quantex-cli/commit/5fa6f191ef136725015d5b5281575a85be275a73))

## [0.22.5](https://github.com/Drswith/quantex-cli/compare/v0.22.4...v0.22.5) (2026-06-02)


### Bug Fixes

* **lifecycle:** harden managed state gaps in install and update ([af28e31](https://github.com/Drswith/quantex-cli/commit/af28e311152d377e7ab6ebaff421fb4ab3aa95ae))

## [0.22.4](https://github.com/Drswith/quantex-cli/compare/v0.22.3...v0.22.4) (2026-06-01)


### Bug Fixes

* **lifecycle:** fail closed on unsafe install and upgrade paths ([87f0c86](https://github.com/Drswith/quantex-cli/commit/87f0c867b28fe574f07f6cbf15829f64c67061d2))

## [0.22.3](https://github.com/Drswith/quantex-cli/compare/v0.22.2...v0.22.3) (2026-05-29)


### Bug Fixes

* **state:** reject non-object state.json roots on read ([c807221](https://github.com/Drswith/quantex-cli/commit/c807221376b05cbe7d2affe186393ae7a2812cb2))

## [0.22.2](https://github.com/Drswith/quantex-cli/compare/v0.22.1...v0.22.2) (2026-05-28)


### Bug Fixes

* **state:** reject invalid installedAgents on read ([969af40](https://github.com/Drswith/quantex-cli/commit/969af40dc0b44a5729262a1ceebb77c4bbb0fd72))

## [0.22.1](https://github.com/Drswith/quantex-cli/compare/v0.22.0...v0.22.1) (2026-05-27)


### Bug Fixes

* **state:** fail closed on corrupt state reads ([f5bedc6](https://github.com/Drswith/quantex-cli/commit/f5bedc69e1f6a7371f50d6b482d6cbdd7526ca18))

## [0.22.0](https://github.com/Drswith/quantex-cli/compare/v0.21.1...v0.22.0) (2026-05-24)


### Features

* **agents:** rename deepseek catalog to codewhale ([#307](https://github.com/Drswith/quantex-cli/issues/307)) ([b40fb25](https://github.com/Drswith/quantex-cli/commit/b40fb25a10f037303ff9f3541dee5ca015e7f6cd)), closes [#306](https://github.com/Drswith/quantex-cli/issues/306)

## [0.21.1](https://github.com/Drswith/quantex-cli/compare/v0.21.0...v0.21.1) (2026-05-23)


### Bug Fixes

* keep windows binary aliases in sync ([cc203bf](https://github.com/Drswith/quantex-cli/commit/cc203bfecbf8673051ee9630458fe4ccf4109f74))
* prefer cargo for vtcode windows install ([bc69b80](https://github.com/Drswith/quantex-cli/commit/bc69b808faff918dca095d1ba56d2b7c09708962))

## [0.21.0](https://github.com/Drswith/quantex-cli/compare/v0.20.0...v0.21.0) (2026-05-23)


### Features

* add Deno managed installer ([52cc051](https://github.com/Drswith/quantex-cli/commit/52cc05151252a129f882097fc0ca86a5b6939ab9))
* **agents:** add Deep Code CLI support ([830fd5b](https://github.com/Drswith/quantex-cli/commit/830fd5b8ace38a6b82d9680b9389188143f04159))
* **agents:** add oh-my-pi (omp) support ([e91b4f1](https://github.com/Drswith/quantex-cli/commit/e91b4f136a08dc36399408b73b9b406114ede8e1))


### Bug Fixes

* make managed installer cancellation sticky ([fa0903d](https://github.com/Drswith/quantex-cli/commit/fa0903d6eced0dacdb8aecbfde79992f1d9dde99))

## [0.20.0](https://github.com/Drswith/quantex-cli/compare/v0.19.0...v0.20.0) (2026-05-23)


### Features

* **agent:** add mise lifecycle support ([#283](https://github.com/Drswith/quantex-cli/issues/283)) ([6201d02](https://github.com/Drswith/quantex-cli/commit/6201d02ebdcf5e85bf24031a67d4b1106d860efa))

## [0.19.0](https://github.com/Drswith/quantex-cli/compare/v0.18.6...v0.19.0) (2026-05-22)


### Features

* add uv managed installer support ([f8e4a15](https://github.com/Drswith/quantex-cli/commit/f8e4a157e2ebf91fae78feb3a0174811b5fec981)), closes [#239](https://github.com/Drswith/quantex-cli/issues/239)
* **agent-catalog:** add schema-backed catalog data ([#268](https://github.com/Drswith/quantex-cli/issues/268)) ([c528759](https://github.com/Drswith/quantex-cli/commit/c528759bc324abeb2f124daddf3df001549fe4ce))

## [0.18.6](https://github.com/Drswith/quantex-cli/compare/v0.18.5...v0.18.6) (2026-05-22)


### Bug Fixes

* **update:** serialize grouped fallback updates ([ce9a40e](https://github.com/Drswith/quantex-cli/commit/ce9a40e76c664c520f6e1ce7332fb69a1da749e2))

## [0.18.5](https://github.com/Drswith/quantex-cli/compare/v0.18.4...v0.18.5) (2026-05-21)


### Bug Fixes

* **update:** preserve recorded install source ([5b2cfbf](https://github.com/Drswith/quantex-cli/commit/5b2cfbfe1bd3a8e965bd5e1c388a8dbed5e5290e))

## [0.18.4](https://github.com/Drswith/quantex-cli/compare/v0.18.3...v0.18.4) (2026-05-19)


### Bug Fixes

* **update:** avoid false batch success for package-less agents ([25bdbd6](https://github.com/Drswith/quantex-cli/commit/25bdbd6ba845d84abee81b2e25e0bb15b1398e28))

## [0.18.3](https://github.com/Drswith/quantex-cli/compare/v0.18.2...v0.18.3) (2026-05-18)


### Bug Fixes

* **schema:** include pip in doctor installers JSON schema ([0690aaf](https://github.com/Drswith/quantex-cli/commit/0690aaf321a42d65604253bceb144f36c7f5ca6b))

## [0.18.2](https://github.com/Drswith/quantex-cli/compare/v0.18.1...v0.18.2) (2026-05-18)


### Bug Fixes

* **update:** reject no-op grouped managed batch updates ([9d7ae56](https://github.com/Drswith/quantex-cli/commit/9d7ae566576444bf6fc2210cb6e7b81bfe270ec4))

## [0.18.1](https://github.com/Drswith/quantex-cli/compare/v0.18.0...v0.18.1) (2026-05-18)


### Bug Fixes

* **update:** include pip in grouped batch update planning ([e41827b](https://github.com/Drswith/quantex-cli/commit/e41827b4284f4f6d081954f6a2c122e889c19aa9))

## [0.18.0](https://github.com/Drswith/quantex-cli/compare/v0.17.1...v0.18.0) (2026-05-18)


### Features

* add first-class pip install support ([db5d172](https://github.com/Drswith/quantex-cli/commit/db5d17277457c913f84bb5b5920e22cbd16ab404))


### Bug Fixes

* **git:** strip cursor attribution trailers locally ([65211f1](https://github.com/Drswith/quantex-cli/commit/65211f155f9fe64f1789485a764c9094c9473e22))

## [0.17.1](https://github.com/Drswith/quantex-cli/compare/v0.17.0...v0.17.1) (2026-05-18)


### Bug Fixes

* **lock:** fail closed when owner metadata is unreadable or invalid ([d00fdd1](https://github.com/Drswith/quantex-cli/commit/d00fdd1b56c991aeb05f39db5f5d20525f93db97))

## [0.17.0](https://github.com/Drswith/quantex-cli/compare/v0.16.4...v0.17.0) (2026-05-10)


### Features

* add Reasonix support ([d301b14](https://github.com/Drswith/quantex-cli/commit/d301b148234a9bebff93ea257089fa86bab56bb6))
* **agents:** add VTCode support ([#232](https://github.com/Drswith/quantex-cli/issues/232)) ([4cf2308](https://github.com/Drswith/quantex-cli/commit/4cf2308d3d7c0705e006d307396e1ea297428e83))
* 添加 Cargo 包管理器支持 ([#229](https://github.com/Drswith/quantex-cli/issues/229)) ([a939411](https://github.com/Drswith/quantex-cli/commit/a9394118b1a76f237ad6f1f47242cb49279aa282))


### Bug Fixes

* **lock:** wait for owner.json before stale removal across processes ([530e272](https://github.com/Drswith/quantex-cli/commit/530e272a2ec132b9cbe498c25a4cb8127f8c668b))
* **release:** ignore already tagged release commits ([#231](https://github.com/Drswith/quantex-cli/issues/231)) ([b3e302e](https://github.com/Drswith/quantex-cli/commit/b3e302e6fcbbe73a1ef690f5a9f9a6585e65e663))
* **self-upgrade:** avoid rollback after verified binary swap ([af6942e](https://github.com/Drswith/quantex-cli/commit/af6942e644f9fd0e550c47bf38f3c033db32284d))

## [0.16.4](https://github.com/Drswith/quantex-cli/compare/v0.16.3...v0.16.4) (2026-05-09)


### Bug Fixes

* **self-upgrade:** restore binary after failed swap on Unix self-upgrade ([778fd7f](https://github.com/Drswith/quantex-cli/commit/778fd7f366274270480ddf582de88c20b7047dc1))

## [0.16.3](https://github.com/Drswith/quantex-cli/compare/v0.16.2...v0.16.3) (2026-05-09)


### Bug Fixes

* **agent-update:** stabilize managed update state ([#216](https://github.com/Drswith/quantex-cli/issues/216)) ([44fa7bb](https://github.com/Drswith/quantex-cli/commit/44fa7bb0155089135a365b467640136c9711f60e))

## [0.16.2](https://github.com/Drswith/quantex-cli/compare/v0.16.1...v0.16.2) (2026-05-08)


### Bug Fixes

* **sandbox:** return full self-managed version metadata ([#212](https://github.com/Drswith/quantex-cli/issues/212)) ([f1e47a1](https://github.com/Drswith/quantex-cli/commit/f1e47a158d9105b9895e6947c58518792e966576))

## [0.16.1](https://github.com/Drswith/quantex-cli/compare/v0.16.0...v0.16.1) (2026-05-08)


### Bug Fixes

* **sandbox:** stabilize self-managed upgrade smoke ([#210](https://github.com/Drswith/quantex-cli/issues/210)) ([d62869f](https://github.com/Drswith/quantex-cli/commit/d62869fe534bb9d6562576f77e5a296e70d04f88))

## [0.16.0](https://github.com/Drswith/quantex-cli/compare/v0.15.1...v0.16.0) (2026-05-08)


### Features

* support multi-agent install ([71b869d](https://github.com/Drswith/quantex-cli/commit/71b869df901611949e883ed153dc70e9b3c0163d))


### Bug Fixes

* **ci:** load release PR policy from trusted base ref ([#179](https://github.com/Drswith/quantex-cli/issues/179)) ([c9e41d7](https://github.com/Drswith/quantex-cli/commit/c9e41d733ad41b701e2cf098edfeb78d2751a10e))
* **self-upgrade:** avoid false managed verify when latestVersion unresolved ([#193](https://github.com/Drswith/quantex-cli/issues/193)) ([7db3a14](https://github.com/Drswith/quantex-cli/commit/7db3a14c4657b629e28855dcaf95aa0d6ae19b35))
* **self-upgrade:** do not treat missing latest as up-to-date ([#192](https://github.com/Drswith/quantex-cli/issues/192)) ([a22215b](https://github.com/Drswith/quantex-cli/commit/a22215bf26e68c36198b03a75b05ceef09219d2a))
* **state:** preserve unknown self keys on state.json write-back ([#183](https://github.com/Drswith/quantex-cli/issues/183)) ([d448e97](https://github.com/Drswith/quantex-cli/commit/d448e9793d03017e36aecbb203fd3202fe19379b))

## [0.15.1](https://github.com/Drswith/quantex-cli/compare/v0.15.0...v0.15.1) (2026-05-06)


### Bug Fixes

* **self-upgrade:** suppress stale latest-version downgrades ([#189](https://github.com/Drswith/quantex-cli/issues/189)) ([995b9cc](https://github.com/Drswith/quantex-cli/commit/995b9cc981561557d303c240e169460568dc0ed6))

## [0.15.0](https://github.com/Drswith/quantex-cli/compare/v0.14.1...v0.15.0) (2026-05-06)


### Features

* add jcode support ([#187](https://github.com/Drswith/quantex-cli/issues/187)) ([c6fb4bc](https://github.com/Drswith/quantex-cli/commit/c6fb4bc0a4cbb00444d91fa0cf032a8d9f7c85d7))

## [0.14.1](https://github.com/Drswith/quantex-cli/compare/v0.14.0...v0.14.1) (2026-05-06)


### Bug Fixes

* **self-upgrade:** verify managed installs via cli entrypoint ([#184](https://github.com/Drswith/quantex-cli/issues/184)) ([5f13d20](https://github.com/Drswith/quantex-cli/commit/5f13d20e0bda03179a532e89a4456d84b8ba7763))

## [0.14.0](https://github.com/Drswith/quantex-cli/compare/v0.13.0...v0.14.0) (2026-05-04)


### Features

* **agents:** add deepseek tui support ([#176](https://github.com/Drswith/quantex-cli/issues/176)) ([ca43b81](https://github.com/Drswith/quantex-cli/commit/ca43b811dd86bfb33dde7aece06bff1dc26deed9))

## [0.13.0](https://github.com/Drswith/quantex-cli/compare/v0.12.1...v0.13.0) (2026-05-02)


### Features

* add passive self-upgrade notice ([a37960a](https://github.com/Drswith/quantex-cli/commit/a37960aec269c880e5dcc4e035bee64fa0f68086))


### Bug Fixes

* **runtime:** exclude post-run work from --timeout race ([#168](https://github.com/Drswith/quantex-cli/issues/168)) ([cad1086](https://github.com/Drswith/quantex-cli/commit/cad1086546f2c1f8de3fe24eb6f572f345ad1fd7))

## [0.12.1](https://github.com/Drswith/quantex-cli/compare/v0.12.0...v0.12.1) (2026-05-01)


### Bug Fixes

* make managed CLI runtime Node-compatible ([#160](https://github.com/Drswith/quantex-cli/issues/160)) ([792c9eb](https://github.com/Drswith/quantex-cli/commit/792c9eb57f47855e63346d7273b5ba99dce7dee9))

## [0.12.0](https://github.com/Drswith/quantex-cli/compare/v0.11.0...v0.12.0) (2026-04-30)


### Features

* **agents:** add autohand code cli support ([652fc9a](https://github.com/Drswith/quantex-cli/commit/652fc9a5502a71958cd3a5c7f40025db080c9740))
* **agents:** add Devin for Terminal support ([e24379e](https://github.com/Drswith/quantex-cli/commit/e24379e95913b79550e2908dbe244fb415866a92))
* **agents:** add OpenHands CLI support ([d7d077e](https://github.com/Drswith/quantex-cli/commit/d7d077eaf3bf88c5aaae0be8c6a4010e2a7aa613))


### Bug Fixes

* **ci:** remove stray openhands references from autohand PR ([5c2c1cb](https://github.com/Drswith/quantex-cli/commit/5c2c1cb0473909cec17171aa9e22b203ecc92c34))

## [0.11.0](https://github.com/Drswith/quantex-cli/compare/v0.10.0...v0.11.0) (2026-04-30)


### Features

* **agent-catalog:** add Mistral Vibe support ([9750cd6](https://github.com/Drswith/quantex-cli/commit/9750cd69b3f8a1fae0da50265e4e2eeca547eaa1))
* **agents:** add auggie cli support ([21cf7d9](https://github.com/Drswith/quantex-cli/commit/21cf7d90e75c70ea53966a7f436b29b76ef1f5d9))
* **agents:** add CodeBuddy CLI support ([c70b92b](https://github.com/Drswith/quantex-cli/commit/c70b92be40c34b05dad8aad3e053ae34b0e3325e))
* **agents:** add Junie CLI support ([4a0cd65](https://github.com/Drswith/quantex-cli/commit/4a0cd6557f8d1065a6965f2d73dd720d6bc3dd06))

## [0.10.0](https://github.com/Drswith/quantex-cli/compare/v0.9.0...v0.10.0) (2026-04-30)


### Features

* **agents:** add Amp agent support ([7a2b853](https://github.com/Drswith/quantex-cli/commit/7a2b8531244e088f4e1e2fc24bf8bccf16b1323b))


### Bug Fixes

* **openspec:** use ADDED Requirements header in Amp spec delta ([1f029cd](https://github.com/Drswith/quantex-cli/commit/1f029cd442fc9ff6469aef1233edc51b927dabf7))

## [0.9.0](https://github.com/Drswith/quantex-cli/compare/v0.8.0...v0.9.0) (2026-04-30)


### Features

* **agents:** add Kiro CLI support ([3d7f676](https://github.com/Drswith/quantex-cli/commit/3d7f676c61f7e28135b214d9bc5c1c910f904c1b))


### Bug Fixes

* **agents:** remove unofficial winget install method for Kiro CLI ([83d2de9](https://github.com/Drswith/quantex-cli/commit/83d2de9d312c0fc4d020bab13c989b6755aa1cb3))

## [0.8.0](https://github.com/Drswith/quantex-cli/compare/v0.7.0...v0.8.0) (2026-04-30)


### Features

* **agents:** add ForgeCode agent support ([fecbefa](https://github.com/Drswith/quantex-cli/commit/fecbefa5088980755fd99711028065b2574a122d))

## [0.7.0](https://github.com/Drswith/quantex-cli/compare/v0.6.0...v0.7.0) (2026-04-30)


### Features

* **agents:** add Goose agent support ([#140](https://github.com/Drswith/quantex-cli/issues/140)) ([7529249](https://github.com/Drswith/quantex-cli/commit/7529249a939c700b2560c7c0d87d1bf3907ef100))

## [0.6.0](https://github.com/Drswith/quantex-cli/compare/v0.5.0...v0.6.0) (2026-04-29)


### Features

* **agents:** add Crush agent support ([#131](https://github.com/Drswith/quantex-cli/issues/131)) ([a8effef](https://github.com/Drswith/quantex-cli/commit/a8effef89ef5915da074c40efa47d5bd7743bfe9))
* **agents:** add Kimi Code CLI support ([#132](https://github.com/Drswith/quantex-cli/issues/132)) ([0ea489d](https://github.com/Drswith/quantex-cli/commit/0ea489ddd0b1c3a37350870d85f03ce8dc9fe690))


### Bug Fixes

* **agent-catalog:** align supported agent naming ([#121](https://github.com/Drswith/quantex-cli/issues/121)) ([1f0bc7d](https://github.com/Drswith/quantex-cli/commit/1f0bc7d444ca1fcca4f0d9d797858f9bf5b14d86))
* propagate modal sandbox failures ([43eb02d](https://github.com/Drswith/quantex-cli/commit/43eb02d52dadfef08b7fc7afc5f0d0b1b19b0e91))

## [0.5.0](https://github.com/Drswith/quantex-cli/compare/v0.4.7...v0.5.0) (2026-04-29)


### Features

* add Qwen Code agent support ([#116](https://github.com/Drswith/quantex-cli/issues/116)) ([234db8d](https://github.com/Drswith/quantex-cli/commit/234db8ded48e384e219be65d08cbcf817bc6a512))

## [0.4.7](https://github.com/Drswith/quantex-cli/compare/v0.4.6...v0.4.7) (2026-04-28)


### Bug Fixes

* **agent-update:** verify self-update version changes ([#105](https://github.com/Drswith/quantex-cli/issues/105)) ([28990de](https://github.com/Drswith/quantex-cli/commit/28990de8de9c6250b585ae109cf5acb72d25c201))

## [0.4.6](https://github.com/Drswith/quantex-cli/compare/v0.4.5...v0.4.6) (2026-04-28)


### Bug Fixes

* **self-upgrade:** remove managed postinstall hook ([#102](https://github.com/Drswith/quantex-cli/issues/102)) ([ece1930](https://github.com/Drswith/quantex-cli/commit/ece19302374f97fb5da60c3821ee3856c8229161))

## [0.4.5](https://github.com/Drswith/quantex-cli/compare/v0.4.4...v0.4.5) (2026-04-28)


### Bug Fixes

* **agent-update:** adopt untracked existing installs ([#99](https://github.com/Drswith/quantex-cli/issues/99)) ([b6f12b9](https://github.com/Drswith/quantex-cli/commit/b6f12b95aef6a11d3a83f08349817710fe955cf5))

## [0.4.4](https://github.com/Drswith/quantex-cli/compare/v0.4.3...v0.4.4) (2026-04-28)


### Bug Fixes

* **config:** upgrade commander and remove c12 ([#95](https://github.com/Drswith/quantex-cli/issues/95)) ([6718b9b](https://github.com/Drswith/quantex-cli/commit/6718b9b24f06c39c8e803e683ff2b292c8a7ae93))

## [0.4.3](https://github.com/Drswith/quantex-cli/compare/v0.4.2...v0.4.3) (2026-04-28)


### Bug Fixes

* **release:** exclude standalone binaries from managed package ([#91](https://github.com/Drswith/quantex-cli/issues/91)) ([73e9e09](https://github.com/Drswith/quantex-cli/commit/73e9e09d2828b807e67fdc4c2720184ba1feb96a))

## [0.4.2](https://github.com/Drswith/quantex-cli/compare/v0.4.1...v0.4.2) (2026-04-28)


### Bug Fixes

* **update:** skip untracked path agents in update-all ([#89](https://github.com/Drswith/quantex-cli/issues/89)) ([6db58aa](https://github.com/Drswith/quantex-cli/commit/6db58aa75226b28fd7835d061842ff66b9afb75f))

## [0.4.1](https://github.com/Drswith/quantex-cli/compare/v0.4.0...v0.4.1) (2026-04-28)


### Bug Fixes

* align self-upgrade with managed registries ([165c2cc](https://github.com/Drswith/quantex-cli/commit/165c2cc6fe08e45635869c5960592bb34674f9c0))

## [0.4.0](https://github.com/Drswith/quantex-cli/compare/v0.3.0...v0.4.0) (2026-04-27)


### Features

* **agent-catalog:** add qoder cli support ([#55](https://github.com/Drswith/quantex-cli/issues/55)) ([43fc8a8](https://github.com/Drswith/quantex-cli/commit/43fc8a81f41b3ed0837cd7d7297899dadfc20ba6))

## [0.3.0](https://github.com/Drswith/quantex-cli/compare/v0.2.2...v0.3.0) (2026-04-27)


### Features

* **agent:** add Kilo Code CLI support ([#48](https://github.com/Drswith/quantex-cli/issues/48)) ([220957f](https://github.com/Drswith/quantex-cli/commit/220957ff44900ccafe63a2b552534ebfa25b556d))

## [0.2.2](https://github.com/Drswith/quantex-cli/compare/v0.2.1...v0.2.2) (2026-04-27)


### Bug Fixes

* **capabilities:** show yes flag in human output ([2eac7aa](https://github.com/Drswith/quantex-cli/commit/2eac7aa99c5a5bdd997fb950c483a8541bc439a6))

## [0.2.1](https://github.com/Drswith/quantex-cli/compare/v0.2.0...v0.2.1) (2026-04-23)


### Bug Fixes

* **release:** harden artifact matrix validation ([396560a](https://github.com/Drswith/quantex-cli/commit/396560a26a675201a66cbaf07b8169654a818ae9))

## [0.2.0](https://github.com/Drswith/quantex-cli/releases/tag/v0.2.0) (2026-04-23)

Initial release-please baseline. The full release notes for this already-published version are available on [GitHub Releases](https://github.com/Drswith/quantex-cli/releases/tag/v0.2.0).
