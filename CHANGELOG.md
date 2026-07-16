# Changelog

This changelog is maintained by release-please Release PRs.

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
