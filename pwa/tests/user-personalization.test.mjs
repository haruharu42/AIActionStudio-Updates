import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(root, "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("article creation keeps AI selection as wizard step one and allows returning to it", async () => {
  const [route, page, steps, draft, progress, personalization] = await Promise.all([
    read("app/create/page.tsx"),
    read("components/phase11-create-page.tsx"),
    read("components/article-create/article-create-steps.tsx"),
    read("lib/article-create-draft.ts"),
    read("lib/phase11-wizard-progress.ts"),
    read("lib/user-personalization.ts"),
  ]);

  assert.match(route, /Phase11CreatePage/);
  assert.doesNotMatch(route, /CreateAiSetup/);
  assert.match(draft, /"使用AI選択"[\s\S]*?"記事の種類"/);
  assert.match(steps, /STEP 1 · 使用AI選択/);
  assert.match(steps, /STEP 2 · 種類の選択/);
  for (const label of ["ChatGPT", "Claude", "Gemini", "無料版", "有料版"]) {
    assert.match(steps + personalization, new RegExp(label));
  }
  assert.match(page, /AiSelectionStep/);
  assert.match(page, /loadWritingProfile/);
  assert.match(page, /saveWritingProfile/);
  assert.match(page, /setRuntimeWritingProfile/);
  assert.match(page, /jumpBackToStep/);
  assert.match(page, /index < displayStep/);
  assert.match(progress, /STORAGE_VERSION = 2/);
  assert.match(progress, /parsed\.version === 1[\s\S]*?\+ 1/);
});

test("personalization settings can be viewed edited saved and reset", async () => {
  const settings = await read("components/pwa-settings-page.tsx");
  for (const label of ["AIの書き方を自分好みにする", "普段使うAI", "文章の雰囲気", "主な掲載先", "AASが保持している小さな利用傾向", "最適化設定を保存", "学習内容をリセット"]) {
    assert.match(settings, new RegExp(label));
  }
  assert.match(settings, /loadWritingProfile/);
  assert.match(settings, /saveWritingProfile/);
  assert.match(settings, /resetWritingProfile/);
  assert.match(settings, /記事本文・AI回答全文・プロンプト全文/);
});


test("user-authored personalization handoff is cloud-backed prompt-safe and provider-specific", async () => {
  const [settings, panel, personalization, css, migration] = await Promise.all([
    read("components/pwa-settings-page.tsx"),
    read("components/personalization-handoff-panel.tsx"),
    read("lib/user-personalization.ts"),
    read("app/phase25-user-personalization.css"),
    readRepo("supabase/migrations/20260927095219_user_personalization_handoff_v1.sql"),
  ]);

  assert.match(settings, /PersonalizationHandoffPanel/);
  assert.match(settings, /自分で入力した追加パーソナライズ/);

  for (const field of ["personaContext", "customInstructions", "avoidPhrases"]) {
    assert.match(personalization, new RegExp(field));
  }
  for (const column of ["persona_context", "custom_instructions", "avoid_phrases"]) {
    assert.match(personalization, new RegExp(column));
    assert.match(migration, new RegExp(column));
  }

  assert.match(personalization, /buildPersonalizationHandoffPrompt/);
  assert.match(personalization, /AAS パーソナライズ引き継ぎ/);
  assert.match(personalization, /ユーザーが明示した追加パーソナライズ/);
  assert.match(personalization, /記載されていない個人情報・経験・実績・感情は推測して補わない/);
  assert.match(personalization, /メモリやカスタム指示へ自動登録する依頼ではありません/);
  assert.match(personalization, /メモリやプロフィールへ自動登録する依頼ではありません/);
  assert.match(personalization, /パーソナライズ設定へ自動登録する依頼ではありません/);

  for (const label of [
    "AIへ伝える追加条件",
    "① 選ぶ",
    "② 追加する",
    "③ 足りない時だけ自由入力",
    "AIに伝えたい執筆上の前提",
    "追加の文章・回答指示",
    "避けたい言葉・表現",
  ]) {
    assert.match(panel, new RegExp(label));
  }

  assert.match(panel, /AI_PROVIDER_LABELS\[provider\]\}用をコピー/);
  assert.match(panel, /Object\.keys\(PROVIDER_GUIDANCE\)/);

  for (const secret of ["パスワード", "APIキー", "アクセストークン", "認証コード", "クレジットカード"]) {
    assert.match(panel, new RegExp(secret));
  }
  assert.match(panel, /一時チャットではパーソナライズされた回答は利用できません/);
  assert.match(panel, /シークレットチャットでは既存メモリを使いません/);
  assert.match(panel, /AASの設定がChatGPTのメモリやカスタム指示へ自動登録されるわけではありません/);
  assert.match(panel, /個人最適化がONの場合はAASが生成する記事・SNSプロンプトへ自動反映/);
  assert.match(panel, /ChatGPT・Claude・Gemini/);

  assert.match(migration, /char_length\(persona_context\) <= 1200/);
  assert.match(migration, /char_length\(custom_instructions\) <= 2400/);
  assert.match(migration, /char_length\(avoid_phrases\) <= 1200/);
  assert.doesNotMatch(migration, /service[_-]?role|security definer/i);

  assert.match(css, /\.personalization-handoff/);
  assert.match(css, /\.personalization-provider-handoff/);
  assert.match(css, /@media \(max-width: 650px\)[\s\S]*?\.personalization-provider-handoff/);
});

