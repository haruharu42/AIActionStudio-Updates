import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFile(path.join(root, relative), "utf8");
const readNotePromptSource = async () => (await Promise.all(["lib/note-operations.ts", "lib/note-operation-prompts.ts"].map((relative) => read(relative)))).join("\n");
const readRepo = (relative) => readFile(path.join(root, "..", relative), "utf8");

test("platform account presets are owner scoped, forced-RLS, and allow one default per platform", async () => {
  const migration = await readRepo("supabase/migrations/20260921044428_user_platform_account_presets_v1.sql");

  assert.match(migration, /create table if not exists public\.user_platform_account_presets/);
  assert.match(migration, /platform in \('note','tips','brain'\)/);
  assert.match(migration, /unique \(user_id, platform, preset_name\)/);
  assert.match(migration, /user_platform_account_presets_one_default/);
  assert.match(migration, /where is_default/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /force row level security/);
  assert.match(migration, /user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /private\.is_active_profile\(\)/);
  assert.match(migration, /public\.can_access_product\('AAS-PWA-BETA'\)/);
  for (const operation of ["select", "insert", "update", "delete"]) {
    assert.match(migration, new RegExp("platform_account_presets_" + operation + "_own_active"));
  }
  assert.match(migration, /grant select, insert, update, delete on table public\.user_platform_account_presets to authenticated/);
  assert.doesNotMatch(migration, /service[_-]?role|sb_secret_|sk_(?:live|test)_|whsec_/i);
});

test("account-specific note Tips Brain presets support names, genres, defaults, and AAS admin drafts", async () => {
  const [lib, ui, provider] = await Promise.all([
    read("features/presets/platform-account-presets.ts"),
    read("features/presets/platform-account-preset-settings.tsx"),
    read("features/presets/workspace-preset-provider.tsx"),
  ]);

  assert.match(lib, /PlatformAccountPresetPlatform = "note" \| "tips" \| "brain"/);
  for (const field of ["presetName", "accountName", "accountHandle", "genre", "accountStyle", "audience", "tone", "monetization", "operationGoal", "mainTopics", "isDefault"]) {
    assert.match(lib, new RegExp(field));
  }
  assert.match(lib, /createAasPlatformAccountPresetDraft/);
  assert.match(lib, /AI Action Studio（AAS）/);
  assert.match(lib, /AI副業/);
  assert.match(lib, /Knowledge/);
  assert.doesNotMatch(lib, /AI Article Studio（AAS）/);
  assert.match(lib, /buildPlatformAccountPresetPromptContext/);
  assert.match(lib, /今回の画面でユーザーが明示した条件と衝突する場合は、今回の明示条件を優先する/);

  assert.match(ui, /投稿ジャンル別のアカウントプリセット/);
  assert.match(ui, /プリセット名（投稿ジャンル名） \*/);
  assert.match(ui, /ユーザー名 \/ 表示名/);
  assert.match(ui, /主な投稿ジャンル/);
  assert.match(ui, /想定読者/);
  assert.match(ui, /主なテーマ・キーワード/);
  assert.match(ui, /サブジャンル・対象年齢・性別・文字数・価格・タグ/);
  assert.match(ui, /必要な場合だけ、発信方針も固定する/);
  assert.match(ui, /記事作成で既定として使う/);
  assert.match(ui, /AAS公式案を反映/);
  assert.match(ui, /isAdmin &&/);
  assert.match(ui, /パスワード・Cookie・トークンは保存しない/);

  assert.match(provider, /listPlatformAccountPresets/);
  assert.match(provider, /setRuntimePlatformAccountPresets/);
  assert.match(provider, /saveAccountPreset/);
  assert.match(provider, /deleteAccountPreset/);
});

