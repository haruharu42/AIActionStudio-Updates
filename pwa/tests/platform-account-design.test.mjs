import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(root, "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("platform account design storage is owner-scoped and entitlement protected", async () => {
  const migration = await readRepo("supabase/migrations/20260920080324_platform_account_designs.sql");

  assert.match(migration, /create table if not exists public\.platform_account_designs/);
  assert.match(migration, /primary key \(user_id, platform\)/);
  assert.match(migration, /platform in \('note','tips','brain'\)/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /force row level security/);

  for (const operation of ["select", "insert", "update", "delete"]) {
    assert.match(migration, new RegExp("platform_account_designs_" + operation + "_own_active"));
    assert.match(migration, new RegExp("for " + operation + " to authenticated"));
  }

  assert.match(migration, /user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /private\.is_active_profile\(\)/);
  assert.match(migration, /public\.can_access_product\('AAS-PWA-BETA'\)/);
  assert.match(migration, /revoke all on table public\.platform_account_designs from public, anon, authenticated/);
  assert.match(migration, /grant select, insert, update, delete on table public\.platform_account_designs to authenticated/);
  assert.match(migration, /insert into public\.platform_account_designs/);
  assert.match(migration, /from public\.note_operation_profiles/);
  assert.doesNotMatch(migration, /service[_-]?role|sb_secret_|sk_(?:live|test)_|whsec_/i);
});

test("note Tips Brain account design uses dropdown presets with other inputs", async () => {
  const [lib, page] = await Promise.all([
    read("lib/platform-account-design.ts"),
    read("components/platform-account-design-page.tsx"),
  ]);

  for (const platform of ["note", "tips", "brain"]) {
    assert.match(lib, new RegExp(`value: "${platform}"`));
  }

  for (const collection of [
    "ACCOUNT_DESIGN_GENRES",
    "ACCOUNT_DESIGN_STYLES",
    "ACCOUNT_DESIGN_AUDIENCES",
    "ACCOUNT_DESIGN_TONES",
    "ACCOUNT_DESIGN_MONETIZATION",
    "ACCOUNT_DESIGN_GOALS",
    "ACCOUNT_DESIGN_TRUST",
    "ACCOUNT_DESIGN_CONTENT_FOCUS",
  ]) {
    assert.match(lib, new RegExp(`export const ${collection}`));
  }

  assert.ok((lib.match(/value: "other", label: "その他（自由入力）"/g) ?? []).length >= 8);
  assert.match(page, /design\.genrePreset === "other"/);
  assert.match(page, /design\.accountStylePreset === "other"/);
  assert.match(page, /design\.audiencePreset === "other"/);
  assert.match(page, /design\.tonePreset === "other"/);
  assert.match(page, /design\.monetizationPreset === "other"/);
  assert.match(page, /design\.goalPreset === "other"/);
  assert.match(page, /design\.trustPreset === "other"/);
  assert.match(page, /design\.contentFocusPreset === "other"/);
  assert.match(page, /必要な人だけ：表示名・テーマ・経験・プロフィール文/);
  assert.match(page, /選択内容からプロフィール文を作る/);
});

