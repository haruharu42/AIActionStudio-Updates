# PWA Structure Boundaries

AI Action Studio PWA keeps responsibilities separated so UI changes, business logic changes, and access-control changes can be reviewed independently.

## Runtime boundaries

- `app/`: route entry points and route-level composition only.
- `components/`: interactive UI and presentation components.
- `components/phase6-app.tsx`: authentication/access shell; when access becomes ready inside the current home flow, it hands control back instead of rendering the legacy dashboard.
- `components/phase18-beginner-home.tsx`: current PWA home; owns the ready dashboard and stable auth-state refresh subscription.
- `components/article-create/`: article-creation step UI; no direct profile or entitlement queries.
- `components/action-prompt-library/`: prompt-library presentation panels; receives catalog state and callbacks without owning persistence or Supabase access.
- `components/action-prompt-library-page.tsx`: prompt-library controller; owns catalog merge, filtering, route selection, local progress/favorites/recent orchestration, clipboard handoff, and messages.
- `components/article-create/magazine-planner.tsx`: dropdown-first note magazine planning UI; receives draft state and callbacks only.
- `components/aas-reference-shell.tsx`: shared AAS header and five-item reference bottom navigation for the primary mobile surfaces.
- `components/article-library/`: article-library list, detail, and editor presentation; receives data and callbacks without owning Supabase operations.
- `components/phase7-library.tsx`: article-library controller; owns paging, detail loading, mutation orchestration, async request ordering, and image/tool composition.
- `components/admin-users/`: admin user-management presentation panels; callbacks only, with no direct Supabase mutation ownership.
- `components/pwa-admin-users-page.tsx`: admin user-management controller; owns loading, selection, mutation orchestration, refresh, and messages.
- `components/admin-infrastructure-usage-page.tsx`: active-admin infrastructure dashboard; combines the existing admin-only Supabase capacity RPC with read-only public GitHub usage endpoints.
- `lib/infrastructure-usage.ts`: pure-ish infrastructure usage adapter; owns GitHub plan allowances, public repository/Actions usage parsing, pricing-reference constants, and Supabase plan reference text.
- `features/prompts/`: public prompt-domain boundary used by new UI; re-exports catalog, preferences, routing, and service contracts while legacy `lib/` paths remain compatible.
- `features/tools/`: feature-directory catalog boundary. Owns genre grouping and links for the user-facing 機能一覧 so the home hub does not duplicate side-hustle definitions.
- `features/side-hustles/`: dedicated side-hustle domain. Each side-hustle owns its own dropdown schema, custom-input fallbacks, knowledge task, prompt template, progress state, and AI-result round trip. Shared code is limited to wizard mechanics and prompt/knowledge composition.
- `components/side-hustles/`: presentation-only controls for the dedicated side-hustle wizard. Dropdown/custom-input fields, step rail, final prompt review, and AI-result capture are split into focused components; the parent page owns only state, navigation, persistence, clipboard orchestration, and external-AI handoff.
- `app/phase53-crystal-ui.css`: final AAS crystal visual layer for signed-in and signed-out surfaces. Owns Axia/Rumo hero treatment, auth/status presentation, responsive PC/mobile navigation styling, form-control appearance, and admin/tool surface theming without owning auth, route, RLS, or business logic.
- `public/aas-axia-rumo-hero.svg`: local lightweight embedded-WebP key visual for the finalized AAS character pair, Axia and the small dragon mascot Rumo; presentation-only with no remote asset dependency or executable content.
- Phase 53 home ordering is intentional: Creator/user status and the article-library area stay above the Axia/Rumo hero, while `よく使う機能` stays in the lower home section. Desktop home may use the preview-style side dock; mobile keeps the five-item bottom navigation.
- `lib/access-control.ts`: authenticated profile validation and authoritative PWA entitlement checks.
- `lib/admin-users-view.ts`: pure admin-user filtering, labels, date formatting, and summary calculations.
- `lib/article-create-draft.ts`: pure article-draft defaults, URL parsing, tag parsing, step validation, and restored-draft validation.
- `lib/magazine-planner.ts`: pure magazine defaults, option labels, local structure suggestions, and restored-plan validation.
- `lib/article-library-view.ts`: pure article-library filters, labels, edit parsing/validation, archive status reconstruction, and display helpers.
- `lib/phase11-create.ts`: article creation business/persistence contract.
- `lib/phase11-wizard-progress.ts`: browser progress persistence; restored data must pass `parseStoredArticleDraft` before use.
- `lib/phase6-access.ts`: product access orchestration, including optional free-trial bootstrap, built on the shared access-control boundary.
- `lib/session-request-loader.ts`: deduplicates access checks within one auth session and discards responses/errors invalidated by sign-out or account changes.
- `lib/note-schedule-persistence.ts`: validates replacement inputs and calls the owner-checked atomic schedule RPC. Never restore the old browser-side delete/insert fallback.
- `lib/csv-records.ts`: parses CSV records including quoted newlines; no UI or database dependency.
- `lib/notification-path.ts`: validates root-relative notification destinations. The standalone service worker applies the same boundary again on click, including notifications created by older versions.

