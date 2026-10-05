# AAS Private Repository / General User Audit — 2026-10-05

## Scope

This audit protects ordinary AAS users while preparing the source repository for a future Private transition. It does **not** change GitHub visibility, Production database schema, Production Edge Functions, Canary, or the general-public PWA.

## Verified baseline

- Repository: `haruharu42/AIActionStudio-Updates`
- Baseline main: `08a4e8a87d023d12c8caed788cdec549d56aaac8`
- Baseline main Preview workflow: success
- Production Supabase: `nwttfmjsgzpjqqubxbff` / ACTIVE_HEALTHY
- Staging Supabase: `swwbfrhvsvouiwobodwh` / ACTIVE_HEALTHY
- Production release Worker: ACTIVE v7, token-authenticated GitHub API access to the renamed repository
- Production public build observed during audit: `BB3CB9A`
- Preview build observed during audit: `08A4E8A`

## General-user UI findings

Read-only browser checks covered desktop 1440×900, mobile 390×844, and narrow mobile 320×568.

- No horizontal overflow or clipped public cards was reproduced.
- No obvious dead public routes were reproduced for login/legal/plans/support surfaces.
- Public commerce/legal/support body copy used multiple 8–11px rules and was unnecessarily difficult to read.
- Article Library duplicate-quota notice styling was accidentally nested beneath `.library-stock-summary.reached`; the notice is rendered as a sibling, so the intended card styling could be lost.
- A cloud Linux browser rendered Japanese glyphs as replacement/box characters. This must be treated as a font-environment diagnostic until DOM/encoding verification proves source corruption; no webfont is added solely from that observation.

## Prompt audit

The current article flow preserves these contracts:

- exactly five title candidates;
- article body does not repeat the selected title and does not use H1;
- output is article body only;
- paid marker is exactly one `<!-- PAID_AREA -->` when required;
- image insertion markers are ordered and validated;
- image prompts prohibit temporary chat, request separate images rather than a collage, and preserve a shared world/style;
- runtime prompt optimization rules are lower priority than explicit user instructions, factuality constraints, and absolute task rules.

Production prompt-optimization catalog and stable catalog both currently contain one v2 rule set for each of ChatGPT, Claude, and Gemini. Knowledge scheduling is enabled, while AI enrichment remains disabled.

## Private-repository readiness

The current Production `pwa-release-deploy` Worker uses `AAS_GITHUB_RELEASE_TOKEN` and sends authenticated Bearer requests to GitHub for:

- repository readiness;
- Canary workflow reads/dispatch;
- public workflow reads/dispatch;
- commit/run verification.

This design can work with a Private repository **only if the configured token continues to have access to the Private repository and required Actions permissions**.

The repository visibility must not be changed until all of these gates pass:

1. CI for the private-readiness regression changes.
2. Preview deployment and desktop/mobile UI re-audit.
3. Authenticated admin `github_readiness` returns repository/workflow readable after private-access permissions are prepared.
4. Windows updater/public distribution dependency is separated or explicitly proven unaffected.
5. Production Canary from the exact approved Preview SHA succeeds.
6. General-public promotion remains a separate explicit approval.

## Windows compatibility hold

Existing Windows candidate/stable manifests in this repository still reference immutable package URLs under the legacy public `AIArticleStudio-Updates` distribution repository. Do not make that distribution path private as part of the PWA source-repository transition until Windows update lookup and package download are separately verified.

## Supabase audit notes

- Production and Staging are healthy.
- Production security advisor currently reports `pg_net` in the public schema and many callable SECURITY DEFINER functions. These are audit items, not automatic-fix items: several AAS RPCs intentionally implement guarded privileged operations and must be reviewed function-by-function before any grant or schema change.
- No Production DDL, grant, migration, secret, or Edge Function change was made by this audit.

## Current change set

- Repair Article Library quota-notice CSS nesting.
- Raise readability on public plans / legal / support surfaces without changing their responsive grid structure.
- Add regression tests for the UI fixes, core prompt contracts, and token-authenticated private-repository release path.

## Production hold

Do not perform the following without explicit approval after Preview/Canary validation:

- switch GitHub repository visibility to Private;
- Production DB migration or grant change;
- Production Edge Function deployment;
- general-public PWA release;
- enable AI enrichment/automatic AI analysis.