test("account designs load and save per user and platform without external credentials", async () => {
  const [lib, page] = await Promise.all([
    read("lib/platform-account-design.ts"),
    read("components/platform-account-design-page.tsx"),
  ]);

  assert.match(lib, /\.from\("platform_account_designs"\)/);
  assert.match(lib, /\.eq\("user_id", userId\)/);
  assert.match(lib, /\.update\(fields\)/);
  assert.match(lib, /\.eq\("updated_at", normalized\.updatedAt\)/);
  assert.match(lib, /\.insert\(\{/);
  assert.match(lib, /defaultPlatformAccountDesign\(userId, "note"\)/);
  assert.match(lib, /defaultPlatformAccountDesign\(userId, "tips"\)/);
  assert.match(lib, /defaultPlatformAccountDesign\(userId, "brain"\)/);
  assert.match(page, /useSharedAccessState/);
  assert.doesNotMatch(page, /loadAccessState/);
  assert.match(page, /loadPlatformAccountDesigns/);
  assert.match(page, /savePlatformAccountDesign/);
  assert.match(page, /外部サービスのログイン情報は保存しません/);
  assert.doesNotMatch(`${lib}\n${page}`, /password\s*[:=]|cookie\s*[:=]|access[_-]?token\s*[:=]|service[_-]?role|sb_secret_/i);
});

test("account design is reachable from tools settings note operations and manual", async () => {
  const [route, tools, toolCatalog, settings, noteOps, layout, css, manual, faq] = await Promise.all([
    read("app/account-design/page.tsx"),
    read("components/phase-tools-page.tsx"),
    read("features/tools/tool-catalog.ts"),
    read("components/pwa-settings-page.tsx"),
    read("components/note-operations-page.tsx"),
    read("app/layout.tsx"),
    read("app/phase40-account-design.css"),
    read("app/manual/page.tsx"),
    read("app/faq/page.tsx"),
  ]);

  assert.match(route, /PlatformAccountDesignPage/);
  assert.match(tools, /MEMBER_TOOL_GROUPS/);
  assert.match(toolCatalog, /href: "\/account-design"/);
  assert.match(settings, /href="\/account-design"/);
  assert.match(noteOps, /href="\/account-design"/);
  assert.match(layout, /phase40-account-design\.css/);
  assert.match(css, /\.account-design-platforms/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(manual, /note \/ Tips \/ Brain アカウント作成・設計/);
  assert.match(faq, /媒体ごとに別々の設計を保存できます/);
});


test("saved account design remains prompt-only while article UI uses account presets", async () => {
  const [designLib, createLib, createPage] = await Promise.all([
    read("lib/platform-account-design.ts"),
    read("lib/phase11-create.ts"),
    read("components/phase11-create-page.tsx"),
  ]);

  assert.match(designLib, /setRuntimePlatformAccountDesigns/);
  assert.match(designLib, /getRuntimePlatformAccountDesign/);
  assert.match(designLib, /return design\?\.ready \? design : null/);
  assert.match(designLib, /buildPlatformAccountPromptContext/);
  assert.match(designLib, /【ACCOUNT DESIGN】/);
  assert.match(designLib, /補完・誇張・創作しない/);
  assert.match(createLib, /buildPlatformAccountPromptContext\(draft\.publicationTarget\)/);
  assert.match(createLib, /account_design_applied/);
  assert.match(createLib, /account_design_updated_at/);
  assert.match(createPage, /loadPlatformAccountDesigns/);
  assert.match(createPage, /setRuntimePlatformAccountDesigns\(loadedDesigns\)/);
  assert.doesNotMatch(createPage, /アカウント設計を自動反映|アカウント設計は未完了|\/account-design\?platform=/);
  assert.match(createPage, /activeAccountPreset/);
  assert.match(createPage, /投稿アカウントプリセット/);
});

test("account design protects unsaved edits and rejects stale cross-device updates", async () => {
  const [lib, page] = await Promise.all([
    read("lib/platform-account-design.ts"),
    read("components/platform-account-design-page.tsx"),
  ]);

  assert.match(lib, /validatePlatformAccountDesign/);
  assert.match(lib, /「その他」を選んだ項目を入力してください/);
  assert.match(lib, /serializePlatformAccountDesignDraft/);
  assert.match(lib, /restorePlatformAccountDesignDraft/);
  assert.match(lib, /baseUpdatedAt: design\.updatedAt/);
  assert.match(lib, /envelope\.baseUpdatedAt !== cloud\.updatedAt/);
  assert.match(lib, /\.eq\("updated_at", normalized\.updatedAt\)/);
  assert.match(lib, /別の画面または端末でこのアカウント設計が更新されています/);
  assert.match(lib, /code === "23505"/);

  assert.match(page, /aas\.account-design\.draft\.v1/);
  assert.match(page, /window\.localStorage\.setItem/);
  assert.match(page, /window\.localStorage\.removeItem/);
  assert.match(page, /restorePlatformAccountDesignDraft/);
  assert.match(page, /● 保存前の変更あり/);
  assert.match(page, /保存前の変更を破棄して最新を再読込/);
  assert.match(page, /publicationTarget=\$\{platform\}/);
});

test("all eight other selections require matching custom input before cloud save", async () => {
  const lib = await read("lib/platform-account-design.ts");
  for (const field of [
    "genrePreset",
    "accountStylePreset",
    "audiencePreset",
    "tonePreset",
    "monetizationPreset",
    "goalPreset",
    "trustPreset",
    "contentFocusPreset",
  ]) {
    assert.match(lib, new RegExp(`design\\.${field} === "other"`));
  }
  for (const custom of [
    "customGenre",
    "customAccountStyle",
    "customAudience",
    "customTone",
    "customMonetization",
    "customGoal",
    "customTrust",
    "customContentFocus",
  ]) {
    assert.match(lib, new RegExp(`design\\.${custom}\\.trim\\(\\)`));
  }
});


test("account starter kit covers first account setup through icon creation with owner-scoped storage", async () => {
  const [migration, lib, panel, page, css] = await Promise.all([
    readRepo("supabase/migrations/20260921002542_platform_account_starter_kits.sql"),
    read("lib/platform-account-starter.ts"),
    read("components/account-starter-kit-panel.tsx"),
    read("components/platform-account-design-page.tsx"),
    read("app/phase40-account-design.css"),
  ]);

  assert.match(migration, /create table if not exists public\.platform_account_starter_kits/);
  assert.match(migration, /jsonb_typeof\(kit\) = 'object'/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /force row level security/);
  for (const operation of ["select", "insert", "update", "delete"]) {
    assert.match(migration, new RegExp("platform_account_starter_kits_" + operation + "_own_active"));
    assert.match(migration, new RegExp("for " + operation + " to authenticated"));
  }
  assert.match(migration, /user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /private\.is_active_profile\(\)/);
  assert.match(migration, /public\.can_access_product\('AAS-PWA-BETA'\)/);
  assert.match(migration, /grant select, insert, update, delete on table public\.platform_account_starter_kits to authenticated/);

  assert.match(lib, /aas-account-starter-v1/);
  assert.match(lib, /buildAccountStarterPrompt/);
  assert.match(lib, /extractAccountStarterKit/);
  assert.match(lib, /account_name_candidates/);
  assert.match(lib, /handle_candidates/);
  assert.match(lib, /content_pillars/);
  assert.match(lib, /free_post_ideas/);
  assert.match(lib, /paid_post_ideas/);
  assert.match(lib, /launch_checklist/);
  assert.match(lib, /icon/);
  assert.match(lib, /既存作品、特定作家、実在人物、企業ロゴ、商標、著名キャラクターに似せない/);
  assert.match(lib, /メールアドレス、パスワード、Cookie、アクセストークン、認証コード等を要求しない/);
  assert.match(lib, /\.from\("platform_account_starter_kits"\)/);
  assert.match(lib, /\.eq\("user_id", userId\)/);
  assert.match(lib, /applyStarterKitToDesign/);

  assert.match(panel, /AIにアカウントを最初から一括作成してもらう/);
  assert.match(panel, /表示名・ID候補・プロフィール・コンセプト・発信の柱・最初の記事案・開始手順・専用アイコン/);
  assert.match(panel, /一括作成プロンプトをコピーしてAIを開く/);
  assert.match(panel, /コピーしたAI回答を読み込んで一括反映/);
  assert.match(panel, /ChatGPT Imagesでアイコンを作る/);
  assert.match(panel, /PLATFORM_HOME/);
  assert.match(panel, /note\.com/);
  assert.match(panel, /tips\.jp/);
  assert.match(panel, /brain-market\.com/);
  assert.match(panel, /ID候補の空き状況はAASでは確認・保証しません/);
  assert.match(page, /AccountStarterKitPanel/);
  assert.match(page, /applyStarterDesign/);
  assert.match(css, /\.account-starter-kit/);
  assert.match(css, /\.account-starter-icon/);

  assert.doesNotMatch(`${migration}\n${lib}\n${panel}\n${page}`, /sb_secret_|service[_-]?role|sk_(?:live|test)_|whsec_/i);
});


test("account design shows a safe loading shell while access and cloud drafts are loading", async () => {
  const page = await read("components/platform-account-design-page.tsx");

  assert.match(page, /import \{ AppLoadingScreen \}/);
  assert.match(page, /state\.kind === "loading"[\s\S]*?<AppLoadingScreen/);
  assert.match(page, /アカウント設計の利用権を確認しています/);
  assert.match(page, /state\.kind === "ready" && client && !designs && !loadError/);
  assert.match(page, /note \/ Tips \/ Brain のアカウント設計を読み込んでいます/);
  assert.doesNotMatch(page, /if \(state\.kind === "loading"\) return null/);
});
