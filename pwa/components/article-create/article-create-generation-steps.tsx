import { useState } from "react";

import {
  parseTitleCandidates,
  stripLeadingArticleTitle,
  type ArticleCreationDraft,
} from "@/lib/phase11-create";
import {
  CopyAndOpenAiButton,
  CopyButton,
  currentAiLaunchOptions,
  readClipboardText,
  type ArticleDraftPatch,
  type MessageSetter,
} from "@/components/article-create/article-create-step-shared";

export function TitleStep({
  draft,
  patch,
  titlePrompt,
  titleCandidatesText,
  setTitleCandidatesText,
  onBeforeExternalLaunch,
  setMessage,
}: {
  draft: ArticleCreationDraft;
  patch: ArticleDraftPatch;
  titlePrompt: string;
  titleCandidatesText: string;
  setTitleCandidatesText: (value: string) => void;
  onBeforeExternalLaunch: () => void;
  setMessage: MessageSetter;
}) {
  const titleCandidates = parseTitleCandidates(titleCandidatesText);
  const aiLaunchOptions = currentAiLaunchOptions();

  const clearTitleContent = () => {
    if (!titleCandidatesText.trim() && !draft.title.trim()) return;
    if (!window.confirm("貼り付けたタイトル候補と選択中のタイトルをクリアしますか？")) return;
    setTitleCandidatesText("");
    patch("title", "");
    setMessage("タイトル候補と選択タイトルをクリアしました。");
  };

  return (
    <div className="wizard-pane">
      <p className="eyebrow">STEP 5</p><h2>タイトルを5候補から選んでください</h2>
      {draft.generationMode === "prompt_export" && <>
        <p className="panel-muted">下のプロンプトをChatGPT・Claude・Geminiへ渡すと、タイトル候補を5個作成します。AIの回答5候補をまとめてAASへ貼り付けると、候補ボタンから選択できます。</p>
        <label className="route-field"><span>AI用タイトルプロンプト</span><textarea className="prompt-area" readOnly value={titlePrompt} /></label>
        <div className="openai-prompt-actions">
          <CopyButton value={titlePrompt} label="タイトルプロンプトをコピー" setMessage={setMessage} />
          {aiLaunchOptions.map((app) => (
            <CopyAndOpenAiButton
              key={app.key}
              value={titlePrompt}
              appKey={app.key}
              appLabel={app.label}
              onBeforeExternalLaunch={onBeforeExternalLaunch}
              setMessage={setMessage}
            />
          ))}
        </div>
        <label className="route-field title-candidate-paste">
          <span>AIが生成した5候補をまとめて貼り付け</span>
          <textarea
            value={titleCandidatesText}
            onChange={(event) => setTitleCandidatesText(event.target.value.slice(0, 10000))}
            placeholder={"1. タイトル候補A\n2. タイトル候補B\n3. タイトル候補C\n4. タイトル候補D\n5. タイトル候補E"}
          />
        </label>
        <div className="clipboard-edit-actions">
          <button
            className="secondary-action clipboard-paste-action"
            type="button"
            onClick={() => void readClipboardText(setMessage).then((value) => {
              if (value !== null) setTitleCandidatesText(value.slice(0, 10000));
            })}
          >
            クリップボードから5候補を貼り付け
          </button>
          <button
            className="secondary-action clear-content-action"
            type="button"
            disabled={!titleCandidatesText.trim() && !draft.title.trim()}
            onClick={clearTitleContent}
          >
            タイトル候補をクリア
          </button>
        </div>
        {titleCandidates.length > 0 && (
          <div className="title-candidates" aria-label="貼り付けたタイトル候補">
            {titleCandidates.map((title, index) => (
              <button
                type="button"
                key={`${index}-${title}`}
                onClick={() => patch("title", title)}
                className={draft.title === title ? "active" : ""}
              >
                <span>{index + 1}</span>{title}
              </button>
            ))}
          </div>
        )}
        {titleCandidatesText.trim() && titleCandidates.length < 5 && (
          <p className="beginner-help">現在 {titleCandidates.length}候補を認識しています。番号付きで1行に1候補ずつ貼り付けると最大5候補まで選択できます。</p>
        )}
        <p className="beginner-help">外部AIを開く直前と候補貼り付け後の内容は途中保存されます。AASへ戻ってもこの工程から続けられます。</p>
      </>}
      <label className="route-field">
        <span>{draft.generationMode === "prompt_export" ? "AIで生成したタイトルをここへ貼り付け（候補選択で自動入力）" : "タイトル"}</span>
        <input value={draft.title} onChange={(event) => patch("title", event.target.value)} placeholder={draft.generationMode === "prompt_export" ? "候補を選ぶか、タイトルを直接入力" : "記事タイトルを入力"} />
      </label>
    </div>
  );
}

