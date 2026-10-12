# dt-exp integration verification

Desktop application integration, 2026-10-12.

## Baseline and scope

`dt-exp` starts from latest local `dev`, `3cbecb247`. Its tree was verified byte-for-byte equal to the earlier local-dev snapshot `172a4d49b`; the feature commit was replayed onto the actual dev commit. Work continues in `/Users/frank/HKUDS/DeepTutor`.

The production app uses its existing pages, stores, settings and agent engine. Four sidebar categories group Home, Partners, Learning and Resources. Category switches preserve the working page. Learning creation opens the original feature flows. The former `/preview` remains a separate prototype reference with isolated fixtures; production routes do not use its transport.

## Data compatibility

- No storage-schema migration, record-ID rewrite, directory relocation, or destructive data conversion was introduced by the navigation change.
- Learning navigation reads each existing workspace and preserves its origin on every link. Duplicate book/question IDs in separate workspaces remain separate records.
- Practice navigation reads compact question metadata through the existing recycle predicate; answers, attempt state and attachments remain in their original store.
- Partner and group navigation uses existing visibility and actor-scoped session stores. Archived transcripts remain available in original history pages.
- Session selection uses the existing continuity API; explicit manual changes update the URL so refresh resumes the selected session.
- Learning-account restrictions remain enforced. The additive aggregate GET filters each allowed source before reading it; other dashboard operations stay gated.
- Original settings, history organization, rename/pin/archive operations, workspaces, reading state and feature detail views remain available.

## Runtime separation

Preview: `http://127.0.0.1:4180/chat`; API: `http://127.0.0.1:8016`.
All browser verification used `DEEPTUTOR_HOME=/tmp/deeptutor-dt-exp-runtime`, separate from normal user data. Test records are named with 验证. No credentials or user library were copied into this runtime. It has no configured LLM, so live generation/provider behavior was not exercised.

## Browser verification

Verified against a production build, with desktop layouts at 1280 and 1440 CSS pixels:

- Four-category switching preserves open work; real category lists load from the API.
- Original Settings sections remain complete; switching the isolated UI language to Chinese and applying changes succeeds.
- Resources retains history, notebooks, journal, questions, knowledge bases, personas, skills, MCP, CLI apps and memory.
- A reading collection created in the UI persists and can be reopened from Learning after reload.
- Existing practice record opens the original exercise UI; submitting its correct answer shows the original grading result.
- Books and Mastery creation open the original configuration/source-selection workflows.
- Partner navigation opens an existing JSONL transcript with its original body. Configure remains complete.
- Group session deep links select the exact stored discussion and load its history.
- Task Board creates a real card and persists its move into Doing.
- Co-Writer creates a real draft, edits Markdown, updates the preview, and reports saved state.
- Dito defaults to Auto while retaining the original manual capability menu.

Evidence: `dt-exp-practice.png`, `dt-exp-partners.png`, `dt-exp-writer.png` and `dt-exp-home.png` in this directory. Older JPGs document the earlier frontend prototype, not the integrated application's data.

## Automated verification

- Full WebUI Vitest baseline: 149 files, 663 tests passed; new session/navigation regression tests were additionally run after integration fixes.
- Node suite: 1,303 tests passed.
- Backend workspace + multi-user suites: 474 tests passed; after adding the HTTP policy regression, the focused compatibility/policy suite passed all 7 tests.
- Type checking, API contract regeneration/check, dependency architecture, i18n checks and Ruff passed.
- Full ESLint has no errors; existing and prototype translation warnings remain.
- Production build succeeds; all existing route JS budgets pass after deferring unused sidebar panels/history code. Budgets were not raised.

## Known limits

Model-backed generation, external channels and integrations require their normal configuration and were not live-tested in the isolated runtime. This iteration uses the existing chat/tool loop for Auto; it does not claim to add a new cross-capability autonomous planning engine. Mobile refinement was explicitly deferred by the user.
