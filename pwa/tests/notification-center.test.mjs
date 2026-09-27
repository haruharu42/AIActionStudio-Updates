import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const pwaRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(pwaRoot, "..");
const readPwa = (relative) => readFile(path.join(pwaRoot, relative), "utf8");
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("notification migration protects tables and exposes only RPC-based access", async () => {
  const migration = await readRepo("supabase/migrations/20260925012520_app_notification_center_and_web_push_v1.sql");

  assert.match(migration, /create table if not exists public\.app_notifications/);
  assert.match(migration, /create table if not exists public\.user_notification_preferences/);
  assert.match(migration, /create table if not exists public\.user_push_subscriptions/);
  assert.match(migration, /create table if not exists public\.app_notification_push_deliveries/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /force row level security/);
  assert.match(migration, /revoke all on table public\.app_notifications from public,anon,authenticated/);
  assert.match(migration, /get_my_app_notifications/);
  assert.match(migration, /update_my_notification_preferences/);
  assert.match(migration, /admin_create_app_notification/);
  assert.match(migration, /private\.is_active_admin\(\)/);
});

test("Web Push secrets stay out of the repository and worker uses Vault-backed config", async () => {
  const [migration, worker] = await Promise.all([
    readRepo("supabase/migrations/20260925012520_app_notification_center_and_web_push_v1.sql"),
    readRepo("supabase/functions/notification-push-worker/index.ts"),
  ]);

  assert.match(migration, /aas_notification_vapid_private_key/);
  assert.match(migration, /vault\.decrypted_secrets/);
  assert.match(migration, /aas_notification_push_worker_token/);
  assert.doesNotMatch(migration, /0je0qMnP9VOhI5CZmOme/);
  assert.doesNotMatch(worker, /0je0qMnP9VOhI5CZmOme/);
  assert.match(worker, /x-aas-worker-token/);
  assert.match(worker, /get_notification_push_worker_config/);
  assert.match(worker, /npm:web-push@3\.6\.7/);
  assert.match(worker, /statusCode === 404 \|\| statusCode === 410/);
});

test("automatic notifications cover releases, feature maintenance, rollout, and Knowledge updates", async () => {
  const migration = await readRepo("supabase/migrations/20260925012520_app_notification_center_and_web_push_v1.sql");

  assert.match(migration, /notify_app_release_published/);
  assert.match(migration, /AAS v.*を公開しました/);
  assert.match(migration, /notify_feature_control_change/);
  assert.match(migration, /メンテナンス中/);
  assert.match(migration, /メンテナンス終了/);
  assert.match(migration, /テスト公開しました/);
  assert.match(migration, /notify_knowledge_refresh_completed/);
  assert.match(migration, /AAS Knowledge が更新されました/);
  assert.match(migration, /knowledge_refresh_requests/);
});

test("header places notification bell before mission shortcut and shows unread count", async () => {
  const [header, button] = await Promise.all([
    readPwa("components/aas-reference-shell.tsx"),
    readPwa("components/notification-header-button.tsx"),
  ]);

  const bellIndex = header.indexOf("<NotificationHeaderButton");
  const missionIndex = header.indexOf("href={notificationHref}");
  assert.ok(bellIndex >= 0);
  assert.ok(missionIndex > bellIndex);
  assert.match(button, /href="\/notifications"/);
  assert.match(button, /getMyNotifications/);
  assert.match(button, /unreadCount/);
  assert.match(button, /setAppBadge/);
});

test("notification center can list and mark notifications read", async () => {
  const [page, route, client] = await Promise.all([
    readPwa("components/notifications-page.tsx"),
    readPwa("app/notifications/page.tsx"),
    readPwa("lib/notifications.ts"),
  ]);

  assert.match(route, /NotificationsPage/);
  assert.match(page, /アップデート、メンテナンス、Knowledge更新/);
  assert.match(page, /すべて既読/);
  assert.match(page, /markNotificationRead/);
  assert.match(page, /markAllNotificationsRead/);
  assert.match(client, /get_my_app_notifications/);
  assert.match(client, /mark_my_app_notification_read/);
});

