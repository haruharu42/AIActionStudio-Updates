import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

const create = await vite.ssrLoadModule("/lib/phase11-create.ts");
const draftHelpers = await vite.ssrLoadModule("/lib/article-create-draft.ts");
const images = await vite.ssrLoadModule("/lib/phase13-image-prompts.ts");

function baseDraft(overrides = {}) {
  return {
    ...draftHelpers.DEFAULT_ARTICLE_DRAFT,
    title: "初心者向けテスト記事",
    genre: "AI副業",
    subgenre: "ChatGPT",
    ageGroup: "全年代",
    gender: "性別を限定しない",
    targetLength: 5000,
    coverEnabled: true,
    inlineEnabled: true,
    inlineCount: 2,
    body: `導入です。

<!-- IMAGE:01 -->

## 手順
本文です。

<!-- IMAGE:02 -->

まとめです。`,
    ...overrides,
  };
}

test("article wizard validates conditions at the step where users edit them", () => {
  assert.equal(
    draftHelpers.validateArticleCreateStep(2, baseDraft({ inlineCount: 0 })),
    "挿絵枚数は1〜10枚で指定してください。",
  );
  assert.equal(
    draftHelpers.validateArticleCreateStep(3, baseDraft({ targetLength: 499 })),
    "文字数目安は500〜50000文字で指定してください。",
  );
  assert.equal(
    draftHelpers.validateArticleCreateStep(3, baseDraft({ articleType: "paid", price: 0 })),
    "有料記事は1以上の整数価格を設定してください。",
  );
  assert.equal(
    draftHelpers.validateArticleCreateStep(4, baseDraft({ title: "   " })),
    "タイトルを1〜500文字で入力してください。候補を選ぶか、タイトルを直接入力してください。",
  );
  assert.equal(draftHelpers.validateArticleCreateStep(4, baseDraft()), null);
});

test("paid and inline markers are required before leaving the body step", () => {
  assert.match(
    draftHelpers.validateArticleCreateStep(5, baseDraft({
      articleType: "paid",
      price: 980,
      body: "有料本文ですがマーカーがありません。",
    })) ?? "",
    /有料エリア開始位置/,
  );

  assert.match(
    draftHelpers.validateArticleCreateStep(5, baseDraft({
      body: `導入です。

<!-- IMAGE:01 -->

挿絵2がありません。`,
    })) ?? "",
    /挿絵2の差し込み位置/,
  );

  assert.equal(
    draftHelpers.validateArticleCreateStep(5, baseDraft({
      articleType: "paid",
      price: 980,
      body: `無料導入です。

<!-- IMAGE:01 -->

<!-- PAID_AREA -->

## 有料本文
本文です。

<!-- IMAGE:02 -->`,
    })),
    null,
  );
});

test("ready articles require body while draft and writing states can remain incomplete", () => {
  assert.doesNotThrow(() => create.validateCreationDraft(baseDraft({
    body: "",
    inlineEnabled: false,
    saveStatus: "draft",
  })));
  assert.doesNotThrow(() => create.validateCreationDraft(baseDraft({
    body: "",
    inlineEnabled: false,
    saveStatus: "writing",
  })));
  assert.throws(
    () => create.validateCreationDraft(baseDraft({
      body: "",
      inlineEnabled: false,
      saveStatus: "ready",
    })),
    /完成状態で保存するには本文を入力してください/,
  );
});

test("all publication targets keep title and article prompt generation available", () => {
  const targets = [
    ["note", "note"],
    ["tips", "Tips"],
    ["brain", "Brain"],
    ["blog", "ブログ"],
  ];
  for (const [publicationTarget, label] of targets) {
    const draft = baseDraft({ publicationTarget });
    assert.match(create.buildTitlePrompt(draft), new RegExp(`掲載先: ${label}`));
    assert.match(create.buildArticlePrompt(draft), new RegExp(`掲載先: ${label}`));
  }
});

test("paid article prompt, image prompts and publish copy stay connected", () => {
  const draft = baseDraft({
    articleType: "paid",
    price: 980,
    body: `無料導入です。

<!-- IMAGE:01 -->

<!-- PAID_AREA -->

## 有料本文
具体策です。

<!-- IMAGE:02 -->`,
  });

  const articlePrompt = create.buildArticlePrompt(draft);
  assert.match(articlePrompt, /<!-- PAID_AREA -->/);
  assert.match(articlePrompt, /<!-- IMAGE:01 -->/);

  const plan = images.buildImagePromptPlan({
    title: draft.title,
    theme: draft.title,
    publicationTarget: draft.publicationTarget,
    genre: draft.genre,
    subgenre: draft.subgenre,
    ageGroup: draft.ageGroup,
    gender: draft.gender,
    body: draft.body,
    coverEnabled: draft.coverEnabled,
    inlineEnabled: draft.inlineEnabled,
    inlineCount: draft.inlineCount,
    imageStyle: draft.imageStyle,
  });
  assert.equal(plan.length, 3);
  assert.deepEqual(plan.map((item) => item.insertionMarker), [null, "IMAGE:01", "IMAGE:02"]);
  assert.ok(plan.every((item) => /画像生成では一時チャットは使用不可/.test(item.prompt)));

  const combined = images.buildCombinedImagePrompt(plan);
  assert.match(combined, /必要画像数: 3枚/);
  assert.match(combined, /アイキャッチ 1枚/);
  assert.match(combined, /挿絵 2枚/);
  assert.match(combined, /画像生成では一時チャットは使用不可/);

  const publishBody = create.publicationBodyForCopy(draft.body, draft.title);
  assert.match(publishBody, /【挿絵1をここに挿入】/);
  assert.match(publishBody, /【挿絵2をここに挿入】/);
  assert.match(publishBody, /【ここから有料エリア】/);
});