test("personalization UI is dropdown-first with addable presets and free input", async () => {
  const [settings, panel, personalization, css] = await Promise.all([
    read("components/pwa-settings-page.tsx"),
    read("components/personalization-handoff-panel.tsx"),
    read("lib/user-personalization.ts"),
    read("app/phase25-user-personalization.css"),
  ]);

  for (const label of [
    "AIの書き方を自分好みにする",
    "STEP 1",
    "普段使うAIと投稿先",
    "STEP 2",
    "文章の書き方",
    "主なジャンル",
    "その他・自由入力",
    "誇張・煽り表現",
  ]) {
    assert.match(settings, new RegExp(label));
  }
  assert.match(settings, /COMMON_PERSONALIZATION_GENRES/);
  assert.match(settings, /<select/);
  assert.match(settings, /ジャンルを自由入力/);

  for (const label of [
    "AIへ伝える追加条件",
    "選んで追加",
    "自由入力を追加",
    "初心者向けにする",
    "結論から書く",
    "具体例を入れる",
    "人間味を残す",
    "成果保証を避ける",
    "AI定型句を避ける",
    "絵文字の使いすぎを避ける",
  ]) {
    assert.match(panel, new RegExp(label));
  }
  assert.match(panel, /function PresetAdder/);
  assert.match(panel, /items\.length >= 12/);
  assert.match(panel, /onClick=\{\(\) => addItem\(selected\)\}/);
  assert.match(panel, /onClick=\{\(\) => addItem\(custom\)\}/);
  assert.match(panel, /onClick=\{\(\) => removeItem\(item\)\}/);
  assert.match(panel, /<optgroup/);
  assert.doesNotMatch(panel, /<textarea/);

  assert.match(personalization, /function personalizationItems/);
  assert.match(personalization, /for \(const item of personaContext\)/);
  assert.match(personalization, /for \(const item of customInstructions\)/);
  assert.match(personalization, /for \(const item of avoidPhrases\)/);
  assert.equal(personalization.includes(String.raw`.split(/\\\\r?\\\\n/)`), false);
  assert.equal(personalization.includes(String.raw`.split(/\\r?\\n/)`), true);
  assert.equal(personalization.includes(String.raw`.replace(/^[-・]\\\\s*/`), false);
  assert.equal(personalization.includes(String.raw`.replace(/^[-・]\\s*/`), true);

  assert.match(css, /\.personalization-choice-section/);
  assert.match(css, /\.personalization-preset-add/);
  assert.match(css, /\.personalization-preset-chips/);
  assert.match(css, /\.personalization-custom-add/);
  assert.match(css, /@media \(max-width: 650px\)[\s\S]*?\.personalization-preset-add/);
});

