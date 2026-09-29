import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const pwaRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(pwaRoot, "..");
const readPwa = (relative) => readFile(path.join(pwaRoot, relative), "utf8");
const readNoteOperationsLibSource = async () => (await Promise.all([
  "lib/note-operations.ts",
  "lib/note-operation-prompts.ts",
].map((relative) => readPwa(relative)))).join("\n");
const readNoteOperationsSource = async () => (await Promise.all([
  "components/note-operations-page.tsx",
  "components/note-operations/note-operations-static-tabs.tsx",
].map((relative) => readPwa(relative)))).join("\n");
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

test("note operations keeps static start and calendar tabs outside the controller page", async () => {
  const [page, staticTabs] = await Promise.all([
    readPwa("components/note-operations-page.tsx"),
    readPwa("components/note-operations/note-operations-static-tabs.tsx"),
  ]);

  assert.match(page, /NoteStartGuideTab/);
  assert.match(page, /NoteCalendarTab/);
  assert.match(staticTabs, /export function NoteStartGuideTab/);
  assert.match(staticTabs, /export function NoteCalendarTab/);
  assert.doesNotMatch(staticTabs, /getSupabaseClient|\.rpc\(|saveNoteOperationProfile|replaceNoteSchedule/);
});

test("note operations keeps prompt generation pure and separate from persistence", async () => {
  const [lib, prompts] = await Promise.all([
    readPwa("lib/note-operations.ts"),
    readPwa("lib/note-operation-prompts.ts"),
  ]);

  assert.match(lib, /from "@\/lib\/note-operation-prompts"/);
  assert.match(prompts, /export function buildNoteProfileDraft/);
  assert.match(prompts, /export function buildNoteAccountResearchPrompt/);
  assert.match(prompts, /export function buildNoteScheduleResearchPrompt/);
  assert.doesNotMatch(prompts, /SupabaseClient|\.from\(|\.rpc\(|replaceNoteScheduleAtomically/);
});

test("note operations data is owner-scoped and never stores note credentials", async () => {
  const migration = await readRepo("supabase/migrations/20260919123613_note_operations_planner_v1.sql");

  for (const table of ["note_operation_profiles", "note_operation_schedule_items"]) {
    assert.match(migration, new RegExp("create table if not exists public\\." + table));
    assert.match(migration, new RegExp("alter table public\\." + table + " enable row level security"));
    assert.match(migration, new RegExp("alter table public\\." + table + " force row level security"));
  }

  assert.match(migration, /user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /private\.is_active_profile\(\)/);
  assert.match(migration, /public\.can_access_product\('AAS-PWA-BETA'\)/);
  assert.match(migration, /note_operation_schedule_limit_500/);
  assert.match(migration, /Never stores note credentials, cookies, or authentication tokens/);
  assert.doesNotMatch(migration, /grant .* to anon/i);
  assert.doesNotMatch(migration, /service[_-]?role|sb_secret_|access[_-]?token|refresh[_-]?token/i);
});

test("note operations engine generates mixed schedules and supports download upload formats", async () => {
  const [lib, transfer, performance] = await Promise.all([
    readNoteOperationsLibSource(),
    readPwa("lib/note-operations-transfer.ts"),
    readPwa("lib/note-schedule-performance.ts"),
  ]);

  assert.match(lib, /generateNoteSchedule/);
  assert.match(lib, /paidPostsPerMonth/);
  assert.match(lib, /free_note/);
  assert.match(lib, /paid_note/);
  assert.match(lib, /review/);
  assert.match(lib, /profile_setup/);
  assert.match(lib, /exportNoteScheduleCsv/);
  assert.match(lib, /exportNoteOperationsJson/);
  assert.match(transfer, /aas-note-operations-v1/);
  assert.match(performance, /summarizeNoteSchedulePerformance/);
  assert.match(performance, /formatSchedulePerformanceForPrompt/);
  assert.match(performance, /NOTE_PERFORMANCE_WEEKDAYS/);
  assert.match(lib, /parseNoteOperationsImport/);
  assert.match(lib, /replaceNoteSchedule/);
  assert.match(lib, /todayJstDateKey/);
  assert.match(lib, /Asia\/Tokyo/);
});

test("note operations UI covers setup profile planning calendar and home todo", async () => {
  const [page, today, home, tools, toolCatalog, desktop, mobile, layout, css] = await Promise.all([
    readNoteOperationsSource(),
    readPwa("components/note-today-panel.tsx"),
    readPwa("components/phase18-beginner-home.tsx"),
    readPwa("components/phase-tools-page.tsx"),
    readPwa("features/tools/tool-catalog.ts"),
    readPwa("lib/desktop-nav-preference.ts"),
    readPwa("lib/mobile-nav-preference.ts"),
    readPwa("app/layout.tsx"),
    readPwa("app/phase38-note-operations.css"),
  ]);

  for (const label of [
    "noteを始める順番",
    "初心者向け・選ぶだけプロフィール設計",
    "AIに1か月の運用スケジュールを決めてもらう",
    "AIの回答をそのままAASへ反映",
    "この月のAASスケジュールに反映",
    "現在の予定をCSV保存",
    "AAS運営データをJSON保存",
    "従来JSON/CSVを読み込む",
    "カレンダー",
    "この記事を作る",
  ]) {
    assert.match(page, new RegExp(label));
  }

  assert.match(page, /noteプレミアム \/ note pro/);
  assert.match(page, /パスワード、Cookie、認証コード、アクセストークン/);
  assert.match(page, /入力した事実だけ/);
  assert.match(page, /note\.com\/info\/n\/n27cb842c7737/);
  assert.match(page, /note\.com\/info\/n\/na5f43ec69740/);
  assert.match(page, /note\.com\/info\/n\/nc84e9a40b092/);

  assert.match(today, /今日のnote作成/);
  assert.match(today, /完了にする/);
  assert.match(home, /NoteTodayPanel/);
  assert.match(home, /ownerId=\{profile\.id\}/);
  assert.match(tools, /MEMBER_TOOL_GROUPS/);
  assert.match(toolCatalog, /href: "\/note-operations"/);
  assert.match(desktop, /key: "noteOps"/);
  assert.match(desktop, /label: "note運営"/);
  assert.match(mobile, /key: "noteOps"/);
  assert.match(layout, /phase38-note-operations\.css/);
  assert.match(css, /\.note-calendar-grid/);
  assert.match(css, /\.note-today-list/);

  assert.doesNotMatch(`${page}\n${today}\n${home}`, /service[_-]?role|sb_secret_|sk_(?:live|test)_|whsec_/i);
});


test("note beginner profile builder uses dropdown presets and current-web research prompts", async () => {
  const [migration, lib, profileLib, page, css] = await Promise.all([
    readRepo("supabase/migrations/20260919125425_note_operations_profile_builder_presets.sql"),
    readNoteOperationsLibSource(),
    readPwa("lib/note-operation-profile.ts"),
    readNoteOperationsSource(),
    readPwa("app/phase38-note-operations.css"),
  ]);

  for (const column of [
    "account_genre",
    "account_style",
    "audience_preset",
    "tone_preset",
    "monetization_style",
  ]) {
    assert.match(migration, new RegExp(column));
  }

  for (const optionSet of [
    "NOTE_ACCOUNT_GENRES",
    "NOTE_ACCOUNT_STYLES",
    "NOTE_AUDIENCE_PRESETS",
    "NOTE_TONE_PRESETS",
    "NOTE_MONETIZATION_STYLES",
  ]) {
    assert.match(profileLib, new RegExp(optionSet));
    assert.match(lib, new RegExp(optionSet));
  }

  assert.match(lib, /buildNoteAccountResearchPrompt/);
  assert.match(lib, /回答を作る前に必ずWeb検索/);
  assert.match(lib, /note公式/);
  assert.match(lib, /直近90日/);
  assert.match(lib, /直近12か月/);
  assert.match(lib, /出典名・URL・公開\/更新日/);
  assert.match(lib, /最新情報を確認できないため/);
  assert.match(lib, /経歴、年齢、職業、収入、実績、資格/);
  assert.match(lib, /アカウント構成を3案/);

  assert.match(page, /noteアカウントの大きなジャンル/);
  assert.match(page, /記事作成で使う詳細ジャンル/);
  assert.match(page, /記事作成で使うサブジャンル/);
  assert.match(page, /どんなアカウントにしたい/);
  assert.match(page, /主に誰に届けたい/);
  assert.match(page, /文体・文章の雰囲気/);
  assert.match(page, /収益化はどうしたい/);
  assert.match(profileLib, /その他（自由入力）/);
  assert.match(page, /chatgpt","gemini","claude/);
  assert.match(page, /現在のよく使うAI/);
  assert.match(page, /最新情報から構成候補を作る/);
  assert.match(page, /navigator\.clipboard\.writeText/);
  assert.match(page, /launchAiApp\(selectedAi\)/);
  assert.match(page, /saveWritingProfile/);
  assert.match(css, /\.note-profile-choice-grid/);
  assert.match(css, /\.note-ai-provider-grid/);
  assert.doesNotMatch(`${lib}\n${page}\n${migration}`, /service[_-]?role|sb_secret_|sk_(?:live|test)_|whsec_/i);
});


test("note profile stores detailed article defaults and soft monthly targets", async () => {
  const [columnsMigration, constraintsMigration, lib, profileLib, page, helpers, staticTabs, createDraft, css] = await Promise.all([
    readRepo("supabase/migrations/20260928093057_note_operation_monthly_targets_and_article_defaults_v1.sql"),
    readRepo("supabase/migrations/20260928093155_note_operation_profile_flexibility_constraints_v1.sql"),
    readNoteOperationsLibSource(),
    readPwa("lib/note-operation-profile.ts"),
    readNoteOperationsSource(),
    readPwa("components/note-operations/note-operations-page-helpers.ts"),
    readPwa("components/note-operations/note-operations-static-tabs.tsx"),
    readPwa("lib/article-create-draft.ts"),
    readPwa("app/phase39-readability.css"),
  ]);

  for (const column of [
    "article_genre",
    "article_subgenre",
    "free_posts_per_month",
    "free_target_length",
    "paid_target_length",
  ]) assert.match(columnsMigration, new RegExp(column));

  assert.match(constraintsMigration, /paid_posts_per_month <= 60/);
  assert.match(constraintsMigration, /free_posts_per_month <= 60/);
  assert.match(constraintsMigration, /free_target_length >= 500/);
  assert.match(constraintsMigration, /paid_target_length <= 50000/);
  assert.match(constraintsMigration, /storytelling/);
  assert.match(constraintsMigration, /humorous/);

  assert.match(profileLib, /freePostsPerMonth: number/);
  assert.match(profileLib, /articleGenre: string/);
  assert.match(profileLib, /articleSubgenre: string/);
  assert.match(profileLib, /freeTargetLength: number/);
  assert.match(profileLib, /paidTargetLength: number/);
  for (const tone of ["logical", "empathetic", "storytelling", "concise", "essay", "warm", "formal", "humorous"]) {
    assert.match(profileLib, new RegExp(`value: "${tone}"`));
  }

  assert.match(lib, /free_posts_per_month: Math\.max\(0, Math\.min\(60/);
  assert.match(lib, /paid_posts_per_month: Math\.max\(0, Math\.min\(60/);
  assert.match(lib, /article_genre: profile\.articleGenre/);
  assert.match(lib, /free_target_length:/);
  assert.match(lib, /paid_target_length:/);

  assert.match(page, /月の記事作成数の目安/);
  assert.match(page, /この目安をAASに保存/);
  assert.match(page, /無料note \/ 月の目安/);
  assert.match(page, /有料note \/ 月の目安/);
  assert.match(page, /無料noteの文字数目安/);
  assert.match(page, /有料noteの文字数目安/);
  assert.match(page, /ノルマではありません/);
  assert.match(page, /前月までの実績/);
  assert.match(page, /previousPerformance/);
  assert.match(page, /previousArticleOutput/);
  assert.match(css, /\.note-monthly-target-card/);
  assert.match(css, /\.note-monthly-target-grid/);

  assert.match(helpers, /title: item\.title/);
  assert.match(helpers, /genre: profile\.articleGenre/);
  assert.match(helpers, /subgenre: profile\.articleSubgenre/);
  assert.match(helpers, /targetLength: String\(paid \? profile\.paidTargetLength : profile\.freeTargetLength\)/);
  assert.match(staticTabs, /createHref\(item, profile\)/);
  assert.match(createDraft, /const title = params\.get\("title"\)/);
  assert.match(createDraft, /const targetLength = Number\(params\.get\("targetLength"\)\)/);
  assert.match(createDraft, /source === "note-operations"/);
});

test("AI monthly note schedule uses month-based research, validation, and owner-scoped plan storage", async () => {
  const [migration, lib, parser, normalizer, planner, page, helpers, css, performance, persistenceMigration] = await Promise.all([
    readRepo("supabase/migrations/20260919131121_note_ai_monthly_schedule_plans.sql"),
    readNoteOperationsLibSource(),
    readPwa("lib/note-ai-schedule-json.ts"),
    readPwa("lib/note-ai-schedule-normalize.ts"),
    readPwa("lib/note-ai-schedule-plan.ts"),
    readNoteOperationsSource(),
    readPwa("components/note-operations/note-operations-page-helpers.ts"),
    readPwa("app/phase38-note-operations.css"),
    readPwa("lib/note-schedule-performance.ts"),
    readRepo("supabase/migrations/20260925130712_audit_atomic_note_schedule_replace.sql"),
  ]);

  assert.match(migration, /create table if not exists public\.note_operation_schedule_plans/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /force row level security/);
  assert.match(migration, /user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /private\.is_active_profile\(\)/);
  assert.match(migration, /can_access_product\('AAS-PWA-BETA'\)/);
  assert.match(migration, /grant select, insert, update, delete on table public\.note_operation_schedule_plans to authenticated/);
  assert.doesNotMatch(migration, /grant .* to anon/i);

  for (const symbol of [
    "buildNoteScheduleResearchPrompt",
    "previousJstMonth",
    "summarizeNoteSchedulePerformance",
    "NoteSchedulePerformanceSnapshot",
    "loadNoteArticleOutputSnapshot",
    "NoteArticleOutputSnapshot",
    "exportNoteAiSchedulePlanJson",
    "extractNoteAiScheduleJson",
    "parseNoteAiSchedulePlan",
    "replaceNoteScheduleMonth",
    "saveNoteAiSchedulePlan",
    "loadNoteAiSchedulePlan",
    "aas-note-schedule-v2",
    "直近30日",
    "直近90日",
    "直近12か月",
    "投稿頻度",
    "paid_posts_per_week",
    "recommendation_reason",
  ]) {
    assert.match(lib, new RegExp(symbol));
  }

  assert.match(normalizer, /parseSimpleAiArticleSchedule/);
  assert.match(normalizer, /fallbackDailyPostingTimes/);
  assert.match(normalizer, /ensureDistinctDailyPostingTimes/);
  assert.match(normalizer, /2: \["12:00", "20:00"\]/);
  assert.match(normalizer, /3: \["09:00", "14:00", "20:00"\]/);
  assert.match(lib, /1日2回以上なら投稿回数と同じ行数/);
  assert.match(lib, /前文、挨拶、説明、要約、理由、注意書き、出典一覧、コードフェンス、表の後の文章は一切出力しない/);
  assert.match(lib, /Markdown表/);
  assert.match(lib, /\| 日付 \| 時刻 \| 種別 \| 記事タイトル \| テーマ \|/);
  assert.match(lib, /最終回答は、AASへそのままコピー＆ペーストする次のMarkdown表だけを返す/);
  assert.match(planner, /AI回答内の無料note・有料note作成予定をAASが直接読み取りました/);
  assert.match(normalizer, /normalizeAiArticleScheduleType/);
  assert.match(normalizer, /無料note作成/);
  assert.match(normalizer, /有料note作成/);
  assert.match(lib, /scheduleに入れてよいtypeは free_note と paid_note の2種類だけ/);
  assert.match(persistenceMigration, /item_type in \('free_note','paid_note'\)/);
  assert.match(page, /articleSchedule/);
  assert.match(page, /無料note \/ 有料noteの作成日・時間/);
  assert.match(page, /AIにはAASへ貼る予定表だけを返すよう指示します/);
  assert.match(parser, /balancedJsonObjects/);
  assert.match(parser, /scheduleRootFromValue/);
  assert.match(parser, /ChatGPTの回答全文を削らず/);
  assert.match(parser, /AAS用の運用スケジュールが回答内に見つかりませんでした/);
  assert.match(planner, /対象月の外にある予定/);
  assert.match(planner, /同じ日時に記事投稿が重複/);
  assert.match(planner, /1日に最大/);
  assert.match(planner, /調査元URLがありません/);
  assert.match(planner, /note公式（note\.com\/info）/);
  assert.match(planner, /直近180日以内の出典/);
  assert.match(persistenceMigration, /then v_today else p_target_month/);
  assert.match(lib, /status === "done"/);
  assert.match(lib, /AAS運用スケジュール実績/);
  assert.match(lib, /AASで実際に作成したnote記事数/);
  assert.match(lib, /前月のAAS運用スケジュール実績/);
  assert.match(lib, /前月にAASで実際に作成したnote記事数/);
  assert.match(lib, /月間目安（ノルマではない）/);
  assert.match(lib, /概ね20%程度の増減/);
  assert.match(performance, /投稿予定に対する完了率/);
  assert.match(lib, /無料30本・有料20本/);
  assert.match(lib, /未完了分やスキップ分を「借金」/);
  assert.match(lib, /今日から月末までに新しく行う分/);
  assert.match(performance, /曜日別/);
  assert.match(performance, /時刻別/);
  assert.match(lib, /AASから渡していない本文、PV、売上、購入率/);
  assert.match(lib, /item\.itemType === "free_note" \|\| item\.itemType === "paid_note"/);
  assert.match(persistenceMigration, /status = 'planned'/);
  assert.match(persistenceMigration, /scheduled_date between v_start and v_end/);
  assert.match(persistenceMigration, /security invoker/);

  assert.match(page, /type="month"/);
  assert.match(page, /min=\{currentJstMonth\(\)\}/);
  assert.match(page, /月間目安から実際の無料\/有料本数を調整/);
  assert.match(page, /1日に何回まで投稿するか/);
  assert.match(page, /前月・今月の実績に合わせた増減/);
  assert.match(page, /ChatGPT \/ Gemini \/ Claude/);
  assert.match(page, /コピーしたAI回答を読み込んで反映/);
  assert.match(page, /貼り付けた回答をそのまま反映/);
  assert.match(page, /反映前に内容だけ確認/);
  assert.match(page, /importAndApplyAiSchedule/);
  assert.match(page, /navigator\.clipboard\?\.readText/);
  assert.match(helpers, /NOTE_SCHEDULE_RESPONSE_STORAGE_PREFIX/);
  assert.match(page, /window\.localStorage\.getItem/);
  assert.match(page, /window\.localStorage\.setItem/);
  assert.match(page, /window\.localStorage\.removeItem/);
  assert.match(page, /貼り付け内容をクリア/);
  assert.match(page, /previewPostingTimes\.join\(" \/ "\)/);
  assert.match(page, /投稿時間/);
  assert.doesNotMatch(page, /setSchedulePrompt\(prompt\);\s*setScheduleResponse\(""/);
  assert.match(page, /この月のAASスケジュールに反映/);
  assert.match(page, /他の月の予定は残ります/);
  assert.match(page, /なぜこの頻度にしたか/);
  assert.match(page, /今月の実績から残り期間を組み直せます/);
  assert.match(page, /referencePerformance\.adherenceRate/);
  assert.match(page, /articleOutput\.freeCreated/);
  assert.match(page, /previousArticleOutput/);
  assert.match(page, /previousPerformance/);
  assert.match(page, /本文・PV・売上・購入率はAIへ渡しません/);
  assert.match(page, /AAS用JSONをコピー/);
  assert.match(page, /JSONファイルで保存/);
  assert.match(page, /今日以降の予定を組み直して反映/);
  assert.match(helpers, /NOTE_PERFORMANCE_LOOP_MIN_RELEASE = "0\.1\.1"/);
  assert.match(helpers, /releaseVersionAtLeast/);
  assert.match(helpers, /readEffectiveRelease/);
  assert.match(helpers, /ai-article-studio-pwa-preview/);
  assert.match(helpers, /noteOperationsGateFor/);
  assert.match(page, /performanceLoopEnabled \? referencePerformance : undefined/);
  assert.match(page, /loadNoteArticleOutputSnapshot/);
  assert.match(page, /schedulePreview\.sources/);

  assert.match(css, /\.note-ai-month-controls/);
  assert.match(css, /\.note-ai-import-box/);
  assert.match(css, /\.note-ai-plan-preview/);
  assert.doesNotMatch(`${migration}\n${lib}\n${page}`, /service[_-]?role|sb_secret_|sk_(?:live|test)_|whsec_/i);
  assert.match(lib, /select\("id", \{ count: "exact", head: true \}\)/);
  assert.match(lib, /eq\("publication_target", "note"\)/);
  assert.match(lib, /gte\("created_at", startIso\)/);
  assert.match(lib, /lt\("created_at", endIso\)/);
  assert.doesNotMatch(lib, /articleOutput\.(?:title|theme|body|revenue|pv)/);
});


test("note schedule import accepts full AI response prose and keeps file import as fallback", async () => {
  const [lib, parser, page, css, layout] = await Promise.all([
    readNoteOperationsLibSource(),
    readPwa("lib/note-ai-schedule-json.ts"),
    readNoteOperationsSource(),
    readPwa("app/phase39-readability.css"),
    readPwa("app/layout.tsx"),
  ]);

  assert.match(lib, /export \{ extractNoteAiScheduleJson \} from "@\/lib\/note-ai-schedule-json"/);
  assert.match(parser, /export function extractNoteAiScheduleJson/);
  assert.match(parser, /matchAll\(fencePattern\)/);
  assert.match(parser, /balancedJsonObjects\(rawText\)/);
  assert.match(parser, /object\.schema === "aas-note-schedule-v2"/);
  assert.match(page, /AIの回答をそのままAASへ反映/);
  assert.match(page, /JSONは不要です/);
  assert.match(page, /コピーしたAI回答を読み込んで反映/);
  assert.match(page, /ファイルから反映/);
  assert.match(css, /\.note-ai-easy-import/);
  assert.match(layout, /phase39-readability\.css/);
});


test("AI note calendar is article-only and tolerates common free paid aliases", async () => {
  const [lib, parser, normalizer, planner, page, today] = await Promise.all([
    readNoteOperationsLibSource(),
    readPwa("lib/note-ai-schedule-json.ts"),
    readPwa("lib/note-ai-schedule-normalize.ts"),
    readPwa("lib/note-ai-schedule-plan.ts"),
    readNoteOperationsSource(),
    readPwa("components/note-today-panel.tsx"),
  ]);

  assert.match(normalizer, /\["free_note", "free", "free_article", "無料note", "無料ノート", "無料記事", "無料note作成"\]/);
  assert.match(normalizer, /\["paid_note", "paid", "paid_article", "有料note", "有料ノート", "有料記事", "有料note作成"\]/);
  assert.match(normalizer, /raw\.type \?\? raw\.item_type \?\? raw\.article_type/);
  assert.match(normalizer, /raw\.scheduled_date/);
  assert.match(normalizer, /raw\.scheduled_time/);
  assert.match(parser, /object\.targetMonth/);
  assert.match(parser, /Array\.isArray\(object\.calendar\)/);
  assert.match(parser, /Array\.isArray\(object\.items\)/);
  assert.match(planner, /root\.targetMonth/);
  assert.match(normalizer, /raw\.day/);
  assert.match(normalizer, /raw\.name/);
  assert.match(normalizer, /rawTitle \|\| fallbackTitle/);
  assert.match(lib, /isNoteArticleScheduleItem\(item\)/);
  assert.match(page, /schedule\.filter\(\(item\) => isNoteArticleScheduleItem\(item\)\)/);
  assert.match(page, /articleSchedule\.slice\(0, 120\)/);
  assert.match(today, /value\.filter\(\(item\) => isNoteArticleScheduleItem\(item\)\)/);
});


test("note schedule can be recovered from a plain markdown table without JSON", async () => {
  const [normalizer, page, manual] = await Promise.all([
    readPwa("lib/note-ai-schedule-normalize.ts"),
    readNoteOperationsSource(),
    readPwa("app/manual/page.tsx"),
  ]);

  assert.match(normalizer, /function parseSimpleAiArticleSchedule/);
  assert.match(normalizer, /有料\(\?:note\|ノート\|記事\)/);
  assert.match(normalizer, /無料\(\?:note\|ノート\|記事\)/);
  assert.match(normalizer, /text\.split\(\/\\r\?\\n\//);
  assert.match(normalizer, /line\.split\("\|"\)/);
  const planner = await readPwa("lib/note-ai-schedule-plan.ts");
  assert.match(planner, /JSONではなくAI回答内の予定表・文章から読み取りました/);
  assert.match(page, /AIにはAASへ貼る予定表だけを返すよう指示します/);
  assert.match(page, /貼り付けた内容はこの端末でアカウント別に保存/);
  assert.match(manual, /JSONを作ったり編集したりする必要はありません/);
});


test("AI schedule output is copy-only, multi-post times are explicit, and pasted text persists until clear", async () => {
  const [lib, normalizer, page, helpers, css, manual] = await Promise.all([
    readNoteOperationsLibSource(),
    readPwa("lib/note-ai-schedule-normalize.ts"),
    readNoteOperationsSource(),
    readPwa("components/note-operations/note-operations-page-helpers.ts"),
    readPwa("app/phase39-readability.css"),
    readPwa("app/manual/page.tsx"),
  ]);

  assert.match(lib, /最終回答は、AASへそのままコピー＆ペーストする次のMarkdown表だけを返す/);
  assert.match(lib, /表以外の文字は出力しない/);
  assert.match(lib, /1日2回なら2行・2時刻、1日3回なら3行・3時刻/);
  assert.match(lib, /同日の時刻同士は原則3時間以上空ける/);
  assert.match(normalizer, /ensureDistinctDailyPostingTimes\(items\)/);
  assert.match(normalizer, /export function ensureDistinctDailyPostingTimes\(/);

  assert.match(helpers, /aas\.note\.schedule\.response\.v1/);
  assert.match(page, /scheduleResponseLoaded/);
  assert.match(page, /localStorage\.setItem\(key, scheduleResponse\)/);
  assert.match(page, /clearScheduleResponse/);
  assert.match(page, /貼り付けたAI回答をクリアしました/);
  assert.match(page, /note-plan-times/);
  assert.match(page, /previewPostingTimes/);
  assert.match(css, /\.note-plan-stats \.note-plan-times/);
  assert.match(manual, /前置きや説明文を除いてコピーしやすくします/);
  assert.match(manual, /「貼り付け内容をクリア」を押した時だけ削除/);
});


test("AAS note operation preset is available only inside the active-admin UI path", async () => {
  const [lib, profileLib, page, helpers, css] = await Promise.all([
    readNoteOperationsLibSource(),
    readPwa("lib/note-operation-profile.ts"),
    readNoteOperationsSource(),
    readPwa("components/note-operations/note-operations-page-helpers.ts"),
    readPwa("app/phase38-note-operations.css"),
  ]);

  assert.match(lib, /AAS_ADMIN_NOTE_PROFILE_PRESET/);
  assert.match(profileLib, /AI Action Studio（AAS）・AI副業・コンテンツ制作・運営支援/);
  assert.match(profileLib, /副業専用プロンプト/);
  assert.match(profileLib, /Knowledge活用/);
  assert.doesNotMatch(profileLib, /AI Article Studio（AAS）/);
  assert.match(profileLib, /applyAasAdminNoteProfilePreset/);
  assert.match(profileLib, /accountGenre: "other"/);
  assert.match(profileLib, /accountStyle: "other"/);
  assert.match(profileLib, /audiencePreset: "other"/);
  assert.match(profileLib, /monetizationStyle: "other"/);
  assert.match(profileLib, /operationGoal: "growth"/);
  assert.match(profileLib, /experienceNote/);
  assert.doesNotMatch(
    profileLib.match(/export function applyAasAdminNoteProfilePreset[\s\S]*?\n}/)?.[0] ?? "",
    /experienceNote:\s*"/,
  );

  assert.match(page, /useSharedAccessState/);
  assert.doesNotMatch(page, /auth\.getUser\(\)|\.from\("profiles"\)/);
  assert.match(helpers, /isAdmin: accessState\.profile\.role === "admin"/);
  assert.match(page, /\{gate\.isAdmin && \(/);
  assert.match(page, /ADMIN ONLY/);
  assert.match(page, /AAS運営用プロフィール設定/);
  assert.match(page, /一般ユーザーには表示されません/);
  assert.match(page, /applyAasAdminNoteProfilePreset\(profile\)/);
  assert.match(page, /AAS運営用設定を反映/);
  assert.match(page, /自動保存はされません/);

  assert.match(css, /\.note-aas-admin-preset/);
  assert.match(css, /\.note-aas-admin-preset-grid/);
  assert.doesNotMatch(`${lib}\n${page}`, /service[_-]?role|sb_secret_|sk_(?:live|test)_|whsec_/i);
});


test("note operation profile definitions are isolated behind a compatibility re-export", async () => {
  const [lib, profileLib] = await Promise.all([
    readNoteOperationsLibSource(),
    readPwa("lib/note-operation-profile.ts"),
  ]);

  assert.match(lib, /from "@\/lib\/note-operation-profile"/);
  assert.match(lib, /export \{[\s\S]*AAS_ADMIN_NOTE_PROFILE_PRESET[\s\S]*\} from "@\/lib\/note-operation-profile"/);
  assert.doesNotMatch(lib, /^export const NOTE_OPERATION_GOALS/m);
  assert.doesNotMatch(lib, /^export function defaultNoteOperationProfile/m);
  assert.doesNotMatch(lib, /^export const AAS_ADMIN_NOTE_PROFILE_PRESET/m);
  assert.match(profileLib, /^export type NoteOperationProfile =/m);
  assert.doesNotMatch(lib, /^export type NoteOperationProfile =/m);
  assert.match(profileLib, /^export const NOTE_OPERATION_GOALS/m);
  assert.match(profileLib, /^export function defaultNoteOperationProfile/m);
  assert.match(profileLib, /^export const AAS_ADMIN_NOTE_PROFILE_PRESET/m);
  assert.match(profileLib, /^export function applyAasAdminNoteProfilePreset/m);
});


test("note schedule contracts live in a dedicated type module while note-operations keeps compatibility exports", async () => {
  const [lib, types] = await Promise.all([
    readNoteOperationsLibSource(),
    readPwa("lib/note-schedule-types.ts"),
  ]);

  assert.match(lib, /from "@\/lib\/note-schedule-types"/);
  assert.match(lib, /export type \{[\s\S]*?NoteAiSchedulePlan[\s\S]*?NoteScheduleItem[\s\S]*?\} from "@\/lib\/note-schedule-types"/);
  assert.doesNotMatch(lib, /^export type NoteScheduleItemType =/m);
  assert.match(types, /export type NoteScheduleItemType = "free_note" \| "paid_note"/);
  assert.match(types, /export type NoteAiSchedulePlan/);
  assert.match(types, /schema: "aas-note-schedule-v2"/);
  assert.match(types, /export type NoteSchedulePerformanceSnapshot/);
  assert.match(types, /export type NoteArticleOutputSnapshot/);
});


test("note AI schedule JSON extraction is isolated as a pure parser module", async () => {
  const [lib, parser, planner] = await Promise.all([
    readNoteOperationsLibSource(),
    readPwa("lib/note-ai-schedule-json.ts"),
    readPwa("lib/note-ai-schedule-plan.ts"),
  ]);

  assert.doesNotMatch(lib, /import \{ extractNoteAiScheduleJson \} from "@\/lib\/note-ai-schedule-json"/);
  assert.match(lib, /export \{ extractNoteAiScheduleJson \} from "@\/lib\/note-ai-schedule-json"/);
  assert.match(planner, /import \{ extractNoteAiScheduleJson \} from "@\/lib\/note-ai-schedule-json"/);
  assert.doesNotMatch(lib, /^function stripJsonFence/m);
  assert.doesNotMatch(lib, /^function balancedJsonObjects/m);
  assert.match(parser, /function stripJsonFence/);
  assert.match(parser, /function scheduleRootFromValue/);
  assert.match(parser, /function balancedJsonObjects/);
  assert.match(parser, /export function extractNoteAiScheduleJson/);
  assert.doesNotMatch(parser, /SupabaseClient|getSupabaseClient|service[_-]?role|sb_secret_/i);
});


test("note schedule date and time helpers live in a dedicated core module", async () => {
  const [lib, core] = await Promise.all([
    readNoteOperationsLibSource(),
    readPwa("lib/note-schedule-core.ts"),
  ]);

  assert.match(lib, /from "@\/lib\/note-schedule-core"/);
  assert.match(lib, /export \{[\s\S]*?currentJstMonth[\s\S]*?noteMonthBounds[\s\S]*?previousJstMonth[\s\S]*?todayJstDateKey[\s\S]*?\} from "@\/lib\/note-schedule-core"/);
  assert.doesNotMatch(lib, /^export function todayJstDateKey/m);
  assert.doesNotMatch(lib, /^export function noteMonthBounds/m);
  assert.match(core, /export function todayJstDateKey/);
  assert.match(core, /timeZone: "Asia\/Tokyo"/);
  assert.match(core, /export function currentJstMonth/);
  assert.match(core, /export function noteMonthBounds/);
  assert.match(core, /export function previousJstMonth/);
  assert.match(core, /export function nextJstMonth/);
  assert.match(core, /export function normalizeNoteScheduleTime/);
  assert.match(core, /export function addNoteScheduleDays/);
});


test("AI note schedule normalization is isolated from persistence and UI concerns", async () => {
  const [lib, planner, normalizer] = await Promise.all([
    readNoteOperationsLibSource(),
    readPwa("lib/note-ai-schedule-plan.ts"),
    readPwa("lib/note-ai-schedule-normalize.ts"),
  ]);

  assert.match(planner, /from "@\/lib\/note-ai-schedule-normalize"/);
  assert.doesNotMatch(lib, /from "@\/lib\/note-ai-schedule-normalize"/);
  assert.doesNotMatch(lib, /^function normalizeAiArticleScheduleType/m);
  assert.doesNotMatch(lib, /^function fallbackDailyPostingTimes/m);
  assert.doesNotMatch(lib, /^function parseSimpleAiArticleSchedule/m);
  assert.match(normalizer, /function normalizeAiArticleScheduleType/);
  assert.match(normalizer, /function fallbackDailyPostingTimes/);
  assert.match(normalizer, /export function ensureDistinctDailyPostingTimes/);
  assert.match(normalizer, /export function parseSimpleAiArticleSchedule/);
  assert.match(normalizer, /export function parseAiScheduleItem/);
  assert.match(normalizer, /from "@\/lib\/note-schedule-core"/);
  assert.match(normalizer, /from "@\/lib\/note-schedule-types"/);
  assert.doesNotMatch(normalizer, /SupabaseClient|client\.from\(|\.rpc\(|React|useState|service[_-]?role|sb_secret_/i);
});


test("AI note schedule plan parsing is isolated behind a compatibility export", async () => {
  const [lib, planner] = await Promise.all([
    readNoteOperationsLibSource(),
    readPwa("lib/note-ai-schedule-plan.ts"),
  ]);

  assert.match(lib, /export \{ parseNoteAiSchedulePlan \} from "@\/lib\/note-ai-schedule-plan"/);
  assert.doesNotMatch(lib, /^export function parseNoteAiSchedulePlan/m);
  assert.match(planner, /export function parseNoteAiSchedulePlan/);
  assert.match(planner, /extractNoteAiScheduleJson/);
  assert.match(planner, /parseSimpleAiArticleSchedule/);
  assert.match(planner, /ensureDistinctDailyPostingTimes/);
  assert.match(planner, /NoteAiSchedulePlan/);
  assert.doesNotMatch(planner, /SupabaseClient|client\.from\(|\.rpc\(|React|useState|service[_-]?role|sb_secret_/i);
});


test("note operation file transfer helpers are isolated from scheduling and persistence", async () => {
  const [lib, transfer] = await Promise.all([
    readNoteOperationsLibSource(),
    readPwa("lib/note-operations-transfer.ts"),
  ]);

  assert.match(lib, /from "@\/lib\/note-operations-transfer"/);
  assert.doesNotMatch(lib, /^export function exportNoteScheduleCsv/m);
  assert.doesNotMatch(lib, /^export function exportNoteOperationsJson/m);
  assert.doesNotMatch(lib, /^export function parseNoteOperationsImport/m);
  assert.match(transfer, /export function exportNoteAiSchedulePlanJson/);
  assert.match(transfer, /export function exportNoteScheduleCsv/);
  assert.match(transfer, /export function exportNoteOperationsJson/);
  assert.match(transfer, /export function parseNoteOperationsImport/);
  assert.match(transfer, /parseCsvRecords/);
  assert.match(transfer, /aas-note-operations-v1/);
  assert.doesNotMatch(transfer, /SupabaseClient|client\.from\(|\.rpc\(|React|useState|service[_-]?role|sb_secret_/i);
});


test("note membership cockpit covers grounded improvement metrics and article source metadata", async () => {
  const [page, cockpit, advisor, metricsPanel, createPage, cockpitLib, metricsLib, knowledge, draftLib, createLib, css] = await Promise.all([
    readNoteOperationsSource(),
    readPwa("components/note-operations/note-membership-cockpit.tsx"),
    readPwa("components/note-operations/note-membership-advisor.tsx"),
    readPwa("components/note-operations/note-membership-metrics-panel.tsx"),
    readPwa("components/phase11-create-page.tsx"),
    readPwa("lib/note-membership-cockpit.ts"),
    readPwa("lib/note-membership-metrics.ts"),
    readPwa("lib/note-membership-advisor.ts"),
    readPwa("lib/article-create-draft.ts"),
    readPwa("lib/phase11-create.ts"),
    readPwa("app/phase38-note-operations.css"),
  ]);

  assert.match(page, /type Tab = "start" \| "profile" \| "plan" \| "calendar" \| "membership"/);
  assert.match(page, /5\. メンバーシップ相談/);
  assert.match(page, /NoteMembershipCockpit/);
  assert.match(page, /onOpenCalendar=\{\(\) => setTab\("calendar"\)\}/);

  assert.match(cockpit, /noteメンバーシップ運営コックピット/);
  for (const label of ["相談・設計","料金・特典診断","開始準備","紹介ページ","告知・集客","月間運営","改善相談"]) {
    assert.match(cockpit, new RegExp(label));
  }
  assert.match(cockpit, /NoteMembershipAdvisor/);
  assert.match(cockpit, /const copyTask = copy\(\);[\s\S]*?launchAiApp\(selectedAi\);[\s\S]*?await copyTask/);
  assert.doesNotMatch(cockpit, /await copy\(\);\s*launchAiApp\(selectedAi\)/);
  assert.match(advisor, /const copyTask = copyPrompt\(\);[\s\S]*?launchAiApp\(selectedAi\);[\s\S]*?await copyTask/);
  assert.doesNotMatch(advisor, /await copyPrompt\(\);\s*launchAiApp\(selectedAi\)/);
  assert.match(cockpit, /membershipLaunchStorageKey/);
  assert.match(cockpit, /window\.localStorage\.setItem/);
  assert.match(cockpit, /buildMembershipPricingPrompt/);
  assert.match(cockpit, /buildMembershipPagePrompt/);
  assert.match(cockpit, /buildMembershipPromotionPrompt/);
  assert.match(cockpit, /buildMembershipCalendarPrompt/);
  assert.match(cockpit, /buildMembershipImprovePrompt/);
  assert.match(cockpit, /NoteMembershipMetricsPanel/);
  assert.match(cockpit, /metricsEntries/);
  assert.match(cockpit, /buildMembershipImprovePrompt\(profile, improve, metricsEntries\)/);
  assert.match(cockpit, /メンバー限定用記事を作る/);
  assert.match(cockpit, /AASの「有料記事の有料エリア」とは別扱い/);

  assert.match(advisor, /noteメンバーシップ相談・設計/);
  assert.match(advisor, /何を相談しますか？/);
  assert.match(advisor, /希望する料金帯/);
  assert.match(advisor, /主な特典/);
  assert.match(advisor, /1ヶ月無料/);

  assert.match(knowledge, /NOTE_MEMBERSHIP_KNOWLEDGE/);
  assert.match(knowledge, /やりたいこと・得意なこと・読者ニーズ/);
  assert.match(knowledge, /2026年8月3日以降の新規加入/);
  assert.match(knowledge, /最大5プラン/);
  assert.match(knowledge, /会員数、継続率、売上、加入率を保証しない/);

  assert.match(cockpitLib, /NOTE_MEMBERSHIP_LAUNCH_CHECKLIST/);
  assert.match(cockpitLib, /紹介ページを作成/);
  assert.match(cockpitLib, /buildMembershipPricingPrompt/);
  assert.match(cockpitLib, /buildMembershipPromotionPrompt/);
  assert.match(cockpitLib, /buildMembershipCalendarPrompt/);
  assert.match(cockpitLib, /buildMembershipImprovePrompt/);
  assert.match(cockpitLib, /formatMembershipMetricsForPrompt\(metrics, 6\)/);
  assert.match(cockpitLib, /【ユーザー入力実績】/);
  assert.match(cockpitLib, /空欄・未入力の数値は推測、補完、逆算しない/);
  assert.match(cockpitLib, /実績データがないため、数値に基づく原因断定はしない/);
  assert.match(cockpitLib, /membershipArticleHref/);
  assert.match(cockpitLib, /from: "note-membership"/);
  assert.match(cockpitLib, /membershipArticleKind: mode/);
  assert.match(cockpitLib, /articleType: "free"/);

  assert.match(draftLib, /source === "note-membership"/);
  assert.match(draftLib, /articleCreationContextFromParams/);
  assert.match(draftLib, /membershipArticleKind/);
  assert.match(draftLib, /rawKind === "member" \|\| rawKind === "announcement" \|\| rawKind === "qa"/);
  assert.match(draftLib, /メンバー限定公開の設定はnote側で行います/);

  assert.match(createPage, /initialArticleCreationContextFromLocation/);
  assert.match(createPage, /const \[creationContext\] = useState/);
  assert.match(createPage, /activePresetId,[\s\S]*?creationContext/);

  assert.match(createLib, /export type ArticleCreationContext/);
  assert.match(createLib, /creation_source: creationContext\?\.source \?\? null/);
  assert.match(createLib, /note_membership_article_kind/);
  assert.match(createLib, /creationContext\?\.source === "note-membership"/);

  assert.match(metricsLib, /aas\.note\.membership\.metrics\.v1/);
  assert.match(metricsLib, /NOTE_MEMBERSHIP_METRICS_MAX_ENTRIES = 36/);
  assert.match(metricsLib, /parseMembershipMetricsEntry/);
  assert.match(metricsLib, /parseMembershipMetricsEntries/);
  assert.match(metricsLib, /upsertMembershipMetricsEntry/);
  assert.match(metricsLib, /formatMembershipMetricsForPrompt/);
  assert.match(metricsLib, /timeZone:\s*"Asia\/Tokyo"/);
  assert.match(metricsLib, /value > currentMembershipMetricsMonth\(\)/);
  assert.match(metricsPanel, /max=\{currentMembershipMetricsMonth\(\)\}/);
  for (const field of ["month", "memberCount", "newMembers", "cancellations", "revenueYen", "postCount", "operationHours", "memo"]) {
    assert.match(metricsLib, new RegExp(field));
  }
  assert.doesNotMatch(metricsLib, /email|password|cookie|access[_-]?token|refresh[_-]?token/i);

  assert.match(metricsPanel, /実績入力・改善履歴/);
  assert.match(metricsPanel, /membershipMetricsStorageKey\(userId\)/);
  assert.match(metricsPanel, /window\.localStorage\.getItem/);
  assert.match(metricsPanel, /window\.localStorage\.setItem/);
  assert.match(metricsPanel, /queueMicrotask/);
  assert.match(metricsPanel, /noteのログイン情報・Cookie・認証情報・会員個人情報は保存しません/);
  assert.match(metricsPanel, /入力した数値だけを改善相談へ渡します/);
  assert.match(metricsPanel, /parseMembershipMetricsEntry\(draft\)/);

  assert.match(css, /\.note-membership-cockpit/);
  assert.match(css, /\.note-membership-cockpit-tabs/);
  assert.match(css, /repeat\(7, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.note-membership-checklist/);
  assert.match(css, /\.note-membership-metrics-grid/);
  assert.match(css, /\.note-membership-metrics-history/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*?\.note-membership-metrics-grid/);
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*?\.note-membership-launch-links/);
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*?\.note-membership-metrics-grid/);

  assert.doesNotMatch(
    `${page}\n${cockpit}\n${advisor}\n${metricsPanel}\n${createPage}\n${cockpitLib}\n${metricsLib}\n${knowledge}\n${draftLib}\n${createLib}`,
    /service[_-]?role|sb_secret_|sk_(?:live|test)_|whsec_/i,
  );
});


test("membership advisor restores account-scoped selections and only opens external AI after a successful copy", async () => {
  const [advisor, advisorLib, cockpit] = await Promise.all([
    read("components/note-operations/note-membership-advisor.tsx"),
    read("lib/note-membership-advisor.ts"),
    read("components/note-operations/note-membership-cockpit.tsx"),
  ]);

  assert.match(advisorLib, /DEFAULT_NOTE_MEMBERSHIP_ADVISOR_INPUT/);
  assert.match(advisorLib, /aas\.note\.membership\.advisor\.v1/);
  assert.match(advisorLib, /readNoteMembershipAdvisorInput/);
  assert.match(advisorLib, /writeNoteMembershipAdvisorInput/);
  assert.match(advisorLib, /localStorage\.getItem/);
  assert.match(advisorLib, /localStorage\.setItem/);
  assert.match(advisor, /userId: string/);
  assert.match(advisor, /readNoteMembershipAdvisorInput\(userId\)/);
  assert.match(advisor, /writeNoteMembershipAdvisorInput\(userId, next\)/);
  assert.match(advisor, /const copied = await copyPrompt\(\)/);
  assert.match(advisor, /if \(copied\) launchAiApp\(selectedAi\)/);
  assert.match(cockpit, /<NoteMembershipAdvisor[\s\S]*?userId=\{userId\}/);
  assert.match(cockpit, /const copied = await copy\(\);[\s\S]*?if \(copied\) launchAiApp\(selectedAi\)/);
});


test("membership cockpit restores every planning workspace per account and persists before leaving", async () => {
  const [cockpit, cockpitLib] = await Promise.all([
    read("components/note-operations/note-membership-cockpit.tsx"),
    read("lib/note-membership-cockpit.ts"),
  ]);

  for (const marker of [
    "DEFAULT_MEMBERSHIP_PRICING_INPUT",
    "DEFAULT_MEMBERSHIP_PAGE_INPUT",
    "DEFAULT_MEMBERSHIP_PROMOTION_INPUT",
    "DEFAULT_MEMBERSHIP_CALENDAR_INPUT",
    "DEFAULT_MEMBERSHIP_IMPROVE_INPUT",
    "readMembershipCockpitProgress",
    "writeMembershipCockpitProgress",
    "aas.note.membership.cockpit.v1",
  ]) {
    assert.match(cockpitLib, new RegExp(marker.replaceAll(".", "\\.")));
  }

  assert.match(cockpit, /const \[workspaceHydrated, setWorkspaceHydrated\] = useState\(false\)/);
  assert.match(cockpit, /const restored = readMembershipCockpitProgress\(userId\)/);
  assert.match(cockpit, /setTab\(restored\.tab\)/);
  assert.match(cockpit, /setPricing\(restored\.pricing\)/);
  assert.match(cockpit, /setPageInput\(restored\.pageInput\)/);
  assert.match(cockpit, /setPromotion\(restored\.promotion\)/);
  assert.match(cockpit, /setCalendar\(restored\.calendar\)/);
  assert.match(cockpit, /setImprove\(restored\.improve\)/);
  assert.match(cockpit, /setArticleTheme\(restored\.articleTheme\)/);
  assert.match(cockpit, /writeMembershipCockpitProgress\(userId/);
  assert.match(cockpit, /window\.addEventListener\("pagehide"/);
  assert.match(cockpit, /window\.addEventListener\("beforeunload"/);
  assert.match(cockpit, /document\.addEventListener\("visibilitychange"/);
});


test("membership knowledge records the 2026-09-30 official billing recheck and legacy-membership exception", async () => {
  const source = await read("lib/note-membership-advisor.ts");
  assert.match(source, /checkedAt: "2026-09-30"/);
  assert.match(source, /2026年8月3日以降の新規加入では入会日基準の1か月ごとの請求/);
  assert.match(source, /2026年8月2日以前に開設されたメンバーシップ/);
  assert.match(source, /開設時期と現在設定を確認/);
  assert.match(source, /新方式を一律適用しない/);
});


test("membership cockpit never writes a previous account workspace into a newly selected account", async () => {
  const cockpit = await read("components/note-operations/note-membership-cockpit.tsx");
  assert.match(cockpit, /const workspaceOwnerRef = useRef\(""/);
  assert.match(cockpit, /workspaceOwnerRef\.current = ""/);
  assert.match(cockpit, /setWorkspaceHydrated\(false\)/);
  assert.match(cockpit, /workspaceOwnerRef\.current = userId/);
  assert.match(cockpit, /workspaceOwnerRef\.current !== userId/);
  assert.match(cockpit, /<NoteMembershipAdvisor[\s\S]*?key=\{userId\}/);
});


test("note operations restores the last account-scoped tab and only launches AI after clipboard success", async () => {
  const [page, helpers] = await Promise.all([
    read("components/note-operations-page.tsx"),
    read("components/note-operations/note-operations-page-helpers.ts"),
  ]);

  assert.match(helpers, /type NoteOperationsTab = "start" \| "profile" \| "plan" \| "calendar" \| "membership"/);
  assert.match(helpers, /aas\.note\.operations\.tab\.v1/);
  assert.match(helpers, /readNoteOperationsTab/);
  assert.match(helpers, /writeNoteOperationsTab/);
  assert.match(page, /setTab\(readNoteOperationsTab\(userId\)\)/);
  assert.match(page, /const changeTab = \(next: NoteOperationsTab\)/);
  assert.match(page, /writeNoteOperationsTab\(gate\.userId, next\)/);
  assert.match(page, /onClick=\{\(\) => changeTab\("membership"\)\}/);
  assert.match(page, /onOpenCalendar=\{\(\) => changeTab\("calendar"\)\}/);
  assert.match(page, /let copied = false;[\s\S]*?if \(copied\) launchAiApp\(selectedAi\)/);
  assert.match(page, /AIは自動で開いていません/);
});
