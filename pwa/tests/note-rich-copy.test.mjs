import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test, { after } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const vite = await createServer({ appType: 'custom', configFile: false, root, resolve: { alias: { '@': root } }, server: { middlewareMode: true, hmr: false } });
after(() => vite.close());

const rich = await vite.ssrLoadModule('/lib/note-rich-text.ts');
const creator = await vite.ssrLoadModule('/lib/phase11-create.ts');
const postAssistant = await vite.ssrLoadModule('/lib/note-post-assistant.ts');
const exporter = await vite.ssrLoadModule('/lib/article-export.ts');
const exportUi = await fs.readFile(`${root}/components/article-export-page.tsx`, 'utf8');
const richSource = await fs.readFile(`${root}/lib/note-rich-text.ts`, 'utf8');

const markdown = `# 大見出し

## 小見出し

**重要**な本文と[公式](https://example.com)。

- 項目A
- 項目B

1. 手順1
2. 手順2

> 補足です

---

\`code\`

\`\`\`
const safe = true;
\`\`\``;

test('note rich renderer preserves supported structural decoration and escapes raw html', () => {
  const html = rich.markdownToNoteHtml(`${markdown}\n\n<script>alert(1)</script>`);
  assert.match(html, /<h2>大見出し<\/h2>/);
  assert.match(html, /<h2>小見出し<\/h2>/);
  assert.match(html, /<strong>重要<\/strong>/);
  assert.match(html, /<a href="https:\/\/example\.com">公式<\/a>/);
  assert.match(html, /<ul><li>項目A<\/li><li>項目B<\/li><\/ul>/);
  assert.match(html, /<ol><li>手順1<\/li><li>手順2<\/li><\/ol>/);
  assert.match(html, /<blockquote>補足です<\/blockquote>/);
  assert.match(html, /<hr>/);
  assert.match(html, /<pre><code>const safe = true;<\/code><\/pre>/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test('plain text conversion removes markdown decoration while keeping readable content', () => {
  const text = rich.markdownToPlainText(markdown);
  assert.match(text, /大見出し/);
  assert.match(text, /重要な本文/);
  assert.match(text, /公式 \(https:\/\/example\.com\)/);
  assert.match(text, /• 項目A/);
  assert.doesNotMatch(text, /\*\*重要\*\*/);
  assert.doesNotMatch(text, /^##/m);
});

test('note post assistant splits article body around inline image markers in posting order', () => {
  const body = `導入です。

<!-- IMAGE:01 -->

## 続き
本文です。

<!-- IMAGE:02 -->

まとめです。`;
  const sequence = postAssistant.buildNotePostSequence(body, '別タイトル');
  assert.deepEqual(sequence.map((item) => item.kind === 'inline-image' ? `image-${item.order}` : item.id), [
    'body-1',
    'image-1',
    'body-2',
    'image-2',
    'body-3',
  ]);
  assert.deepEqual(postAssistant.inlineImageOrders(sequence), [1, 2]);
  assert.match(sequence[1].id, /inline-1/);
  assert.doesNotMatch(sequence.filter((item) => item.kind === 'body').map((item) => item.markdown).join('\n'), /挿絵1をここに挿入/);
});

test('clipboard implementation writes html and plain text with a browser fallback', () => {
  assert.match(richSource, /"text\/html"/);
  assert.match(richSource, /"text\/plain"/);
  assert.match(richSource, /navigator\.clipboard\.write/);
  assert.match(richSource, /catch \{/);
  assert.match(richSource, /fallbackRichCopy\(html\)/);
  assert.match(richSource, /document\.execCommand\("copy"\)/);
});

test('article export UI separates note rich copy, markdown and plain copy', () => {
  assert.match(exportUi, /note用・装飾付きコピー/);
  assert.match(exportUi, /Markdownをコピー/);
  assert.match(exportUi, /プレーンをコピー/);
  assert.match(exportUi, /装飾HTML保存/);
  assert.match(exportUi, /detail\.publicationTarget === "note"/);
});

test('html export renders structured article html and txt export is plain', () => {
  const detail = {
    id: '10000000-0000-4000-8000-000000000001', userId: '00000000-0000-4000-8000-000000000002',
    title: '装飾テスト', publicationTarget: 'note', articleType: 'free', genre: 'AI副業', subgenre: '初心者', status: 'ready', price: null,
    tags: [], revision: 1, createdAt: '2026-09-17T00:00:00Z', updatedAt: '2026-09-17T00:00:00Z', body: markdown,
    scheduledAt: null, publishedAt: null, publishedUrl: null,
    workspace: { articleId: '10000000-0000-4000-8000-000000000001', userId: '00000000-0000-4000-8000-000000000002', requestJson: {}, workspaceJson: {}, imagePlanJson: {}, sourceBody: null, publishBody: markdown, workspaceVersion: 1, createdAt: null, updatedAt: null },
  };
  const html = exporter.articleExportHtml(detail);
  const text = exporter.articleExportText(detail);
  assert.match(html, /<h2>大見出し<\/h2>/);
  assert.match(html, /<strong>重要<\/strong>/);
  assert.doesNotMatch(html, /<pre style="white-space:pre-wrap;font:inherit">/);
  assert.doesNotMatch(text, /\*\*重要\*\*/);
});


test('rich copy creates visible working space around image and paid-area markers', () => {
  const html = rich.markdownToNoteHtml(`本文A

**【挿絵1をここに挿入】**

本文B

---

**【ここから有料エリア】**

---

本文C`);

  assert.match(html, /<p><br><\/p><p><strong>【挿絵1をここに挿入】<\/strong><\/p><p><br><\/p>/);
  assert.match(html, /<p><br><\/p><p><strong>【ここから有料エリア】<\/strong><\/p><p><br><\/p>/);
  assert.match(html, /<hr>/);
});


test('publication marker normalization removes stale paid and image markers without mutating the editing source', () => {
  const source = `導入

<!-- IMAGE:01 -->

本文1

<!-- IMAGE:02 -->

本文2

<!-- IMAGE:03 -->

<!-- PAID_AREA -->

有料本文`;

  const freeNoImages = creator.normalizePublicationMarkers(source, {
    articleType: 'free',
    inlineEnabled: false,
    inlineCount: 0,
  });
  assert.doesNotMatch(freeNoImages, /PAID_AREA/);
  assert.doesNotMatch(freeNoImages, /IMAGE:/);
  assert.match(freeNoImages, /導入/);
  assert.match(freeNoImages, /有料本文/);

  const paidOneImage = creator.normalizePublicationMarkers(source, {
    articleType: 'paid',
    inlineEnabled: true,
    inlineCount: 1,
  });
  assert.match(paidOneImage, /<!-- PAID_AREA -->/);
  assert.match(paidOneImage, /<!-- IMAGE:01 -->/);
  assert.doesNotMatch(paidOneImage, /IMAGE:02/);
  assert.doesNotMatch(paidOneImage, /IMAGE:03/);

  const copiedFree = creator.publicationBodyForCopy(source, '', {
    articleType: 'free',
    inlineEnabled: false,
    inlineCount: 0,
  });
  assert.doesNotMatch(copiedFree, /ここから有料エリア/);
  assert.doesNotMatch(copiedFree, /挿絵1をここに挿入/);

  assert.match(source, /<!-- PAID_AREA -->/);
  assert.match(source, /<!-- IMAGE:03 -->/);
});


test('note post assistant follows saved image plan metadata and suggested filenames', () => {
  const metadata = postAssistant.readNotePostImagePlanMetadata({
    inline: { enabled: true, count: 1 },
    prompt_plan: [
      { kind: 'cover', order: 0, suggestedFilename: 'article_cover.png' },
      { kind: 'inline', order: 1, suggestedFilename: 'article_inline01.png' },
      { kind: 'inline', order: 2, suggestedFilename: 'article_inline02.png' },
    ],
  });

  assert.equal(metadata.inlineEnabled, true);
  assert.equal(metadata.inlineCount, 1);
  assert.equal(metadata.suggestedFilenames['cover-0'], 'article_cover.png');
  assert.equal(metadata.suggestedFilenames['inline-1'], 'article_inline01.png');

  const body = `導入

<!-- IMAGE:01 -->

本文1

<!-- IMAGE:02 -->

本文2

<!-- PAID_AREA -->

後半`;
  const sequence = postAssistant.buildNotePostSequence(body, '', {
    articleType: 'free',
    inlineEnabled: metadata.inlineEnabled,
    inlineCount: metadata.inlineCount,
  });

  assert.deepEqual(postAssistant.inlineImageOrders(sequence), [1]);
  const bodyText = sequence
    .filter((item) => item.kind === 'body')
    .map((item) => item.markdown)
    .join('\n');
  assert.doesNotMatch(bodyText, /ここから有料エリア/);
  assert.doesNotMatch(bodyText, /挿絵2をここに挿入/);
});
