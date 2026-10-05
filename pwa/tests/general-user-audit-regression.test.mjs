import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("article library quota notice remains a standalone styled card", async () => {
  const css = await read("app/globals.css");
  assert.match(
    css,
    /\.library-stock-summary\.reached\s*\{\s*border-color:\s*#7f3f4b;\s*background:\s*#2a1720;\s*\}\s*\.library-duplicate-quota-note\s*\{/,
  );
  assert.doesNotMatch(
    css,
    /\.library-stock-summary\.reached\s*\{\s*\.library-duplicate-quota-note/,
  );
});

test("public sales legal and support pages keep a readable typography floor", async () => {
  const css = await read("app/phase27-commerce.css");
  assert.match(css, /2026-10-05 general-user readability audit/);
  assert.match(css, /\.commerce-hero > p:last-of-type,[\s\S]*?\.legal-commerce-notes p\s*\{\s*font-size:\s*14px;/);
  assert.match(css, /\.legal-commerce-table dt,[\s\S]*?\.legal-commerce-plans p\s*\{\s*font-size:\s*12px;/);
  assert.match(css, /\.commerce-invite-form input,[\s\S]*?\.billing-actions-card button\s*\{\s*font-size:\s*14px;/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*?\.commerce-public-shortcuts a\s*\{[\s\S]*?min-height:\s*40px;/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?\.commerce-grid\s*\{\s*grid-template-columns:\s*repeat\(2,/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*?\.commerce-grid,[\s\S]*?grid-template-columns:\s*1fr;/);
});

test("core article and image prompts preserve audited output contracts", async () => {
  const [article, images] = await Promise.all([
    read("lib/phase11-create.ts"),
    read("lib/phase13-image-prompts.ts"),
  ]);

  assert.match(article, /記事タイトル候補を5個作成してください/);
  assert.match(article, /必ず5個だけ、1〜5の番号付き/);
  assert.match(article, /選択済みタイトルは構成条件として参照するだけにし、出力本文の先頭や見出しに記事タイトルを再掲しない/);
  assert.match(article, /完成記事の本文だけを返す。タイトル・「タイトル：」表記・末尾の解説は出力しない/);
  assert.match(article, /<!-- PAID_AREA --> を必ず1回だけ単独行/);
  assert.match(article, /<!-- IMAGE:01 -->/);

  assert.match(images, /画像生成では一時チャットは使用不可です。通常チャットを使用してください/);
  assert.match(images, /各画像は必ず別々の画像として生成してください/);
  assert.match(images, /1枚のコラージュ、分割画面、複数画像を1枚へ合成したレイアウトにはしない/);
});

test("release control remains compatible with a private source repository", async () => {
  const worker = await read("../supabase/functions/pwa-release-deploy/index.ts");
  assert.match(worker, /const REPO = "haruharu42\/AIActionStudio-Updates"/);
  assert.match(worker, /AAS_GITHUB_RELEASE_TOKEN/);
  assert.match(worker, /authorization: `Bearer \$\{token\}`/);
  assert.match(worker, /pwa-admin-canary-release\.yml/);
  assert.match(worker, /pwa-admin-public-release\.yml/);
  assert.doesNotMatch(worker, /raw\.githubusercontent\.com/);
});


test("dependency audit keeps production high-severity blocking while allowing only the exact unpatched dev-tool chain", async () => {
  const [ci, preflight, gate] = await Promise.all([
    read("../.github/workflows/pwa-phase9-17-ci.yml"),
    read("../.github/workflows/pwa-production-preflight.yml"),
    read("scripts/check-known-dev-advisories.mjs"),
  ]);

  for (const workflow of [ci, preflight]) {
    assert.match(workflow, /npm audit --omit=dev --audit-level=high/);
    assert.match(workflow, /node scripts\/check-known-dev-advisories\.mjs/);
  }
  assert.match(gate, /GHSA-vfj7-8cjw-p6xm/);
  assert.match(gate, /ALLOWED_HIGH_DEV_PACKAGES/);
  assert.match(gate, /value\.dev !== true/);
  assert.match(gate, /Unexpected high\/critical dependency advisories/);
  assert.match(gate, /shell: process\.platform === "win32"/);
  assert.match(gate, /audit\.error/);

  const windowsPreflight = await read("../scripts/Prepare-AAS-PWA-Production.ps1");
  assert.match(windowsPreflight, /production dependency audit/);
  assert.match(windowsPreflight, /audit", "--omit=dev", "--audit-level=high/);
  assert.match(windowsPreflight, /node "scripts\/check-known-dev-advisories\.mjs"/);
  assert.match(windowsPreflight, /development dependency advisory gate/);
});