test("settings support in-app, push, and per-category notification switches", async () => {
  const [settings, panel, client] = await Promise.all([
    readPwa("components/pwa-settings-page.tsx"),
    readPwa("components/notification-settings-panel.tsx"),
    readPwa("lib/notifications.ts"),
  ]);

  assert.match(settings, /id="notifications"/);
  assert.match(settings, /title="通知"/);
  assert.match(panel, /AAS内の通知/);
  assert.match(panel, /スマホ・PCへの端末通知/);
  assert.match(panel, /アップデート情報/);
  assert.match(panel, /メンテナンス/);
  assert.match(panel, /Knowledge更新/);
  assert.match(panel, /管理者からのお知らせ/);
  assert.match(panel, /ホーム画面に追加/);
  assert.match(client, /Notification\.requestPermission/);
  assert.match(client, /pushManager\.subscribe/);
  assert.match(client, /serviceWorker\.register\("\/sw\.js"/);
});

test("push enablement is scoped to the current device while the server keeps an aggregate flag", async () => {
  const [panel, client, migration, deviceLookupMigration] = await Promise.all([
    readPwa("components/notification-settings-panel.tsx"),
    readPwa("lib/notifications.ts"),
    readRepo("supabase/migrations/20260927110715_notification_device_push_state_v2.sql"),
    readRepo("supabase/migrations/20260927124446_notification_current_device_push_lookup_v2.sql"),
  ]);

  assert.match(client, /browserPushSubscriptionActive\(client: SupabaseClient\)/);
  assert.match(client, /pushManager\.getSubscription\(\)/);
  assert.match(client, /is_my_push_subscription_enabled_v2/);
  assert.match(panel, /browserPushSubscriptionActive\(client\)/);
  assert.match(panel, /devicePushEnabled/);
  assert.match(panel, /setDevicePushEnabled\(false\)/);
  assert.match(panel, /setDevicePushEnabled\(true\)/);
  assert.match(panel, /他の端末の通知設定は変更しません/);
  assert.doesNotMatch(panel, /updateNotificationPreferences[\s\S]{0,180}pushEnabled:\s*false/);
  assert.doesNotMatch(panel, /updateNotificationPreferences[\s\S]{0,180}pushEnabled:\s*true/);
  assert.match(migration, /where s\.user_id=v_user and s\.enabled=true/);
  assert.match(migration, /push_enabled=v_push_enabled/);
  assert.match(migration, /pref\.push_enabled is distinct from exists/);
  assert.match(deviceLookupMigration, /where s\.user_id=v_user/);
  assert.match(deviceLookupMigration, /s\.endpoint=p_endpoint/);
  assert.match(deviceLookupMigration, /s\.enabled=true/);
  assert.match(deviceLookupMigration, /revoke all on function public\.is_my_push_subscription_enabled_v2\(text\) from public, anon, authenticated/);
  assert.match(deviceLookupMigration, /grant execute on function public\.is_my_push_subscription_enabled_v2\(text\) to authenticated/);
});

test("service worker displays Push notifications and opens the AAS destination", async () => {
  const sw = await readPwa("public/sw.js");

  assert.match(sw, /addEventListener\("push"/);
  assert.match(sw, /showNotification/);
  assert.match(sw, /addEventListener\("notificationclick"/);
  assert.match(sw, /clients\.openWindow/);
  assert.match(sw, /icon: "\/icon-192\.png\?v=20260927-axia-v2"/);
});

test("admin notification management supports all, tester, and admin audiences", async () => {
  const [page, route, sections, nav] = await Promise.all([
    readPwa("components/admin-notifications-page.tsx"),
    readPwa("app/admin/notifications/page.tsx"),
    readPwa("lib/admin-sections.ts"),
    readPwa("lib/mobile-nav-preference.ts"),
  ]);

  assert.match(route, /AdminNotificationsPage/);
  assert.match(page, /全ユーザー/);
  assert.match(page, /指定一般ユーザーテスター/);
  assert.match(page, /管理者のみ/);
  assert.match(page, /adminCreateNotification/);
  assert.match(sections, /id: "notifications"/);
  assert.match(sections, /href: "\/admin\/notifications"/);
  assert.match(nav, /"adminNotifications"/);
});

test("push worker has immediate trigger and cron recovery", async () => {
  const migration = await readRepo("supabase/migrations/20260925012520_app_notification_center_and_web_push_v1.sql");

  assert.match(migration, /enqueue_notification_push_deliveries/);
  assert.match(migration, /invoke_notification_push_worker/);
  assert.match(migration, /net\.http_post/);
  assert.match(migration, /aas-notification-push-worker-5m/);
  assert.match(migration, /\*\/5 \* \* \* \*/);
});


test("notification feature itself follows admin to tester to public rollout on UI and RPC layers", async () => {
  const [guard, client, bell, settings] = await Promise.all([
    readRepo("supabase/migrations/20260925014359_notification_feature_rollout_guard_v1.sql"),
    readPwa("lib/notifications.ts"),
    readPwa("components/notification-header-button.tsx"),
    readPwa("components/pwa-settings-page.tsx"),
  ]);

  assert.match(guard, /'notifications','共通','通知センター'/);
  assert.match(guard, /'\/notifications',true,'admin',false,false/);
  assert.match(guard, /private\.assert_notification_feature_access/);
  assert.match(guard, /private\.can_use_app_feature\('notifications'/);
  assert.match(guard, /revoke all on function public\.get_my_app_notifications\(integer,boolean\) from authenticated/);
  assert.match(guard, /grant execute on function public\.get_my_app_notifications_v2\(integer,boolean\) to authenticated/);
  assert.match(guard, /private\.can_use_app_feature\('notifications',s\.user_id\)/);

  assert.match(client, /get_my_app_notifications_v2/);
  assert.match(client, /get_my_notification_preferences_v2/);
  assert.match(client, /register_my_push_subscription_v2/);
  assert.match(bell, /useAppFeatureAccess\("notifications"\)/);
  assert.match(bell, /!notificationAccess\.allowed/);
  assert.match(settings, /useAppFeatureAccess\("notifications"\)/);
  assert.match(settings, /notificationAccess\.allowed/);
});
