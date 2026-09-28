import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("admin user access page keeps its scoped simplified workflow and structural boundaries", async () => {
  const page = await read("app/admin/users/page.tsx");
  const baseCss = await read("app/admin/users/admin-users-page.module.css");
  const polishCss = await read("app/admin/users/admin-users-polish.module.css");
  const controller = await read("components/pwa-admin-users-page.tsx");
  const panels = await read("components/admin-users/admin-user-panels.tsx");
  const codesPanel = await read("components/admin-users/admin-access-code-panel.tsx");
  const redemptionHistory = await read("components/admin-users/admin-access-code-redemption-history.tsx");
  const view = await read("lib/admin-users-view.ts");
  const adminUsers = await read("lib/pwa-admin-users.ts");
  const activeUi = `${controller}\n${panels}\n${codesPanel}`;

  assert.match(page, /admin-users-page\.module\.css/);
  assert.match(page, /admin-users-polish\.module\.css/);
  assert.match(page, /styles\.scope/);
  assert.match(page, /polish\.polish/);
  assert.match(page, /<Phase10AdminPage \/>/);

  for (const className of [
    "admin-dashboard",
    "admin-card",
    "admin-user-list",
    "admin-form-grid",
    "admin-actions",
    "admin-entitlement-list",
    "admin-invite-list",
  ]) {
    assert.match(baseCss, new RegExp(`:global\\(\\.${className}`));
  }

  for (const className of [
    "admin-simple-stats",
    "admin-step-number",
    "admin-filter-row",
    "status-chip",
    "admin-simple-actions",
    "admin-action-card",
    "admin-advanced-details",
    "admin-user-details-drawer",
    "admin-tools-drawer",
    "admin-empty-state",
  ]) {
    assert.match(polishCss, new RegExp(`:global\\(\\.${className}`));
  }

  assert.match(controller, /PWAユーザー利用管理/);
  assert.match(controller, /PWA利用権はPC・スマホ・タブレット共通です/);
  assert.match(controller, /端末ごとの承認や追加の利用権付与は必要ありません/);
  assert.match(controller, /AdminUserSelectionPanel/);
  assert.match(controller, /AdminSelectedUserPanel/);
  assert.match(controller, /AdminAccessCodePanel/);
  assert.doesNotMatch(controller, /USER_FILTERS|STATUS_LABELS|formatAdminDate/);

  assert.match(panels, /まず操作したいユーザーを選択します/);
  assert.match(panels, /通常の管理は「アカウント」「PWA利用権」「Creator Club特典」の3項目だけです/);
  assert.match(panels, /PWA利用権を付与する/);
  assert.match(panels, /全端末で利用可能/);
  assert.match(panels, /期限や付与元を指定する/);
  assert.match(panels, /期限・確認メモを設定する/);
  assert.match(panels, /note購入状態の自動取得は行わず/);
  assert.match(codesPanel, /通常のユーザー管理では、この機能を操作する必要はありません/);
  assert.match(codesPanel, /販売用PWA利用コード/);
  assert.match(codesPanel, /AdminAccessCodeRedemptionHistory/);
  assert.match(redemptionHistory, /利用コード使用履歴/);
  assert.match(redemptionHistory, /購入者のAAS ID/);
  assert.match(redemptionHistory, /メール・請求情報は表示しません/);
  assert.match(controller, /listPwaInviteRedemptions/);
  assert.match(controller, /利用コードをコピーしました/);

  assert.doesNotMatch(activeUi, /Windowsアプリ版|既存Windows機能|AAS-WIN-BETA/);
  assert.doesNotMatch(`${panels}\n${codesPanel}\n${redemptionHistory}`, /getSupabaseClient|setPwaAdminUserStatus\(|grantPwaEntitlement\(|revokePwaEntitlement\(|createPwaAccessCode\(|revokePwaAccessCode\(/);
  assert.match(controller, /getSupabaseClient/);
  assert.match(controller, /setPwaAdminUserStatus/);
  assert.match(controller, /grantPwaEntitlement/);
  assert.match(controller, /createPwaAccessCode/);

  assert.match(controller, /const selectedIdRef = useRef\(""\)/);
  assert.match(controller, /const refresh = useCallback/);
  assert.doesNotMatch(controller, /\[refreshSelectedEntitlements, selectedId\]/);
  assert.match(controller, /const refreshNow = async/);
  assert.doesNotMatch(controller, /runMutation\(refresh/);

  assert.match(view, /filterAdminUsers/);
  assert.match(view, /summarizeAdminUsers/);
  assert.match(view, /summarizeAccessCodes/);
  assert.match(adminUsers, /export const PWA_PRODUCT = "AAS-PWA-BETA" as const/);
  assert.match(adminUsers, /admin_list_pwa_invite_redemptions/);
  assert.match(adminUsers, /export type PwaInviteRedemption/);
  assert.doesNotMatch(adminUsers, /PWA_(?:PC|MOBILE)_PRODUCT/);

  assert.match(baseCss, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(baseCss, /@media \(max-width: 760px\)/);
  assert.match(baseCss, /padding-bottom: 102px/);
  assert.match(polishCss, /@media \(max-width: 760px\)/);
});