test("default account preset context reaches article, image, SNS, note, starter, and workflow prompts", async () => {
  const [accountDesign, image, sns, note, starter, lifecycle] = await Promise.all([
    read("lib/platform-account-design.ts"),
    read("lib/phase13-image-prompts.ts"),
    read("lib/phase14-sns.ts"),
    readNotePromptSource(),
    read("lib/platform-account-starter.ts"),
    read("lib/content-lifecycle.ts"),
  ]);

  assert.match(accountDesign, /buildPlatformAccountPresetPromptContext/);
  assert.match(accountDesign, /presetContext/);
  assert.match(image, /buildPlatformAccountPromptContext\(input\.publicationTarget\)/);
  assert.match(sns, /buildPlatformAccountPromptContext\(article\.publicationTarget\)/);
  assert.match(note, /buildPlatformAccountPromptContext\("note"\)/);
  assert.match(starter, /buildPlatformAccountPresetPromptContext\(design\.platform\)/);
  assert.match(lifecycle, /buildPlatformAccountPromptContext\(article\.publicationTarget\)/);
  assert.match(lifecycle, /buildPlatformAccountPromptContext\(input\.platform\)/);
});

test("admin development prompt builder is hierarchical, protected, and copy-ready", async () => {
  const [builder, page, route, sections, tools, nav, css] = await Promise.all([
    read("features/admin/development-prompts.ts"),
    read("components/admin-development-prompts-page.tsx"),
    read("app/admin/development-prompts/page.tsx"),
    read("lib/admin-sections.ts"),
    read("components/phase-tools-page.tsx"),
    read("lib/mobile-nav-preference.ts"),
    read("app/phase46-account-presets-dev-prompts.css"),
  ]);

  for (const label of ["アップデート", "修正", "追加機能", "コード整理", "セキュリティ", "テスト・検証"]) {
    assert.match(builder, new RegExp(label));
  }
  for (const area of ["UI・画面", "認証・ログイン", "記事作成・ライブラリ", "Supabase・DB・RLS", "アップデート・Preview・公開"]) {
    assert.match(builder, new RegExp(area));
  }
  assert.match(builder, /DEVELOPMENT_SUBTARGETS/);
  assert.match(builder, /"設定": \["共通プリセット", "アカウント別プリセット"/);
  assert.match(builder, /"記事作成": \["ステップUI", "入力フォーム"/);
  assert.match(builder, /現在のGitHubブランチ・PR・HEAD・CI/);
  assert.match(builder, /service_role/);
  assert.match(builder, /Typecheck、Lint、Build、回帰テスト/);
  assert.match(builder, /Member Beta、Production公開/);

  assert.match(page, /state\.profile\.role === "admin"/);
  assert.match(page, /state\.profile\.status === "active"/);
  assert.match(page, /1\. 依頼種別/);
  assert.match(page, /2\. 分野/);
  assert.match(page, /3\. 対象画面・機能/);
  assert.match(page, /4\. 詳細箇所/);
  assert.match(page, /AdminSelectWithCustom/);
  assert.match(page, /一覧にない画面・機能を入力/);
  assert.match(page, /一覧にない詳細箇所を入力/);
  assert.match(page, /if \(state\.kind === "loading"\) return null/);
  assert.match(page, /5\. 依頼内容 \*/);
  assert.match(page, /プロンプトをコピー/);
  assert.match(page, /コピーしてChatGPTを開く/);
  assert.match(route, /AdminDevelopmentPromptsPage/);

  assert.match(sections, /development-prompts/);
  assert.match(sections, /開発依頼プロンプト/);
  assert.match(sections, /href: "\/admin\/development-prompts"/);
  assert.doesNotMatch(tools, /href: "\/admin\/development-prompts"/);
  assert.doesNotMatch(tools, /管理者専用/);
  assert.match(nav, /adminDevPrompts/);
  assert.match(nav, /href: "\/admin\/development-prompts"/);
  assert.match(css, /\.admin-dev-prompt-flow/);
  assert.match(css, /@media \(max-width: 650px\)/);
});
