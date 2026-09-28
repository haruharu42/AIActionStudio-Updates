import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true, hmr: false },
});
after(() => vite.close());

const helpers = await vite.ssrLoadModule("/components/note-operations/note-operations-page-helpers.ts");
const draftLib = await vite.ssrLoadModule("/lib/article-create-draft.ts");
const profileLib = await vite.ssrLoadModule("/lib/note-operation-profile.ts");
const prompts = await vite.ssrLoadModule("/lib/note-operation-prompts.ts");

function profile(overrides = {}) {
  return {
    ...profileLib.defaultNoteOperationProfile("00000000-0000-4000-8000-000000000001"),
    articleGenre: "SNS運用",
    articleSubgenre: "X",
    freePostsPerMonth: 12,
    paidPostsPerMonth: 4,
    freeTargetLength: 3500,
    paidTargetLength: 9000,
    ...overrides,
  };
}

test("note calendar handoff restores planned title, type, genre and length in article creation", () => {
  const planned = {
    id: "10000000-0000-4000-8000-000000000001",
    scheduledDate: "2026-10-05",
    scheduledTime: "20:00",
    itemType: "paid_note",
    title: "X運用で最初に整えたい導線設計",
    theme: "Xからnoteへ読者をつなぐ導線",
    status: "planned",
    source: "generated",
    notes: "",
  };

  const href = helpers.createHref(planned, profile());
  assert.match(href, /^\/create\?/);

  const params = new URLSearchParams(href.split("?")[1]);
  assert.equal(params.get("title"), planned.title);
  assert.equal(params.get("theme"), planned.theme);
  assert.equal(params.get("publicationTarget"), "note");
  assert.equal(params.get("articleType"), "paid");
  assert.equal(params.get("genre"), "SNS運用");
  assert.equal(params.get("subgenre"), "X");
  assert.equal(params.get("targetLength"), "9000");
  assert.equal(params.get("from"), "note-operations");

  const draft = draftLib.createInitialArticleDraft(params);
  assert.equal(draft.title, planned.title);
  assert.equal(draft.theme, planned.theme);
  assert.equal(draft.publicationTarget, "note");
  assert.equal(draft.articleType, "paid");
  assert.equal(draft.genre, "SNS運用");
  assert.equal(draft.subgenre, "X");
  assert.equal(draft.targetLength, 9000);
  assert.equal(draft.price, 980);
});

test("free note calendar handoff uses the free article target length", () => {
  const planned = {
    scheduledDate: "2026-10-08",
    scheduledTime: "12:00",
    itemType: "free_note",
    title: "初心者向けX投稿の考え方",
    theme: "",
    status: "planned",
    source: "generated",
    notes: "",
  };

  const href = helpers.createHref(planned, profile());
  const params = new URLSearchParams(href.split("?")[1]);
  assert.equal(params.get("articleType"), "free");
  assert.equal(params.get("title"), planned.title);
  assert.equal(params.get("theme"), planned.title);
  assert.equal(params.get("targetLength"), "3500");

  const draft = draftLib.createInitialArticleDraft(params);
  assert.equal(draft.title, planned.title);
  assert.equal(draft.theme, planned.title);
  assert.equal(draft.targetLength, 3500);
  assert.equal(draft.price, null);
});

test("monthly note planning treats counts as soft targets and includes prior-month evidence", () => {
  const currentPerformance = {
    targetMonth: "2026-09",
    scheduledPosts: 14,
    donePosts: 8,
    skippedPosts: 2,
    remainingPlannedPosts: 4,
    freeScheduled: 10,
    paidScheduled: 4,
    freeDone: 6,
    paidDone: 2,
    adherenceRate: 57.1,
    weekdays: [],
    times: [],
  };
  const currentOutput = {
    targetMonth: "2026-09",
    createdPosts: 11,
    freeCreated: 8,
    paidCreated: 3,
    draftLike: 5,
    readyLike: 6,
    published: 2,
    statusCounts: { draft: 5, ready: 4, published: 2 },
  };
  const previousPerformance = {
    ...currentPerformance,
    targetMonth: "2026-08",
    scheduledPosts: 16,
    donePosts: 12,
    skippedPosts: 1,
    remainingPlannedPosts: 3,
    freeDone: 9,
    paidDone: 3,
    adherenceRate: 75,
  };
  const previousOutput = {
    ...currentOutput,
    targetMonth: "2026-08",
    createdPosts: 13,
    freeCreated: 10,
    paidCreated: 3,
  };

  const prompt = prompts.buildNoteScheduleResearchPrompt(
    profile(),
    "chatgpt",
    "2026-09",
    "2026-09-28",
    currentPerformance,
    currentOutput,
    previousPerformance,
    previousOutput,
  );

  assert.match(prompt, /月間目安（ノルマではない）/);
  assert.match(prompt, /無料note: 月 12本を目安/);
  assert.match(prompt, /有料note: 月 4本を目安/);
  assert.match(prompt, /無料noteの文字数初期値: 約3500文字/);
  assert.match(prompt, /有料noteの文字数初期値: 約9000文字/);
  assert.match(prompt, /詳細ジャンル: SNS運用/);
  assert.match(prompt, /サブジャンル: X/);
  assert.match(prompt, /概ね20%程度の増減を許容/);
  assert.match(prompt, /前月のAAS運用スケジュール実績/);
  assert.match(prompt, /前月にAASで実際に作成したnote記事数/);
  assert.match(prompt, /すでに作成した無料\/有料noteを月間目安へ含め/);
});
