import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("admin security route is protected by shared admin layout and supports backup TOTP", async () => {
  const [layout, route, page, sections, guard] = await Promise.all([
    read("app/admin/layout.tsx"),
    read("app/admin/security/page.tsx"),
    read("components/admin-security-page.tsx"),
    read("lib/admin-sections.ts"),
    read("components/admin-route-guard.tsx"),
  ]);

  assert.match(layout, /AdminRouteGuard/);
  assert.match(route, /AdminSecurityPage/);
  assert.match(sections, /href: "\/admin\/security"/);
  assert.match(page, /auth\.mfa\.listFactors\(\)/);
  assert.match(page, /auth\.mfa\.enroll\(/);
  assert.match(page, /factorType: "totp"/);
  assert.match(page, /auth\.mfa\.challenge\(/);
  assert.match(page, /auth\.mfa\.verify\(/);
  assert.match(page, /auth\.mfa\.unenroll\(/);
  assert.match(page, /verifiedFactors\.length <= 1/);
  assert.match(page, /最後のMFA認証器は削除できません/);
  assert.match(page, /このMFA認証器を削除しますか/);
  assert.doesNotMatch(page.match(/const verifyEnrollment = async \(\) => \{[\s\S]*?const removeFactor/)?.[0] ?? "", /このMFA認証器を削除しますか/);
  assert.match(page, /主端末とは別/);
  assert.match(page, /確認済みMFAがありません/);
  assert.match(page, /本番販売前にTOTP認証器を1個以上登録/);
  assert.match(page, /verifiedFactors\.length === 0 \? "MFA認証器を追加" : "予備認証器を追加"/);
  assert.match(page, /AAS PWA Admin MFA 1/);
  assert.match(page, /MFAを有効化/);
  assert.match(guard, /const ADMIN_MFA_REQUIRED = false/);
  assert.match(guard, /auth\.mfa\.getAuthenticatorAssuranceLevel\(\)/);
  assert.match(guard, /aal\.currentLevel !== "aal2"/);
  assert.match(guard, /kind: "mfa_challenge"/);
  assert.match(guard, /auth\.mfa\.challenge\(/);
  assert.match(guard, /auth\.mfa\.verify\(/);
  assert.match(guard, /管理者MFAが有効です。認証アプリの6桁コード/);
});

test("PWA admin section copy no longer advertises Windows entitlement management", async () => {
  const sections = await read("lib/admin-sections.ts");
  assert.match(sections, /PWA利用権/);
  assert.doesNotMatch(sections, /PWA \/ Windows利用権/);
});
