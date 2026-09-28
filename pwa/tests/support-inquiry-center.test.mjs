import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFile(path.join(root, relative), "utf8");
const readRepo = (relative) => readFile(path.join(root, "..", relative), "utf8");

test("inquiry center keeps immutable messages, owner/admin RLS, and server-side workflow controls", async () => {
  const [migration, hardening] = await Promise.all([
    readRepo("supabase/migrations/20260921010708_support_inquiry_center.sql"),
    readRepo("supabase/migrations/20260921011458_support_inquiry_rpc_hardening.sql"),
  ]);

  assert.match(migration, /create table if not exists public\.support_requests/);
  assert.match(migration, /create table if not exists public\.support_request_messages/);
  assert.match(migration, /alter table public\.support_requests force row level security/);
  assert.match(migration, /alter table public\.support_request_messages force row level security/);
  assert.match(migration, /support_requests_select_owner_or_admin/);
  assert.match(migration, /user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /private\.is_active_profile\(\)/);
  assert.match(migration, /private\.is_active_admin\(\)/);

  assert.match(migration, /grant select on table public\.support_requests to authenticated/);
  assert.match(migration, /grant select on table public\.support_request_messages to authenticated/);
  assert.doesNotMatch(migration, /grant (?:insert|update|delete).*support_requests to authenticated/i);
  assert.doesNotMatch(migration, /grant (?:insert|update|delete).*support_request_messages to authenticated/i);

  for (const fn of [
    "create_support_request",
    "reply_support_request",
    "mark_support_request_seen",
    "close_own_support_request",
    "admin_set_support_request",
    "get_support_notification_summary",
  ]) {
    assert.match(migration, new RegExp(fn));
  }

  assert.match(migration, /created_at >= now\(\) - interval '24 hours'/);
  assert.match(migration, /v_recent_count >= 10/);
  assert.match(migration, /v_recent_count >= 30/);
  assert.match(migration, /char_length\(v_message\) < 5/);
  assert.match(migration, /char_length\(body\) between 1 and 5000/);
  assert.match(migration, /status in \('new','reviewing','waiting_user','resolved','closed'\)/);
  assert.match(migration, /priority in \('normal','high','urgent'\)/);
  assert.match(hardening, /alter function public\.create_support_request\(text,text,text\) set schema private/);
  assert.match(hardening, /alter function public\.admin_set_support_request\(uuid,text,text\) set schema private/);
  assert.match(hardening, /create function public\.create_support_request/);
  assert.match(hardening, /language sql security invoker/);
  assert.match(hardening, /select private\.admin_set_support_request/);
  assert.doesNotMatch(`${migration}
${hardening}`, /service[_-]?role|sb_secret_|sk_(?:live|test)_|whsec_/i);
});

test("general users can submit categorized required inquiries and keep a reply history", async () => {
  const [lib, page, route, tools, toolCatalog, settings, nav] = await Promise.all([
    read("lib/support-center.ts"),
    read("components/user-inquiries-page.tsx"),
    read("app/inquiries/page.tsx"),
    read("components/phase-tools-page.tsx"),
    read("features/tools/tool-catalog.ts"),
    read("components/pwa-settings-page.tsx"),
    read("lib/mobile-nav-preference.ts"),
  ]);

  for (const label of ["追加機能要望", "不具合・エラー", "使い方・質問", "アカウント・利用権", "購入・支払い", "その他"]) {
    assert.match(lib, new RegExp(label));
  }
  assert.match(page, /問い合わせ内容 <b>必須<\/b>/);
  assert.match(page, /disabled=\{busy \|\| body\.trim\(\)\.length < 5\}/);
  assert.match(page, /受付番号/);
  assert.match(page, /問い合わせ履歴/);
  assert.match(page, /未読返信/);
  assert.match(page, /追加メッセージ/);
  assert.match(page, /問い合わせを終了/);
  assert.match(page, /パスワード、認証コード、アクセストークン、秘密鍵、カード番号/);
  assert.match(lib, /create_support_request/);
  assert.match(lib, /reply_support_request/);
  assert.match(lib, /mark_support_request_seen/);
  assert.match(lib, /close_own_support_request/);

  assert.match(route, /UserInquiriesPage/);
  assert.match(tools, /MEMBER_TOOL_GROUPS/);
  assert.match(toolCatalog, /href: "\/inquiries"/);
  assert.match(settings, /href="\/inquiries">お問い合わせ・返信確認/);
  assert.match(nav, /key: "inquiries".*href: "\/inquiries"/);
});