export function BodyStep({
  draft,
  patch,
  articleBusy,
  articlePromptReady,
  articlePrompt,
  onGenerate,
  onBeforeExternalLaunch,
  setMessage,
}: {
  draft: ArticleCreationDraft;
  patch: ArticleDraftPatch;
  articleBusy: boolean;
  articlePromptReady: boolean;
  articlePrompt: string;
  onGenerate: () => Promise<void>;
  onBeforeExternalLaunch: () => void;
  setMessage: MessageSetter;
}) {
  const [bodyCursor, setBodyCursor] = useState(() => draft.body.length);
  const aiLaunchOptions = currentAiLaunchOptions();
  const paidAreaPresent = /<!--\s*PAID_AREA\s*-->/i.test(draft.body);
  const missingImageMarkers = draft.inlineEnabled
    ? Array.from({ length: draft.inlineCount }, (_unused, index) => index + 1).filter((order) => {
        const marker = new RegExp(`<!--\\s*IMAGE:0?${order}\\s*-->`, "i");
        return !marker.test(draft.body);
      })
    : [];

  const applyPastedBody = (value: string) => {
    const cleaned = stripLeadingArticleTitle(value, draft.title);
    patch("body", cleaned);
    setBodyCursor(cleaned.length);
    setMessage(cleaned !== value.trimStart()
      ? "先頭に含まれていた記事タイトルを除外し、本文だけを貼り付けました。"
      : "本文を貼り付けました。");
  };

  const clearBody = () => {
    if (!draft.body.trim()) return;
    if (!window.confirm("貼り付けた本文をすべてクリアしますか？")) return;
    patch("body", "");
    setBodyCursor(0);
    setMessage("本文をクリアしました。");
  };

  const insertMarkerAtCursor = (marker: string, label: string) => {
    const safeCursor = Math.max(0, Math.min(bodyCursor, draft.body.length));
    const before = draft.body.slice(0, safeCursor).replace(/\s*$/, "");
    const after = draft.body.slice(safeCursor).replace(/^\s*/, "");
    const next = [before, marker, after].filter(Boolean).join("\n\n");
    patch("body", next);
    setBodyCursor(Math.min(next.length, before.length + marker.length + 2));
    setMessage(label + "を本文へ追加しました。");
  };

  return (
    <div className="wizard-pane">
      <p className="eyebrow">STEP 6</p><h2>本文を準備します</h2>
      {draft.generationMode === "prompt_export" && <>
        <p className="panel-muted">この画面を開くだけでは回数を消費しません。「完成記事プロンプトを作成」を押した時だけ記事生成1回として記録されます。</p>
        <button className="secondary-action" type="button" disabled={articleBusy} onClick={() => void onGenerate()}>{articleBusy ? "利用回数を確認中…" : articlePromptReady ? "完成記事プロンプトを作り直す" : "完成記事プロンプトを作成"}</button>
        {articlePromptReady && <>
          <label className="route-field"><span>AI用完成記事プロンプト</span><textarea className="prompt-area large" readOnly value={articlePrompt} /></label>
          <div className="openai-prompt-actions">
            <CopyButton value={articlePrompt} label="完成記事プロンプトをコピー" setMessage={setMessage} />
            {aiLaunchOptions.map((app) => (
              <CopyAndOpenAiButton
                key={app.key}
                value={articlePrompt}
                appKey={app.key}
                appLabel={app.label}
                onBeforeExternalLaunch={onBeforeExternalLaunch}
                setMessage={setMessage}
              />
            ))}
          </div>
          <p className="beginner-help">生成後のコピーやAIアプリ起動では追加消費しません。条件を変えて作り直した時だけ次の1回として記録されます。</p>
        </>}
      </>}
      <label className="route-field">
        <span>{draft.generationMode === "prompt_export" ? "生成した本文だけをここへ貼り付け" : "本文"}</span>
        <textarea
          className="body-area"
          value={draft.body}
          onPaste={(event) => {
            if (draft.body.trim()) return;
            const pasted = event.clipboardData.getData("text/plain");
            if (!pasted) return;
            event.preventDefault();
            applyPastedBody(pasted);
          }}
          onSelect={(event) => setBodyCursor(event.currentTarget.selectionStart)}
          onClick={(event) => setBodyCursor(event.currentTarget.selectionStart)}
          onKeyUp={(event) => setBodyCursor(event.currentTarget.selectionStart)}
          onChange={(event) => {
            patch("body", event.target.value);
            setBodyCursor(event.target.selectionStart);
          }}
          placeholder="## 見出し\n本文…"
        />
      </label>
      <div className="body-clipboard-actions">
        <button
          className="secondary-action"
          type="button"
          onClick={() => void readClipboardText(setMessage).then((value) => {
            if (value !== null) applyPastedBody(value);
          })}
        >
          クリップボードから本文を貼り付け
        </button>
        <button
          className="secondary-action clear-content-action"
          type="button"
          disabled={!draft.body.trim()}
          onClick={clearBody}
        >
          本文をクリア
        </button>
      </div>
      <p className="beginner-help">タイトルはSTEP 5で管理するため、この欄には本文だけを入れます。AIが先頭に同じタイトルを付けた場合はAASが除外します。</p>
      {draft.articleType === "paid" && (
        <div className={paidAreaPresent ? "marker-status marker-status-ok" : "marker-status marker-status-warning"}>
          <strong>{paidAreaPresent ? "✓ 有料エリア開始位置があります" : "有料エリア開始位置がまだありません"}</strong>
          <small>AI生成時は <code>&lt;!-- PAID_AREA --&gt;</code> を自動で含めるよう指示しています。手動で追加する場合は本文欄の希望位置へカーソルを置いてください。</small>
          {!paidAreaPresent && (
            <button className="secondary-action" type="button" onClick={() => insertMarkerAtCursor("<!-- PAID_AREA -->", "有料エリア開始位置")}>
              カーソル位置に有料エリアを追加
            </button>
          )}
        </div>
      )}
      {draft.inlineEnabled && (
        <div className={missingImageMarkers.length === 0 ? "marker-status marker-status-ok" : "marker-status marker-status-warning"}>
          <strong>{missingImageMarkers.length === 0 ? "✓ 挿絵の差し込み位置がそろっています" : `挿絵位置が${missingImageMarkers.length}か所不足しています`}</strong>
          <small>AI生成時は挿絵枚数ぶんの <code>&lt;!-- IMAGE:01 --&gt;</code> 形式を本文へ入れるよう指示しています。足りない場合はカーソル位置へ追加できます。</small>
          {missingImageMarkers.map((order) => (
            <button
              key={order}
              className="secondary-action"
              type="button"
              onClick={() => insertMarkerAtCursor(`<!-- IMAGE:${String(order).padStart(2, "0")} -->`, `挿絵${order}の差し込み位置`)}
            >
              カーソル位置に挿絵{order}を追加
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
