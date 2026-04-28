## Context

Quantex already maintains both Chinese and English README content, but the root `README.md` is Chinese, which means GitHub and npm users see Chinese first. The repository also has lightweight project-memory checks and contributor guidance that assume the bilingual pair is `README.md` plus `README.en.md`.

## Goals / Non-Goals

**Goals:**

- Make the repository landing page English-first for international audiences.
- Keep Simplified Chinese documentation discoverable from the top of the product README.
- Preserve a stable repo-native pointer for Chinese readers and update local checks to match the new layout.

**Non-Goals:**

- Rewriting the product story or command examples beyond the language-entry change.
- Changing CLI behavior, structured output, or release/distribution flows.

## Decisions

- Root `README.md` becomes the canonical English product README because GitHub and npm default to that filename.
  Alternative considered: keep `README.md` in Chinese and only move the language switch higher. Rejected because it still leaves the default landing page Chinese-first.
- Add `README.zh-CN.md` as the dedicated Simplified Chinese entry point.
  Alternative considered: rename the Chinese page to `README.cn.md`. Rejected because `zh-CN` is clearer and more standard for locale-specific content.
- Keep `README.en.md` as a lightweight compatibility shim that points readers to `README.md`.
  Alternative considered: delete `README.en.md` immediately. Rejected because existing docs, specs, and external links may still reference it.
- Update repo-native checks and documentation pointers in the same change so the new README topology is internally consistent.

## Risks / Trade-offs

- Existing links may still point to `README.en.md` -> Mitigation: keep a compatibility shim instead of removing the file outright.
- Three root README files increase documentation surface area -> Mitigation: make `README.md` and `README.zh-CN.md` the only full documents and keep `README.en.md` intentionally minimal.
- Localized content can drift over time -> Mitigation: keep visible language switches in both full READMEs and document the new canonical entry points in OpenSpec.
