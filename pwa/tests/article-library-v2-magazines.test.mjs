import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test, { after } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const vite = await createServer({ appType: 'custom', configFile: false, root, resolve: { alias: { '@': root } }, server: { middlewareMode: true, hmr: false } });
after(() => vite.close());

const library = await vite.ssrLoadModule('/lib/article-library-v2.ts');
const libraryView = await vite.ssrLoadModule('/lib/article-library-view.ts');
const exporter = await vite.ssrLoadModule('/lib/article-export.ts');
const notePostAssistant = await vite.ssrLoadModule('/lib/note-post-assistant.ts');

const migration = await fs.readFile(`${repoRoot}/supabase/migrations/20260917061400_article_library_v2.sql`, 'utf8');
const libraryController = await fs.readFile(`${root}/components/phase7-library.tsx`, 'utf8');
const libraryListUi = await fs.readFile(`${root}/components/article-library/article-library-list.tsx`, 'utf8');
const libraryDetailUi = await fs.readFile(`${root}/components/article-library/article-library-detail.tsx`, 'utf8');
const notePostAssistantUi = await fs.readFile(`${root}/components/article-library/note-post-assistant.tsx`, 'utf8');
const deviceLayoutCss = await fs.readFile(`${root}/app/phase35-device-layout.css`, 'utf8');
const localArticleImagesSource = await fs.readFile(`${root}/lib/local-article-images.ts`, 'utf8');
const imagePromptUi = await fs.readFile(`${root}/components/phase13-image-page.tsx`, 'utf8');
const libraryEditorUi = await fs.readFile(`${root}/components/article-library/article-library-editor.tsx`, 'utf8');
const libraryUi = [libraryController, libraryListUi, libraryDetailUi, libraryEditorUi].join('\n');
const exportUi = await fs.readFile(`${root}/components/article-export-page.tsx`, 'utf8');

test('library v2 RPC is metadata-only, paged, owner-bound and PWA-gated', () => {
  assert.match(migration, /list_article_library_v2/);
  assert.match(migration, /can_access_product\('AAS-PWA-BETA'\)/);
  assert.match(migration, /article\.user_id = current_user_id/);
  assert.match(migration, /p_limit < 1 or p_limit > 100/);
  assert.doesNotMatch(migration, /article\.body/);
  assert.doesNotMatch(migration, /source_body|publish_body/);
});

test('note magazine settings round-trip in PWA-only workspace metadata', () => {
  const next = library.withNoteMagazineWorkspace({ keep: true }, {
    enabled: true,
    name: 'AI副業初心者ロードマップ',
    type: 'paid',
    seriesName: '基礎編',
    order: 2,
    role: 'standard',
  });
  assert.equal(next.keep, true);
  const parsed = library.noteMagazineFromWorkspace(next);
  assert.deepEqual(parsed, {
    enabled: true,
    name: 'AI副業初心者ロードマップ',
    type: 'paid',
    seriesName: '基礎編',
    order: 2,
    role: 'standard',
  });
  assert.throws(() => library.withNoteMagazineWorkspace({}, { ...library.EMPTY_NOTE_MAGAZINE, enabled: true }));
});

test('article library exposes filters, sorting, paging, archive, duplicate and PC export links', () => {
  for (const expected of [
    'ARTICLE LIBRARY 2.0', 'noteマガジン', 'ジャンル', 'サブジャンル', '状態順',
    'さらに${ARTICLE_LIBRARY_PAGE_SIZE}件読み込む', '複製', 'アーカイブから戻す', 'PC一括保存へ',
  ]) assert.ok(libraryUi.includes(expected), expected);
  assert.match(libraryController, /listArticleLibraryPage/);
  assert.match(libraryController, /duplicateCloudArticle/);
  assert.match(libraryController, /withNoteMagazineWorkspace/);
  assert.doesNotMatch(libraryListUi, /Windows版またはPWA/);
  assert.match(libraryListUi, /PWAで作成した記事や、これまでに同期済みの記事/);
});

