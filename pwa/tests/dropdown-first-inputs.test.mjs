import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const pwaRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(pwaRoot, "..");
const readPwa = (relative) => readFile(path.join(pwaRoot, relative), "utf8");
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("shared dropdown control always preserves an other/custom escape hatch", async () => {
  const control = await readPwa("components/select-with-custom.tsx");

  assert.match(control, /SelectWithCustom/);
  assert.match(control, /PresetNumberSelectWithCustom/);
  assert.match(control, /その他・自由入力/);
  assert.match(control, /customPlaceholder/);
  assert.match(control, /inputType\?: "text" \| "url" \| "number"/);
});

test("article creation and library use dropdown-first fields while keeping custom values", async () => {
  const [steps, draft, library] = await Promise.all([
    readPwa("components/article-create/article-create-steps.tsx"),
    readPwa("lib/article-create-draft.ts"),
    readPwa("components/article-library/article-library-editor.tsx"),
  ]);

  assert.match(steps, /SelectWithCustom/);
  assert.match(steps, /文字数の目安/);
  assert.match(steps, /500〜50,000文字で自由入力/);
  assert.match(steps, /PresetNumberSelectWithCustom/);
  assert.match(steps, /最大10枚まで自由入力/);
  assert.match(steps, /自由価格（円）/);

  assert.match(draft, /targetLength >= 500 && targetLength <= 50000/);
  assert.match(draft, /inlineCount <= 10/);
  assert.doesNotMatch(draft, /TARGET_LENGTH_OPTIONS\.some\(\(option\) => option\.value === targetLength\)/);

  assert.match(library, /label="掲載先"/);
  assert.match(library, /その他の掲載先IDを入力/);
  assert.match(library, /label="ジャンル"/);
  assert.match(library, /その他のジャンルを入力/);
  assert.match(library, /label="サブジャンル"/);
  assert.match(library, /その他のサブジャンルを入力/);
  assert.match(library, /label="価格（円）"/);
  assert.match(library, /自由な価格を入力/);
  assert.match(library, /label="マガジン内の順番"/);
});

test("workflow planning replaces preset-able numbers and categories with dropdown plus custom input", async () => {
  const page = await readPwa("components/content-workflow-page.tsx");

  assert.match(page, /PresetNumberSelectWithCustom/);
  assert.match(page, /label="目標文字数"/);
  assert.match(page, /label="公開から何日後"/);
  assert.match(page, /label="記事数"/);
  assert.match(page, /SelectWithCustom/);
  assert.match(page, /label="想定読者"/);
  assert.match(page, /その他の想定読者を入力/);
  assert.match(page, /label="シリーズの目的"/);
  assert.match(page, /その他の目的を入力/);
  assert.match(page, /label="収益化方針"/);
  assert.match(page, /その他の収益化方針を入力/);
});

test("action prompt library supports admin-defined dropdown options and user custom input", async () => {
  const [catalog, service, editor, admin, migration] = await Promise.all([
    readPwa("lib/action-prompt-catalog.ts"),
    readPwa("lib/action-prompt-service.ts"),
    readPwa("components/action-prompt-library/action-prompt-editor.tsx"),
    readPwa("components/admin-action-prompts-page.tsx"),
    readRepo("supabase/migrations/20260925002411_action_prompt_dropdown_options_v1.sql"),
  ]);

  assert.match(catalog, /options\?: readonly string\[\]/);
  assert.match(catalog, /AUDIENCE_OPTIONS/);
  assert.match(catalog, /GOAL_OPTIONS/);
  assert.match(service, /row\.options/);
  assert.match(service, /options: field\.options/);
  assert.match(editor, /field\.options\?\.length/);
  assert.match(editor, /SelectWithCustom/);
  assert.match(admin, /aria-label="選択肢"/);
  assert.match(admin, /空欄なら自由入力のみ/);
  assert.match(admin, /label="副業・用途"/);
  assert.match(admin, /一覧にない副業・用途を入力/);
  assert.match(migration, /when 'audience'/);
  assert.match(migration, /when 'goal'/);
  assert.match(migration, /jsonb_build_object\('options'/);
});

test("knowledge, membership and access-code admin settings use dropdown-first controls for preset-able values", async () => {
  const [knowledge, membership, accessCode] = await Promise.all([
    readPwa("components/knowledge-refresh-panel.tsx"),
    readPwa("components/admin-membership-page.tsx"),
    readPwa("components/admin-users/admin-access-code-panel.tsx"),
  ]);

  assert.match(knowledge, /label="モデル"/);
  assert.match(knowledge, /OpenAI APIのモデルIDを入力/);
  assert.match(knowledge, /label="1回の最大解析候補数"/);
  assert.match(membership, /label="月額料金（税込・円）"/);
  assert.match(membership, /その他の月額料金を入力/);
  assert.match(accessCode, /label="販売チャネル"/);
  assert.match(accessCode, /その他の販売チャネルを入力/);
  assert.match(accessCode, /label="最大利用回数"/);
});

test("dropdown-first conversion does not replace inherently unique content fields", async () => {
  const [library, membership, knowledge] = await Promise.all([
    readPwa("components/article-library/article-library-editor.tsx"),
    readPwa("components/admin-membership-page.tsx"),
    readPwa("components/knowledge-refresh-panel.tsx"),
  ]);

  assert.match(library, /<span>タイトル<\/span>/);
  assert.match(library, /<span>タグ（カンマ区切り）<\/span>/);
  assert.match(membership, /noteメンバーシップURL/);
  assert.match(membership, /ユーザー向け案内（任意）/);
  assert.match(knowledge, /OpenAI APIキー（変更時のみ入力）/);
  assert.match(knowledge, /type="password"/);
});
