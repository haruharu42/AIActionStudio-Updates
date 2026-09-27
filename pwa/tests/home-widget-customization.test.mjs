import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const pwaRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(pwaRoot, "..");
const readPwa = (relative) => readFile(path.join(pwaRoot, relative), "utf8");
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("home widgets restore cloud-saved desktop and mobile customization", async () => {
  const [home, settings, customizer, lib, css, settingsCss, baseMigration, rlsMigration] = await Promise.all([
    readPwa("components/phase18-beginner-home.tsx"),
    readPwa("components/pwa-settings-page.tsx"),
    readPwa("components/home-widget-customizer.tsx"),
    readPwa("lib/home-widget-preferences.ts"),
    readPwa("app/phase53-crystal-ui.css"),
    readPwa("app/phase25-user-personalization.css"),
    readRepo("supabase/migrations/20260924063233_user_home_widget_preferences.sql"),
    readRepo("supabase/migrations/20260925102518_optimize_home_widget_rls_auth_uid.sql"),
  ]);

  for (const key of [
    "creator",
    "todayNote",
    "missions",
    "membership",
    "library",
    "releaseStatus",
    "hero",
    "quickStart",
    "articleSetup",
    "aiApps",
    "ranking",
    "quickActions",
  ]) {
    assert.match(lib, new RegExp('"' + key + '"'));
    assert.match(home, new RegExp('widgetKey="' + key + '"'));
  }

  assert.match(lib, /user_home_widget_preferences/);
  assert.match(lib, /desktop_layout,mobile_layout/);
  assert.match(lib, /upsert/);
  assert.match(lib, /onConflict: "user_id"/);
  assert.match(lib, /parseHomeWidgetPreferences/);
  assert.match(lib, /entry\.visible !== false/);
  assert.match(lib, /entry\.size === "half" \? "half" : "wide"/);

  assert.match(home, /loadHomeWidgetPreferences/);
  assert.match(home, /matchMedia\("\(max-width: 820px\)"\)/);
  assert.match(home, /homeWidgetTarget === "mobile"/);
  assert.match(home, /home-widget-grid/);
  assert.match(home, /home-widget-slot/);
  assert.match(home, /aas:home-widgets-updated/);

  assert.match(settings, /id="home"/);
  assert.match(settings, /title="ホーム画面"/);
  assert.match(settings, /HomeWidgetCustomizer/);

  assert.match(customizer, /PC/);
  assert.match(customizer, /スマホ/);
  assert.match(customizer, /表示/);
  assert.match(customizer, /非表示/);
  assert.match(customizer, /横幅いっぱい/);
  assert.match(customizer, /1\/2幅/);
  assert.match(customizer, /配置を保存/);
  assert.match(customizer, /標準配置に戻す/);
  assert.match(customizer, /saveHomeWidgetPreferences/);

  assert.match(css, /\.home-widget-grid/);
  assert.match(css, /\.home-widget-slot\.half/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*?\.home-widget-slot\.half/);
  assert.match(settingsCss, /\.home-widget-customizer/);
  assert.match(settingsCss, /\.home-widget-row/);

  assert.match(baseMigration, /create table if not exists public\.user_home_widget_preferences/);
  assert.match(baseMigration, /desktop_layout jsonb not null default '\[\]'::jsonb/);
  assert.match(baseMigration, /mobile_layout jsonb not null default '\[\]'::jsonb/);
  assert.match(baseMigration, /grant select, insert, update, delete on public\.user_home_widget_preferences to authenticated/);
  assert.match(baseMigration, /user_home_widget_preferences_select_own/);

  assert.match(rlsMigration, /user_home_widget_preferences_select_own/);
  assert.match(rlsMigration, /user_home_widget_preferences_insert_own/);
  assert.match(rlsMigration, /user_home_widget_preferences_update_own/);
  assert.match(rlsMigration, /user_home_widget_preferences_delete_own/);
  assert.match(rlsMigration, /\(select auth\.uid\(\)\) = user_id/);

  assert.doesNotMatch(
    [home, settings, customizer, lib].join("\n"),
    /service[_-]?role|sb_secret_|sk_(?:live|test)_|whsec_/i,
  );
});