test("prompt builder applies provider plan and optional user preferences", async () => {
  const personalization = await read("lib/user-personalization.ts");
  const creator = await read("lib/phase11-create.ts");
  for (const label of ["使用AI向けAAS最適化", "このユーザー向け文章設定", "無料版で扱いやすいよう", "詳細条件を最後まで保持", "ARTICLE BRIEFの条件をチェックリストとして内部確認"]) {
    assert.match(personalization, new RegExp(label));
  }
  assert.match(creator, /buildUserPromptContext/);
  assert.match(creator, /getRuntimeWritingProfile/);
  assert.match(creator, /recordPersonalizationSignal/);
  assert.match(creator, /ai_provider/);
  assert.match(creator, /ai_plan/);
});

test("article wizard supports direct back navigation and safe clearing of pasted AI content", async () => {
  const [page, steps, css] = await Promise.all([
    read("components/phase11-create-page.tsx"),
    read("components/article-create/article-create-steps.tsx"),
    read("app/phase9-11.css"),
  ]);

  assert.match(page, /jumpBackToStep/);
  assert.match(page, /index < displayStep/);
  assert.match(page, /STEP \$\{index \+ 1\}「\$\{label\}」へ戻る/);
  assert.match(steps, /タイトル候補をクリア/);
  assert.match(steps, /本文をクリア/);
  assert.match(steps, /window\.confirm\("貼り付けたタイトル候補/);
  assert.match(steps, /window\.confirm\("貼り付けた本文/);
  assert.match(steps, /currentAiLaunchOptions/);
  assert.match(steps, /選択中の\{app\.label\}を開く/);
  assert.match(css, /\.wizard-steps li\.done button/);
  assert.match(css, /\.clear-content-action/);
});

test("server profile stores small aggregate signals with strict self-only RLS", async () => {
  const migration = await readRepo("supabase/migrations/20260913111500_user_writing_profiles.sql");
  const invoker = await readRepo("supabase/migrations/20260913123500_user_writing_profiles_rpc_invoker.sql");
  assert.match(migration, /create table if not exists public\.user_writing_profiles/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /force row level security/);
  assert.match(migration, /user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /private\.is_active_profile\(\)/);
  assert.match(migration, /record_my_personalization_signal/);
  assert.match(migration, /platform_counts/);
  assert.match(migration, /genre_counts/);
  assert.match(migration, /Raw article bodies, AI answers, and full prompt history are not stored here/);
  assert.match(invoker, /security invoker/);
  assert.doesNotMatch(`${migration}\n${invoker}`, /service[_-]?role|sb_secret_/i);
});

test("personalization UI has dedicated responsive styling", async () => {
  const css = await read("app/phase25-user-personalization.css");
  const layout = await read("app/layout.tsx");
  assert.match(layout, /phase25-user-personalization\.css/);
  assert.match(css, /\.ai-provider-grid/);
  assert.match(css, /\.personalization-settings/);
  assert.match(css, /@media \(max-width: 430px\)/);
});


test("legacy article preset storage stays compatible while the new creator uses account presets", async () => {
  const migration = await readRepo("supabase/migrations/20260919094500_article_presets_learning.sql");
  const serverLimit = await readRepo("supabase/migrations/20260919151101_article_presets_server_limit.sql");
  const api = await read("lib/article-presets.ts");
  const panel = await read("components/article-create/article-preset-panel.tsx");
  const page = await read("components/phase11-create-page.tsx");
  const progress = await read("lib/phase11-wizard-progress.ts");
  const css = await read("app/phase34-article-presets.css");
  const layout = await read("app/layout.tsx");

  assert.match(migration, /create table if not exists public\.article_presets/);
  assert.match(migration, /alter table public\.article_presets enable row level security/);
  assert.match(migration, /alter table public\.article_presets force row level security/);
  assert.match(migration, /user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /article_presets_one_default_idx/);
  assert.match(migration, /record_my_article_workflow_signal/);
  assert.match(serverLimit, /enforce_article_preset_limit/);
  assert.match(serverLimit, /preset_count >= 30/);
  assert.match(serverLimit, /article_presets_limit_30/);
  assert.match(serverLimit, /from public, anon, authenticated/);
  assert.doesNotMatch(migration, /article_body|ai_response|prompt_text/i);

  assert.match(api, /articlePresetFromDraft/);
  assert.match(api, /applyArticlePreset/);
  assert.match(api, /loadArticlePresets/);
  assert.match(api, /createArticlePreset/);
  assert.match(api, /setDefaultArticlePreset/);
  assert.match(api, /deleteArticlePreset/);
  assert.match(api, /最大30件/);

  for (const label of ["いつものnote設定", "プリセットを選択", "選択中のプリセットを削除", "現在の設定を保存", "既定にする", "あなた向け最適化がON"]) {
    assert.match(panel, new RegExp(label));
  }
  assert.match(panel, /<select/);
  assert.match(panel, /article-preset-picker-actions/);
  assert.match(panel, /article-preset-delete/);
  assert.doesNotMatch(page, /ArticlePresetPanel|applyArticlePreset/);
  assert.match(page, /activePresetId/);
  assert.match(page, /activeAccountPreset/);
  assert.match(page, /createArticleFromWizard[\s\S]*activePresetId/);
  assert.match(progress, /activePresetId/);
  assert.match(layout, /phase34-article-presets\.css/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.doesNotMatch(`${api}\n${panel}\n${page}`, /service[_-]?role|sb_secret_/i);
});

test("personalization learns structured article preferences without storing raw content", async () => {
  const migration = await readRepo("supabase/migrations/20260919094500_article_presets_learning.sql");
  const personalization = await read("lib/user-personalization.ts");
  const creator = await read("lib/phase11-create.ts");

  for (const signal of ["subgenre_counts", "article_type_counts", "age_group_counts", "target_length_counts", "preset_counts"]) {
    assert.match(migration, new RegExp(signal));
    assert.match(personalization, new RegExp(signal));
  }
  assert.match(personalization, /record_my_article_workflow_signal/);
  assert.match(personalization, /record_my_personalization_signal/);
  assert.match(personalization, /利用履歴上よく使うサブジャンル/);
  assert.match(personalization, /利用履歴上よく使う読者層/);
  assert.match(personalization, /利用履歴上よく使う文字数帯/);
  assert.match(creator, /article_preset_id/);
  assert.match(creator, /subgenre: draft\.subgenre/);
  assert.match(creator, /ageGroup: draft\.ageGroup/);
  assert.match(creator, /targetLength: draft\.targetLength/);
  assert.doesNotMatch(migration, /source_body|publish_body|AI回答全文|プロンプト全文/);
});
test("mobile and desktop reference UIs use distinct responsive layouts", async () => {
  const layout = await read("app/layout.tsx");
  const css = await read("app/phase35-device-layout.css");

  assert.match(layout, /phase35-device-layout\.css/);
  assert.match(css, /@media \(min-width: 900px\)/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /reference-create-shell \.creator-card/);
  assert.match(css, /reference-home-main/);
  assert.match(css, /reference-ranking-page/);
  assert.match(css, /reference-profile-page/);
  assert.match(css, /max-width: none;/);
  assert.match(css, /\.reference-create-shell \.creator-card \{[\s\S]*?width: 100%;[\s\S]*?border-radius: 0;/);
  assert.match(css, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /grid-template-columns: 1fr;/);
});