## Rules for new work

1. UI components must not duplicate profile ownership or PWA entitlement RPC logic.
2. Product access checks go through `access-control.ts` or an orchestrator built on it.
3. Browser-stored data is untrusted and must be parsed before use.
4. Pure parsing/validation/filtering/formatting belongs in `lib/`, not inside page components.
5. Large workflow screens should keep orchestration in the parent and move independent visual steps/panels into focused components.
6. Presentation panels receive data and callbacks; they do not own Supabase mutation clients.
7. Refresh and loading orchestration stays in the controller so selection changes do not accidentally trigger duplicate full-page fetches.
8. Async list/detail controllers must ignore stale responses when a newer request supersedes them.
9. Authentication shells must hand successful access back to the current product surface instead of exposing retired or legacy dashboards.
10. Database/RLS/RPC changes remain separate from UI-only refactors unless a behavior change explicitly requires them.
11. Magazine planning metadata stays inside the existing article Workspace contract unless a future feature genuinely requires a database schema change.
12. New boundaries must be protected by regression tests before old code is removed.

This document describes the active PWA code organization only; it does not change database contracts or release infrastructure.


## Phase 45 feature-oriented structure

New development should prefer the `features/` boundary before reaching directly into legacy `lib/` files.

```text
pwa/
├─ app/                 # route entry points and route-level CSS
├─ components/          # reusable/view-controller UI
├─ features/            # product-domain import boundaries
│  ├─ article/
│  ├─ account-design/
│  ├─ note/
│  ├─ workflow/
│  ├─ social/
│  ├─ images/
│  ├─ presets/
│  ├─ prompts/
│  ├─ side-hustles/
│  ├─ tools/
│  ├─ support/
│  ├─ admin/
│  └─ navigation/
├─ lib/                 # legacy/shared implementation modules kept for compatibility
├─ tests/               # regression/contract tests
└─ worker/              # Cloudflare Worker integration
```

### Import direction

Preferred direction:

`app -> components -> features -> lib/shared infrastructure -> Supabase`

Feature modules may temporarily re-export legacy implementation from `lib/`.
This is intentional. It lets AAS move away from historical `phaseXX-*.ts` names without a risky mass rename in one release.

### Migration rule

1. New domain logic should be created under `features/<domain>/` when practical.
2. Existing stable `lib/` implementations are not deleted only to make the tree look cleaner.
3. A legacy module is moved only when its call sites and regression tests can be migrated in one small batch.
4. Old paths may remain as compatibility shims until the following release.
5. Security/auth/database boundaries stay independent of cosmetic folder moves.
6. Large feature moves require the same Typecheck, Lint, regression, Preview and RLS verification as behavior changes.

- Preview and Member Beta are separate Cloudflare Workers. Preview validation alone does not update the installed/member-beta AAS Worker. Every deployable build exposes `NEXT_PUBLIC_AAS_BUILD_SHA` in page metadata and visible UI so the running commit can be verified before release.