test("marker integrity rejects duplicates, unexpected numbers, wrong order, and free paid-area markers", () => {
  assert.match(
    draftHelpers.validateArticleCreateStep(5, baseDraft({
      body: `導入

<!-- IMAGE:01 -->

本文

<!-- IMAGE:01 -->

<!-- IMAGE:02 -->`,
    })) ?? "",
    /挿絵1の差し込み位置が重複/,
  );

  assert.match(
    draftHelpers.validateArticleCreateStep(5, baseDraft({
      body: `導入

<!-- IMAGE:01 -->

<!-- IMAGE:02 -->

<!-- IMAGE:03 -->`,
    })) ?? "",
    /設定枚数に含まれない挿絵3/,
  );

  assert.match(
    draftHelpers.validateArticleCreateStep(5, baseDraft({
      body: `導入

<!-- IMAGE:02 -->

<!-- IMAGE:01 -->`,
    })) ?? "",
    /挿絵1→挿絵2/,
  );

  assert.match(
    draftHelpers.validateArticleCreateStep(5, baseDraft({
      articleType: "free",
      body: `導入

<!-- IMAGE:01 -->

<!-- PAID_AREA -->

<!-- IMAGE:02 -->`,
    })) ?? "",
    /無料記事には有料エリア開始位置を入れない/,
  );

  assert.match(
    draftHelpers.validateArticleCreateStep(5, baseDraft({
      articleType: "paid",
      price: 980,
      body: `導入

<!-- IMAGE:01 -->

<!-- PAID_AREA -->

本文

<!-- PAID_AREA -->

<!-- IMAGE:02 -->`,
    })) ?? "",
    /有料エリア開始位置は本文に1か所だけ/,
  );
});

test("final save validation rechecks marker integrity even if wizard navigation is bypassed", () => {
  assert.throws(
    () => create.validateCreationDraft(baseDraft({
      body: `導入

<!-- IMAGE:01 -->

<!-- IMAGE:01 -->

<!-- IMAGE:02 -->`,
    })),
    /挿絵1の差し込み位置が重複/,
  );

  assert.throws(
    () => create.validateCreationDraft(baseDraft({
      inlineEnabled: false,
      body: `導入

<!-- IMAGE:01 -->`,
    })),
    /挿絵をOFFにしているため/,
  );

  assert.throws(
    () => create.validateCreationDraft(baseDraft({
      articleType: "free",
      body: `導入

<!-- IMAGE:01 -->

<!-- PAID_AREA -->

<!-- IMAGE:02 -->`,
    })),
    /無料記事には有料エリア開始位置を入れない/,
  );
});


test("restored article work can be explicitly discarded without weakening normal autosave", async () => {
  const source = await readFile(
    new URL("../components/phase11-create-page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /const startFreshArticle = \(\)/);
  assert.match(source, /復元した作業内容を破棄して、新しい記事を最初から作成しますか/);
  assert.match(source, /clearArticleWizardProgress\(gate\.ownerId\)/);
  assert.match(source, /accountPresetAppliedRef\.current = false/);
  assert.match(source, /setStep\(0\)/);
  assert.match(source, /setDraft\(initialDraftFromLocation\(\)\)/);
  assert.match(source, /setMagazinePlan\(\{ \.\.\.DEFAULT_MAGAZINE_PLAN, articleTitles: \[\] \}\)/);
  assert.match(source, /setTagsText\(""\)/);
  assert.match(source, /setTitleCandidatesText\(""\)/);
  assert.match(source, /setArticlePromptAuthorized\(""\)/);
  assert.match(source, /setActivePresetId\(null\)/);
  assert.match(source, /setWizardRestored\(false\)/);
  assert.match(source, /wizardRestored === true && !createdId/);
  assert.match(source, /新しい記事を最初から作る/);
  assert.match(source, /pagehide/);
  assert.match(source, /beforeunload/);
  assert.match(source, /visibilitychange/);
});
