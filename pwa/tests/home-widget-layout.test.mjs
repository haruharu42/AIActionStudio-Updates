import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("home widget preferences are account scoped, responsive, and cloud backed", async () => {
  const preferences = await read("lib/home-widget-preferences.ts");

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
    assert.match(preferences, new RegExp(`key: "${key}"`));
  }

  assert.match(preferences, /user_home_widget_preferences/);
  assert.match(preferences, /desktop_layout/);
  assert.match(preferences, /mobile_layout/);
  assert.match(preferences, /HOME_WIDGET_PREFERENCE_EVENT/);
  assert.match(preferences, /localStorage/);
  assert.match(preferences, /normalizeHomeWidgetLayout/);
});

test("settings exposes a PC and mobile home widget customizer", async () => {
  const [settings, customizer] = await Promise.all([
    read("components/pwa-settings-page.tsx"),
    read("components/home-widget-customizer.tsx"),
  ]);

  assert.match(settings, /id="homeLayout"/);
  assert.match(settings, /title="ホーム・ウィジェット"/);
  assert.match(settings, /HomeWidgetCustomizer/);
  assert.match(customizer, /role="tab"/);
  assert.match(customizer, />PC</);
  assert.match(customizer, />スマホ</);
  assert.match(customizer, /draggable/);
  assert.match(customizer, /上へ移動/);
  assert.match(customizer, /下へ移動/);
  assert.match(customizer, /配置を保存/);
  assert.match(customizer, /初期配置へ戻す/);
});

test("home renders existing modules through configurable widget slots", async () => {
  const home = await read("components/phase18-beginner-home.tsx");

  assert.match(home, /home-widget-grid/);
  assert.match(home, /matchMedia\("\(max-width: 820px\)"\)/);
  assert.match(home, /loadHomeWidgetPreferences/);
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
    assert.match(home, new RegExp(`renderHomeWidget\\("${key}"`));
  }
});

test("home widget styles keep mobile single column and desktop half-width widgets safe", async () => {
  const [layout, css] = await Promise.all([
    read("app/layout.tsx"),
    read("app/phase54-home-widgets.css"),
  ]);

  assert.match(layout, /phase53-crystal-ui\.css";\s*import "\.\/phase54-home-widgets\.css"/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.home-widget-slot\.widget-wide/);
  assert.match(css, /\.home-widget-slot\.widget-half/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*grid-template-columns: 1fr/);
});

test("home widget cloud preferences use owner-only RLS", async () => {
  const migration = await read("../supabase/migrations/20260924152500_user_home_widget_preferences.sql");

  assert.match(migration, /create table if not exists public\.user_home_widget_preferences/);
  assert.match(migration, /desktop_layout jsonb/);
  assert.match(migration, /mobile_layout jsonb/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /auth\.uid\(\) = user_id/);
  assert.match(migration, /to authenticated/);
});
