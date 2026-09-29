import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("side-hustle roadmap catalog covers every AAS side-hustle plus note and adult affiliate", async () => {
  const [roadmaps, sideCatalog, content, sales, client, productivity] = await Promise.all([
    read("features/side-hustle-roadmaps/catalog.ts"),
    read("features/side-hustles/catalog.ts"),
    read("features/side-hustles/definitions-content-media.ts"),
    read("features/side-hustles/definitions-sales.ts"),
    read("features/side-hustles/definitions-client-work.ts"),
    read("features/side-hustles/definitions-productivity.ts"),
  ]);
  const definitions = [content, sales, client, productivity].join("\n");
  const liveSlugs = [...definitions.matchAll(/\bslug:\s*"([^"]+)"/g)].map((match) => match[1]);

  assert.equal(liveSlugs.length, 12);
  for (const slug of liveSlugs) {
    assert.ok(
      roadmaps.includes('"slug": "' + slug + '"') || roadmaps.includes('slug: "' + slug + '"'),
      "missing roadmap for " + slug,
    );
  }
  assert.match(roadmaps, /"slug": "note-operations"/);
  assert.match(roadmaps, /"slug": "adult-affiliate"/);
  assert.equal((roadmaps.match(/"phases": \[/g) ?? []).length, 14);
  assert.equal((roadmaps.match(/"outcome":/g) ?? []).length, 70);
  assert.equal((roadmaps.match(/"tasks": \[/g) ?? []).length, 70);
  assert.match(sideCatalog, /SIDE_HUSTLE_DEFINITIONS/);
});

test("roadmaps include research-backed official references and compliance checkpoints", async () => {
  const roadmaps = await read("features/side-hustle-roadmaps/catalog.ts");

  for (const marker of [
    "developers.google.com/search/docs/fundamentals/creating-helpful-content",
    "support.google.com/youtube/answer/9314415",
    "ads.tiktok.com/business/en-US/creative-codes",
    "about.fb.com/news/2024/10/best-practices-education-hub-creators-instagram",
    "caa.go.jp/policies/policy/representation/fair_labeling/faq/stealth_marketing",
    "crowdworks.jp/pages/guides/employer/index",
    "jftc.go.jp/freelancelaw_2025",
    "coconala.com/pages/guide_sell",
    "help.jp.mercari.com/guide/articles/62",
    "nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1500",
    "help.x.com/ja/rules-and-policies/adult-content",
  ]) {
    assert.ok(roadmaps.includes(marker), "missing official reference " + marker);
  }

  assert.match(roadmaps, /成果保証|収益保証|保証しない/);
  assert.match(roadmaps, /取引条件/);
  assert.match(roadmaps, /広告\/PR/);
  assert.match(roadmaps, /18歳以上/);
  assert.match(roadmaps, /規約回避/);
});

test("roadmap UI persists progress, supports filtering, copying, and direct AAS handoff", async () => {
  const [page, route, layout, styles, toolCatalog, home] = await Promise.all([
    read("components/side-hustle-roadmaps-page.tsx"),
    read("app/side-hustle-roadmaps/page.tsx"),
    read("app/layout.tsx"),
    read("app/phase56-side-hustle-roadmaps.css"),
    read("features/tools/tool-catalog.ts"),
    read("components/action-studio-home-hub.tsx"),
  ]);

  assert.match(route, /Phase15MemberGate/);
  assert.match(route, /SideHustleRoadmapsPage/);
  assert.match(page, /aas-side-hustle-roadmaps-v1/);
  assert.match(page, /localStorage/);
  assert.match(page, /navigator\.clipboard\.writeText/);
  assert.match(page, /SIDE_HUSTLE_ROADMAP_CATEGORIES/);
  assert.match(page, /カテゴリ/);
  assert.match(page, /検索/);
  assert.match(page, /この副業の専用機能を開く/);
  assert.match(page, /公式ページを確認/);
  assert.match(page, /全副業共通の運用チェック/);
  assert.match(styles, /side-hustle-roadmap-card-grid/);
  assert.match(styles, /@media \(max-width: 460px\)/);
  assert.match(layout, /phase56-side-hustle-roadmaps\.css/);
  assert.match(toolCatalog, /\/side-hustle-roadmaps/);
  assert.match(home, /\/side-hustle-roadmaps/);
});


test("roadmap surfaces the next three incomplete actions and lets users complete or copy them", async () => {
  const [page, styles] = await Promise.all([
    read("components/side-hustle-roadmaps-page.tsx"),
    read("app/phase56-side-hustle-roadmaps.css"),
  ]);

  assert.match(page, /const nextTasks = selected\.phases/);
  assert.match(page, /\.filter\(\(item\) => !completed\.has\(item\.key\)\)/);
  assert.match(page, /\.slice\(0, 3\)/);
  assert.match(page, /次にやる3つ/);
  assert.match(page, /copyNextActions/);
  assert.match(page, /次にやる3つをコピー/);
  assert.match(page, /toggleTask\(item\.key\)/);
  assert.match(page, /このロードマップは完了です/);
  assert.match(styles, /\.side-hustle-roadmap-focus/);
  assert.match(styles, /\.side-hustle-roadmap-focus-list/);
  assert.match(styles, /@media \(max-width: 760px\)/);
});


test("roadmap filters keep the visible cards and selected detail in sync and provide an empty-state recovery", async () => {
  const page = await read("components/side-hustle-roadmaps-page.tsx");

  assert.match(page, /function filterSideHustleRoadmaps\(category: string, query: string\)/);
  assert.match(page, /const keepSelectionInFilter = \(nextRoadmaps:/);
  assert.match(page, /nextRoadmaps\.some\(\(roadmap\) => roadmap\.slug === selectedSlug\)/);
  assert.match(page, /setSelectedSlug\(nextRoadmaps\[0\]\.slug\)/);
  assert.match(page, /const changeCategory = \(nextCategory: string\)/);
  assert.match(page, /filterSideHustleRoadmaps\(nextCategory, query\)/);
  assert.match(page, /const changeQuery = \(nextQuery: string\)/);
  assert.match(page, /filterSideHustleRoadmaps\(category, nextQuery\)/);
  assert.match(page, /条件に一致する副業ロードマップがありません/);
  assert.match(page, /条件をクリア/);
  assert.match(page, /const clearFilters = \(\)/);
});

test("roadmap empty filter state uses the full card grid width on desktop and stacks on mobile", async () => {
  const styles = await read("app/phase56-side-hustle-roadmaps.css");
  assert.match(styles, /\.side-hustle-roadmap-empty \{[\s\S]*?grid-column:\s*1 \/ -1/);
  assert.match(styles, /\.side-hustle-roadmap-empty \.secondary-action/);
  assert.match(styles, /@media \(max-width: 460px\)[\s\S]*?\.side-hustle-roadmap-empty \{[\s\S]*?flex-direction:\s*column/);
});


test("roadmap page can deep-link to the matching side-hustle roadmap without losing stored progress", async () => {
  const page = await read("components/side-hustle-roadmaps-page.tsx");

  assert.match(page, /new URLSearchParams\(window\.location\.search\)\.get\("roadmap"\)/);
  assert.match(page, /if \(requestedSlug && getSideHustleRoadmap\(requestedSlug\)\)/);
  assert.match(page, /selectedFromUrl = requestedSlug/);
  assert.match(page, /if \(!selectedFromUrl && parsed\.selectedSlug/);
  assert.match(page, /専用副業機能から対応するロードマップを開きました/);
});
