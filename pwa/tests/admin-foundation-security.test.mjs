import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("all /admin routes keep the active-admin boundary while MFA is temporarily optional", () => {
  const layout = read("app/admin/layout.tsx");
  const guard = read("components/admin-route-guard.tsx");

  assert.match(layout, /AdminRouteGuard/);
  assert.match(layout, /<AdminRouteGuard>\{children\}<\/AdminRouteGuard>/);
  assert.match(guard, /accessState\.profile\.role !== "admin" \|\|[\s\S]*?accessState\.profile\.status !== "active"/);
  assert.match(guard, /ADMIN_MFA_REQUIRED = false/);
  assert.match(guard, /if \(!ADMIN_MFA_REQUIRED\)/);
  assert.match(guard, /setGate\(\{ kind: "ready" \}\)/);
  assert.match(guard, /auth\.mfa\.listFactors\(\)/);
  assert.match(guard, /factor\.status === "verified"/);
  assert.match(guard, /auth\.mfa\.getAuthenticatorAssuranceLevel\(\)/);
  assert.match(guard, /aal\.currentLevel !== "aal2"/);
  assert.match(guard, /auth\.mfa\.enroll\(\{/);
  assert.match(guard, /factorType: "totp"/);
  assert.match(guard, /auth\.mfa\.challenge\(\{ factorId \}\)/);
  assert.match(guard, /auth\.mfa\.verify\(\{/);
  assert.match(guard, /gate\.kind === "ready"/);
  assert.match(guard, /このページを表示する権限がありません/);
});

test("admin MFA enrollment recovers from interrupted unverified primary factors", () => {
  const guard = read("components/admin-route-guard.tsx");

  assert.match(guard, /ADMIN_MFA_FRIENDLY_NAME = "AAS PWA Admin"/);
  assert.match(guard, /factor\.status !== "verified"/);
  assert.match(guard, /factor\.friendly_name === ADMIN_MFA_FRIENDLY_NAME/);
  assert.match(guard, /auth\.mfa\.unenroll\(\{ factorId: factor\.id \}\)/);
  assert.match(guard, /スマホ1台だけで設定する場合/);
  assert.match(guard, /セットアップキー/);
  assert.match(guard, /設定をキャンセル/);
});

test("database admin boundary temporarily allows active admins without AAL2", () => {
  const migration = read("../supabase/migrations/20260917073000_pwa_admin_mfa_temporarily_optional.sql");

  assert.match(migration, /create or replace function private\.is_active_admin\(\)/i);
  assert.match(migration, /role = 'admin'/);
  assert.match(migration, /status = 'active'/);
  assert.doesNotMatch(migration, /auth\.jwt\(\)->>'aal'/);
  assert.doesNotMatch(migration, /= 'aal2'/);
  assert.match(migration, /Re-enable the AAL2 condition before public production launch/);
});

test("admin dashboard content is deferred until active-admin state is known", () => {
  const home = read("app/admin/page.tsx");

  assert.match(home, /"use client"/);
  assert.match(home, /useSharedAccessState/);
  assert.match(home, /state\.kind === "ready"/);
  assert.match(home, /state\.profile\.role === "admin"/);
  assert.match(home, /state\.profile\.status === "active"/);
  assert.match(home, /if \(!activeAdmin\) return null/);
});

test("admin home is navigation-only and sections are centralized", () => {
  const home = read("app/admin/page.tsx");
  const users = read("app/admin/users/page.tsx");
  const registry = read("lib/admin-sections.ts");

  assert.doesNotMatch(home, /Phase10AdminPage/);
  assert.match(home, /ADMIN_SECTION_GROUPS\.map/);
  assert.match(home, /ADMIN_SECTIONS\.filter/);
  for (const route of [
    "/admin/users",
    "/admin/membership",
    "/admin/free-trial",
    "/admin/sales",
    "/admin/promotion",
    "/admin/knowledge",
    "/admin/infrastructure",
    "/admin/operations",
  ]) {
    assert.match(registry, new RegExp(route.replaceAll("/", "\\/")));
  }
  assert.match(users, /Phase10AdminPage/);
});

test("public home admin shortcut stays hidden until active-admin state is verified", () => {
  const topbar = read("components/admin-home-topbar.tsx");

  assert.match(topbar, /useSharedAccessState\(\)/);
  assert.match(topbar, /state\.kind === "ready" && state\.profile\.role === "admin" && state\.profile\.status === "active"/);
  assert.match(topbar, /pathname !== "\/" \|\| !admin\) return null/);
  assert.match(topbar, /ADMIN_HOME_SHORTCUT_IDS/);
});

test("admin tools use shared choice-first controls with free-input fallback", () => {
  const controls = read("components/admin-form-controls.tsx");
  const users = read("components/pwa-admin-users-page.tsx");
  const userPanels = read("components/admin-users/admin-user-panels.tsx");
  const accessCodes = read("components/admin-users/admin-access-code-panel.tsx");
  const freePlan = read("components/free-trial-admin-panel.tsx");
  const operations = read("components/operations-admin-page.tsx");
  const releases = read("components/admin-release-page.tsx");
  const knowledge = read("components/admin-knowledge-page.tsx");
  const promotionFields = read("components/admin-promotion/admin-promotion-fields.tsx");
  const hub = read("app/admin/page.tsx");
  const sections = read("lib/admin-sections.ts");

  assert.match(controls, /AdminSelectWithCustom/);
  assert.match(controls, /その他・自由入力/);
  assert.match(controls, /AdminPresetNumberField/);
  assert.match(controls, /AdminSimpleSelect/);

  assert.match(users, /AdminUserSelectionPanel/);
  assert.match(users, /AdminSelectedUserPanel/);
  assert.match(users, /AdminAccessCodePanel/);
  assert.match(accessCodes, /SelectWithCustom/);
  assert.match(accessCodes, /PresetNumberSelectWithCustom/);
  assert.match(accessCodes, /label="販売チャネル"/);
  assert.match(accessCodes, /label="最大利用回数"/);
  assert.match(userPanels, /CREATOR_MEMBERSHIP_PLANS/);

  assert.match(freePlan, /AdminPresetNumberField/);
  assert.match(freePlan, /RESET_TIMEZONE_OPTIONS/);
  assert.match(freePlan, /RESET_HOUR_OPTIONS/);

  assert.match(operations, /AdminSelectWithCustom/);
  assert.match(operations, /PLAN_OPTIONS/);
  assert.match(operations, /WARNING_PERCENT_OPTIONS/);
  assert.match(operations, /const monitoringReady = snapshot !== null && worker !== null/);
  assert.match(operations, /const overall = !monitoringReady/);

  assert.match(releases, /AdminSelectWithCustom/);
  assert.match(releases, /RELEASE_TITLE_OPTIONS/);
  assert.match(knowledge, /AdminPresetNumberField/);
  assert.match(promotionFields, /AdminSelectWithCustom/);

  for (const label of ["日常の管理", "販売・告知", "制作・開発支援", "システム・安全管理"]) {
    assert.match(sections, new RegExp(label));
  }
  assert.match(hub, /管理ツールの使い方/);
  assert.match(hub, /ADMIN_SECTION_GROUPS\.map/);
  assert.match(hub, /section\.group === group\.id/);
});