test("active admins get an inquiry inbox, admin-only nav choice, and home unread notifications", async () => {
  const [admin, adminRoute, sections, tools, nav, sharedNav, home, header, customizer] = await Promise.all([
    read("components/admin-inquiries-page.tsx"),
    read("app/admin/inquiries/page.tsx"),
    read("lib/admin-sections.ts"),
    read("components/phase-tools-page.tsx"),
    read("lib/mobile-nav-preference.ts"),
    read("components/shared-mobile-bottom-nav.tsx"),
    read("components/phase18-beginner-home.tsx"),
    read("components/aas-reference-shell.tsx"),
    read("components/mobile-nav-customizer.tsx"),
  ]);

  assert.match(adminRoute, /AdminInquiriesPage/);
  assert.match(sections, /id: "inquiries"/);
  assert.match(sections, /href: "\/admin\/inquiries"/);
  assert.match(sections, /問い合わせ確認/);
  assert.doesNotMatch(tools, /href: "\/admin\/inquiries"/);

  assert.match(admin, /未確認/);
  assert.match(admin, /対応中/);
  assert.match(admin, /優先度/);
  assert.match(admin, /対応状況/);
  assert.match(admin, /ユーザーへ返信/);
  assert.match(admin, /SUPPORT_STATUS_LABELS/);
  assert.match(admin, /SUPPORT_PRIORITY_LABELS/);
  assert.match(admin, /adminSetSupportRequest/);
  assert.match(admin, /replySupportRequest/);
  assert.match(admin, /この問い合わせを終了しますか/);
  assert.match(admin, /この問い合わせを解決済みにしますか/);

  assert.match(nav, /key: "adminInquiries".*href: "\/admin\/inquiries"/);
  assert.match(nav, /ADMIN_MOBILE_NAV_ITEM_OPTIONS/);
  assert.match(sharedNav, /useSharedAccessState\(\)/);
  assert.match(sharedNav, /state\.profile\.role === "admin"/);
  assert.match(sharedNav, /state\.profile\.status === "active"/);
  assert.match(customizer, /問合せ確認/);

  assert.match(home, /getSupportNotificationSummary/);
  assert.match(home, /supportUnreadCount/);
  assert.match(home, /activeAdmin \? "\/admin\/inquiries" : "\/inquiries"/);
  assert.match(home, /hasHeaderNotification/);
  assert.match(header, /notificationHref/);
  assert.match(header, /notificationLabel/);
  assert.match(header, /hasUnreadNotifications/);
});

test("support center is documented, responsive, and keeps the public legal support route", async () => {
  const [layout, css, manual, faq, publicSupport] = await Promise.all([
    read("app/layout.tsx"),
    read("app/phase41-support-center.css"),
    read("app/manual/page.tsx"),
    read("app/faq/page.tsx"),
    read("components/support-request-page.tsx"),
  ]);

  assert.match(layout, /phase41-support-center\.css/);
  assert.match(css, /\.support-layout/);
  assert.match(css, /\.admin-support-layout/);
  assert.match(css, /@media \(max-width: 650px\)/);
  assert.match(manual, /お問い合わせ・返信確認/);
  assert.match(manual, /問い合わせ確認/);
  assert.match(faq, /お問い合わせ・通知/);
  assert.match(faq, /管理者から未読返信/);
  assert.match(publicSupport, /お問い合わせ・開示請求/);
  assert.match(publicSupport, /販売者情報の開示請求/);
  assert.match(publicSupport, /fetchCommerceConfig/);
  assert.match(publicSupport, /settings\.externalSalesEnabled && commerce\.legalReady/);
  assert.match(publicSupport, /href="\/inquiries"/);
  assert.match(publicSupport, /AAS内の問い合わせセンターを開く/);
  assert.match(publicSupport, /購入前・ログインできない場合/);
  assert.match(publicSupport, /公開サポート窓口/);
  assert.match(publicSupport, /supportUrl/);
});
