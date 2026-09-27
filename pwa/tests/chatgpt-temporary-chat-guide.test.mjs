import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("AI launch explains provider-specific regular and temporary/private chat behavior", async () => {
  const [links, css, articleSteps, promotionFields] = await Promise.all([
    read("lib/ai-app-links.ts"),
    read("app/phase20-device-e2e.css"),
    read("components/article-create/article-create-steps.tsx"),
    read("components/admin-promotion/admin-promotion-fields.tsx"),
  ]);

  assert.match(links, /AI_USAGE_GUIDES: Record<AiAppKey, AiUsageGuide>/);
  assert.match(links, /showAiUsageGuide/);
  assert.match(links, /showAiUsageGuide\(AI_APP_LINKS\[key\]\)/);

  assert.match(links, /ChatGPTは通常チャット・一時チャットのどちらでも使えます/);
  assert.match(links, /パーソナライズあり/);
  assert.match(links, /既存のメモリ・カスタム指示等を利用できます/);
  assert.match(links, /一時チャット中はメモリを新規作成・更新しません/);
  assert.match(links, /開始後はパーソナライズ設定を変更できません/);

  assert.match(links, /Claudeは通常チャット・シークレットチャットを使い分けできます/);
  assert.match(links, /既存のClaudeメモリはシークレットチャットでは使用されません/);
  assert.match(links, /カスタムスタイルや個人設定などのプロフィール情報は利用できます/);
  assert.match(links, /シークレットチャットは通常チャットへ変換・保存できない/);
  assert.match(links, /ゴーストアイコンでシークレットモードを有効化/);

  assert.match(links, /Geminiは通常チャット・一時チャットを使い分けできます/);
  assert.match(links, /一時チャットではパーソナライズされた回答は利用できません/);
  assert.match(links, /将来のパーソナライズ用情報として保存されません/);
  assert.match(links, /Gemsや、一時チャットでは利用できない接続サービス等がある/);

  assert.match(links, /AASから一時チャットを自動選択することはできない/);
  assert.match(links, /AASからシークレットチャットを自動選択することはできない/);
  assert.match(links, /AASの「設定 → AI・文章の好み」/);
  assert.match(links, /メモリやカスタム指示へ自動登録する機能ではありません/);
  assert.match(links, /メモリ・プロフィール・カスタムスタイルへ自動登録する機能ではありません/);
  assert.match(links, /Personal Intelligenceや保存済み指示へ自動登録する機能ではありません/);
  assert.match(links, /ai-usage-handoff/);
  assert.match(links, /href = "\/settings"/);
  assert.match(links, /openAiProvider\(app\)/);
  assert.doesNotMatch(links, /showChatGptUsageGuide/);

  assert.match(articleSteps, /launchAiApp\(app\.key\)/);
  assert.match(promotionFields, /launchAiApp\(key\)/);

  assert.match(css, /\.ai-usage-backdrop/);
  assert.match(css, /\.ai-usage-dialog/);
  assert.match(css, /\.ai-usage-choices/);
  assert.match(css, /\.ai-usage-handoff/);
  assert.match(css, /@media \(max-width: 600px\)[\s\S]*?\.ai-usage-choices/);
  assert.match(css, /@media \(max-width: 600px\)[\s\S]*?\.ai-usage-choice > p,[\s\S]*?font-size: 12px/);
  assert.doesNotMatch(css, /\.chatgpt-usage-/);
});
