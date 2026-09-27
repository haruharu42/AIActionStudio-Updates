import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("ChatGPT launch always explains regular and temporary chat personalization", async () => {
  const [links, css, articleSteps, promotionFields] = await Promise.all([
    read("lib/ai-app-links.ts"),
    read("app/phase20-device-e2e.css"),
    read("components/article-create/article-create-steps.tsx"),
    read("components/admin-promotion/admin-promotion-fields.tsx"),
  ]);

  assert.match(links, /showChatGptUsageGuide/);
  assert.match(links, /key === "chatgpt"/);
  assert.match(links, /通常チャット・一時チャットのどちらでも使えます/);
  assert.match(links, /パーソナライズあり/);
  assert.match(links, /既存のメモリ・カスタム指示等を利用できます/);
  assert.match(links, /一時チャット中はメモリを新規作成・更新しません/);
  assert.match(links, /開始後はパーソナライズ設定を変更できません/);
  assert.match(links, /AASから一時チャットを自動選択することはできない/);
  assert.match(links, /openAiProvider\(app\)/);
  assert.doesNotMatch(links, /window\.location\.assign\([^\n]*chatgpt/);

  assert.match(articleSteps, /launchAiApp\(app\.key\)/);
  assert.match(promotionFields, /launchAiApp\(key\)/);

  assert.match(css, /\.chatgpt-usage-backdrop/);
  assert.match(css, /\.chatgpt-usage-dialog/);
  assert.match(css, /\.chatgpt-usage-choices/);
  assert.match(css, /@media \(max-width: 600px\)[\s\S]*?\.chatgpt-usage-choices/);
});