test('article library filters start collapsed and can be opened without clearing the selected conditions', () => {
  assert.match(libraryListUi, /useState\(false\)/);
  assert.match(libraryListUi, /検索・絞り込み/);
  assert.match(libraryListUi, /aria-expanded=\{filtersOpen\}/);
  assert.match(libraryListUi, /setFiltersOpen\(\(current\) => !current\)/);
  assert.match(libraryListUi, /絞り込み条件を指定中/);
  assert.match(libraryListUi, /条件なし・すべての記事/);
  assert.match(libraryListUi, /filtersOpen && \(/);
  assert.match(libraryListUi, /value=\{filters\.query\}/);
  assert.match(libraryListUi, /value=\{filters\.status\}/);
});

test('article library detail delegates note copying to the posting assistant', () => {
  assert.doesNotMatch(libraryDetailUi, /掲載用コピー/);
  assert.doesNotMatch(libraryDetailUi, /完成本文を装飾付きコピー/);
  assert.match(libraryDetailUi, /NotePostAssistant/);
  assert.match(libraryDetailUi, /articleExportBody\(detail\)/);
});

test('note article detail exposes local image posting assistant without Supabase Storage', () => {
  assert.match(libraryDetailUi, /NotePostAssistant/);
  assert.match(libraryDetailUi, /detail\.publicationTarget === "note"/);
  assert.match(notePostAssistantUi, /画像込みでnoteへ貼り付ける/);
  assert.match(notePostAssistantUi, /画像入り完成プレビュー/);
  assert.match(notePostAssistantUi, /noteへ貼り付ける順番/);
  assert.match(notePostAssistantUi, /copyNoteRichText/);
  assert.match(notePostAssistantUi, /copyImageBlobToClipboard/);
  assert.match(notePostAssistantUi, /https:\/\/note\.com\/new/);
  assert.match(notePostAssistantUi, /Supabase Storageへは送信しません/);
  assert.match(notePostAssistantUi, /有料エリア/);
  assert.match(notePostAssistantUi, /有料本文/);
  assert.match(notePostAssistantUi, /位置をコピー/);
  assert.match(notePostAssistantUi, /有料エリアの目印/);
  assert.match(notePostAssistantUi, /装飾付きコピー/);
  assert.match(notePostAssistantUi, /本文＋挿絵を一括コピー/);
  assert.match(notePostAssistantUi, /note-post-batch-copy-desktop/);
  assert.match(deviceLayoutCss, /@media \(max-width: 700px\)/);
  assert.match(deviceLayoutCss, /\.note-post-batch-copy-desktop\s*\{[\s\S]*?display:\s*none\s*!important/);
  assert.match(notePostAssistantUi, /copyNotePostSequenceWithImages/);
  const imageSlotsIndex = notePostAssistantUi.indexOf('className="note-post-image-slots"');
  const postingStepsIndex = notePostAssistantUi.indexOf('aria-label="noteへ貼り付ける順番"');
  const completedPreviewIndex = notePostAssistantUi.indexOf('aria-label="画像入り完成プレビュー"');
  assert.ok(
    imageSlotsIndex < postingStepsIndex && postingStepsIndex < completedPreviewIndex,
    'image selection should render before copy steps, and copy steps before the completed preview',
  );
  assert.match(localArticleImagesSource, /indexedDB\.open/);
  assert.match(localArticleImagesSource, /createObjectStore/);
  assert.match(localArticleImagesSource, /saveLocalArticleImage/);
  assert.match(localArticleImagesSource, /listLocalArticleImages/);
  assert.doesNotMatch(localArticleImagesSource, /supabase|\.from\(|storage\./i);
  assert.match(imagePromptUi, /saveLocalArticleImage/);
  assert.match(imagePromptUi, /listLocalArticleImages/);
  assert.match(imagePromptUi, /記事ライブラリのnote投稿アシスト/);
});

test('note paid posting sequence separates free and paid content around the paid boundary', () => {
  const sequence = notePostAssistant.buildNotePostSequence(
    [
      '無料導入',
      '<!-- IMAGE:01 -->',
      '無料本文の続き',
      '<!-- PAID_AREA -->',
      '有料本文の開始',
      '<!-- IMAGE:02 -->',
      '有料本文の続き',
    ].join('\n'),
    'テストタイトル',
    { articleType: 'paid', inlineEnabled: true, inlineCount: 2 },
  );

  assert.deepEqual(sequence.map((item) => item.kind), [
    'body',
    'inline-image',
    'body',
    'paid-boundary',
    'body',
    'inline-image',
    'body',
  ]);
  assert.equal(sequence[0].paid, false);
  assert.equal(sequence[1].paid, false);
  assert.equal(sequence[2].paid, false);
  assert.equal(sequence[4].paid, true);
  assert.equal(sequence[5].paid, true);
  assert.equal(sequence[6].paid, true);

  const freeSequence = notePostAssistant.buildNotePostSequence(
    ['無料導入', '<!-- PAID_AREA -->', '無料本文'].join('\n'),
    'テストタイトル',
    { articleType: 'free', inlineEnabled: false, inlineCount: 0 },
  );
  assert.doesNotMatch(freeSequence.map((item) => item.kind).join(','), /paid-boundary/);
  assert.ok(freeSequence.every((item) => item.kind !== 'body' || item.paid === false));
});

test('note rich batch clipboard payload keeps formatting, paid boundary and inline image order', () => {
  const sequence = [
    { kind: 'body', id: 'body-1', markdown: '## 見出し\n**重要**です', paid: false },
    { kind: 'inline-image', id: 'inline-1', order: 1, paid: false },
    { kind: 'paid-boundary', id: 'paid-boundary' },
    { kind: 'body', id: 'body-2', markdown: '### 有料部分\n- 手順A', paid: true },
  ];
  const payload = notePostAssistant.buildNotePostClipboardPayload(
    sequence,
    new Map([[1, 'data:image/png;base64,AAAA']]),
  );

  assert.match(payload.html, /<h2>見出し<\/h2>/);
  assert.match(payload.html, /<strong>重要<\/strong>/);
  assert.match(payload.html, /<img src="data:image\/png;base64,AAAA" alt="挿絵1"/);
  assert.match(payload.html, /【ここから有料エリア】/);
  assert.match(payload.html, /<h3>有料部分<\/h3>/);
  assert.match(payload.plain, /挿絵1/);
  assert.match(payload.plain, /ここから有料エリア/);
});

test('article library edit validation matches the positive-price database contract', () => {
  const detail = {
    id: '10000000-0000-4000-8000-000000000001', userId: '00000000-0000-4000-8000-000000000002',
    title: '価格テスト', publicationTarget: 'note', articleType: 'paid', genre: null, subgenre: null, status: 'ready', price: 100,
    tags: [], revision: 1, createdAt: '2026-09-17T00:00:00Z', updatedAt: '2026-09-17T00:00:00Z', body: '本文',
    scheduledAt: null, publishedAt: null, publishedUrl: null,
    workspace: { articleId: '10000000-0000-4000-8000-000000000001', userId: '00000000-0000-4000-8000-000000000002', requestJson: {}, workspaceJson: {}, imagePlanJson: {}, sourceBody: null, publishBody: null, workspaceVersion: 1, createdAt: null, updatedAt: null },
  };
  const values = libraryView.articleLibraryEditValuesFromDetail(detail);

  const zero = libraryView.buildArticleLibrarySavePayload({ ...values, price: '0' });
  assert.equal(zero.ok, false);
  assert.match(zero.message, /1以上の整数/);

  const one = libraryView.buildArticleLibrarySavePayload({ ...values, price: '1' });
  assert.equal(one.ok, true);
  assert.equal(one.value.article.price, 1);

  const invalidTarget = libraryView.buildArticleLibrarySavePayload({ ...values, publicationTarget: '' });
  assert.equal(invalidTarget.ok, false);
  assert.match(invalidTarget.message, /掲載先/);
});

test('article library cannot mark an article published without publication metadata', () => {
  assert.match(libraryEditorUi, /parsed\.value\.article\.status === "published"/);
  assert.match(libraryEditorUi, /!detail\.publishedAt \|\| !detail\.publishedUrl/);
  assert.match(libraryEditorUi, /公開済みへの変更は「公開管理」で公開日時と公開URLを登録して行ってください。/);
});

test('desktop export creates markdown text html json and a valid store-only zip envelope', async () => {
  const detail = {
    id: '10000000-0000-4000-8000-000000000001', userId: '00000000-0000-4000-8000-000000000002',
    title: 'テスト/記事', publicationTarget: 'note', articleType: 'free', genre: 'AI副業', subgenre: '初心者', status: 'ready', price: null,
    tags: ['test'], revision: 1, createdAt: '2026-09-17T00:00:00Z', updatedAt: '2026-09-17T00:00:00Z', body: '# 本文',
    scheduledAt: null, publishedAt: null, publishedUrl: null,
    workspace: { articleId: '10000000-0000-4000-8000-000000000001', userId: '00000000-0000-4000-8000-000000000002', requestJson: {}, workspaceJson: {}, imagePlanJson: {}, sourceBody: null, publishBody: '# 掲載本文', workspaceVersion: 1, createdAt: null, updatedAt: null },
  };
  const files = exporter.buildArticleExportFiles(detail);
  assert.deepEqual(files.map(file => file.name.split('.').at(-1)), ['md', 'txt', 'html', 'json']);
  assert.ok(files.every(file => !file.name.includes('/')));
  const zip = exporter.createStoredZip(files);
  const bytes = new Uint8Array(await zip.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  assert.equal(zip.type, 'application/zip');
  assert.match(exporter.articleExportJson(detail), /"exportVersion": 1/);
});

test('export UI keeps bulk ZIP generation client-side and PC-oriented', () => {
  assert.match(exportUi, /createStoredZip/);
  assert.match(exportUi, /記事一式ZIP/);
  assert.match(exportUi, /条件一致の記事をZIP保存/);
  assert.match(exportUi, /ブラウザ内/);
  assert.match(exportUi, /PC版Chrome \/ Edge/);
});
