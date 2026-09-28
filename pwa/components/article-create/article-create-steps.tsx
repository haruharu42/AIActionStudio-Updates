import { useState } from "react";
import { launchAiApp } from "@/lib/ai-app-links";
import { MagazinePlannerPanel } from "@/components/article-create/magazine-planner";
import { PresetNumberSelectWithCustom, SelectWithCustom } from "@/components/select-with-custom";
import type { MagazinePlanDraft } from "@/lib/magazine-planner";
import {
  parseTitleCandidates,
  publicationBodyForCopy,
  publicationEditorLink,
  stripLeadingArticleTitle,
  type ArticleCreationDraft,
  type ArticleType,
  type PublicationTarget,
  type SaveStatus,
} from "@/lib/phase11-create";
import { copyNoteRichText } from "@/lib/note-rich-text";
import {
  AI_PLAN_LABELS,
  AI_PROVIDER_LABELS,
  getRuntimeWritingProfile,
  summarizeWritingProfile,
  type AiPlan,
  type AiProvider,
  type UserWritingProfile,
} from "@/lib/user-personalization";
import type { ImagePromptItem } from "@/lib/phase13-image-prompts";
import {
  AGE_GROUP_OPTIONS,
  GENDER_OPTIONS,
  GENRE_OPTIONS,
  IMAGE_STYLE_OPTIONS,
  PAID_ARTICLE_PRICE_OPTIONS,
  TARGET_LENGTH_OPTIONS,
  genreSelectionValue,
  paidArticlePriceSelectionValue,
  subgenreOptionsFor,
  subgenreSelectionValue,
} from "@/lib/phase18-content-options";

export type ArticleDraftPatch = <K extends keyof ArticleCreationDraft>(
  key: K,
  value: ArticleCreationDraft[K],
) => void;

type MessageSetter = (value: string) => void;

export function AiSelectionStep({
  profile,
  onChange,
}: {
  profile: UserWritingProfile;
  onChange: (profile: UserWritingProfile) => void;
}) {
  const patchProfile = <K extends keyof UserWritingProfile>(key: K, value: UserWritingProfile[K]) => {
    onChange({ ...profile, [key]: value });
  };

  return (
    <div className="wizard-pane">
      <p className="eyebrow">STEP 1 · 使用AI選択</p>
      <h2>今回使用するAIを選んでください</h2>
      <p className="panel-muted">選んだAIと無料版・有料版に合わせて、AASが記事生成プロンプトを最適化します。後から上の①を押していつでも変更できます。</p>

      <div className="ai-setup-block">
        <div>
          <h3>使用AI</h3>
          <p>今回の記事生成に使うAIを選択してください。</p>
        </div>
      </div>
      <div className="ai-provider-grid" role="radiogroup" aria-label="使用AI">
        {(Object.keys(AI_PROVIDER_LABELS) as AiProvider[]).map((provider) => (
          <button
            key={provider}
            type="button"
            role="radio"
            aria-checked={profile.preferredAi === provider}
            className={profile.preferredAi === provider ? "active" : ""}
            onClick={() => patchProfile("preferredAi", provider)}
          >
            <strong>{AI_PROVIDER_LABELS[provider]}</strong>
            <small>{provider === "chatgpt" ? "構造化された記事指示" : provider === "claude" ? "長文の一貫性を意識" : "条件整理と構造化を意識"}</small>
          </button>
        ))}
      </div>

      <div className="ai-setup-block ai-setup-block-spaced">
        <div>
          <h3>利用プラン</h3>
          <p>無料版・有料版に合わせて、プロンプトの情報量と確認項目を調整します。</p>
        </div>
      </div>
      <div className="ai-plan-grid" role="radiogroup" aria-label="利用プラン">
        {(Object.keys(AI_PLAN_LABELS) as AiPlan[]).map((plan) => (
          <button
            key={plan}
            type="button"
            role="radio"
            aria-checked={profile.preferredPlan === plan}
            className={profile.preferredPlan === plan ? "active" : ""}
            onClick={() => patchProfile("preferredPlan", plan)}
          >
            <strong>{AI_PLAN_LABELS[plan]}</strong>
            <small>{plan === "free" ? "重要条件を優先してコンパクトに" : "詳細条件と長文整合性まで活用"}</small>
          </button>
        ))}
      </div>

      <label className="ai-personalization-toggle">
        <span>
          <strong>あなた向け最適化</strong>
          <small>ONでは設定した文章の好みと、記事保存時の小さな利用傾向を次回プロンプトへ反映します。</small>
        </span>
        <input
          type="checkbox"
          checked={profile.personalizationEnabled}
          onChange={(event) => patchProfile("personalizationEnabled", event.target.checked)}
        />
      </label>

      <div className="ai-profile-summary">
        {summarizeWritingProfile(profile).map((line) => <span key={line}>{line}</span>)}
      </div>
      <p className="ai-privacy-note">記事本文・AI回答全文・プロンプト全文を個人最適化プロフィールとして保存しません。</p>
    </div>
  );
}

const AI_LAUNCH_OPTIONS = [
  { key: "chatgpt", label: "ChatGPT" },
  { key: "claude", label: "Claude" },
  { key: "gemini", label: "Gemini" },
] as const;

function currentAiLaunchOptions() {
  const selected = getRuntimeWritingProfile()?.preferredAi;
  return selected ? AI_LAUNCH_OPTIONS.filter((option) => option.key === selected) : AI_LAUNCH_OPTIONS;
}

async function copyText(value: string, setMessage: MessageSetter): Promise<boolean> {
  if (!navigator.clipboard?.writeText) {
    setMessage("このブラウザーでは自動コピーできません。テキストを選択してコピーしてください。");
    return false;
  }
  try {
    await navigator.clipboard.writeText(value);
    setMessage("クリップボードへコピーしました。");
    return true;
  } catch {
    setMessage("コピーできませんでした。テキストを選択してコピーしてください。");
    return false;
  }
}

async function readClipboardText(setMessage: MessageSetter): Promise<string | null> {
  if (!navigator.clipboard?.readText) {
    setMessage("このブラウザーでは貼り付けボタンを利用できません。入力欄を長押しして貼り付けてください。");
    return null;
  }
  try {
    const value = await navigator.clipboard.readText();
    if (!value) {
      setMessage("クリップボードに貼り付けられる文章がありません。");
      return null;
    }
    setMessage("クリップボードから貼り付けました。");
    return value;
  } catch {
    setMessage("クリップボードを読み取れませんでした。ブラウザーの許可を確認するか、入力欄を長押しして貼り付けてください。");
    return null;
  }
}

function CopyButton({
  value,
  label,
  setMessage,
  className = "secondary-action",
}: {
  value: string;
  label: string;
  setMessage: MessageSetter;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyText(value, setMessage);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  };

  return (
    <button className={className} type="button" disabled={!value} onClick={() => void handleCopy()}>
      {copied ? "コピーしました ✓" : label}
    </button>
  );
}

export function GenerationMethodStep({
  draft,
  patch,
  magazinePlan,
  onMagazinePlanChange,
  setGenre,
  setSubgenre,
}: {
  draft: ArticleCreationDraft;
  patch: ArticleDraftPatch;
  magazinePlan: MagazinePlanDraft;
  onMagazinePlanChange: (value: MagazinePlanDraft) => void;
  setGenre: (value: string) => void;
  setSubgenre: (value: string) => void;
}) {
  const chooseSingle = () => patch("magazineEnabled", false);
  const chooseMagazine = () => {
    patch("magazineEnabled", true);
    if (draft.publicationTarget !== "note") patch("publicationTarget", "note");
  };

  return (
    <div className="wizard-pane">
      <p className="eyebrow">STEP 2 · 種類の選択</p>
      <h2>何を作成しますか？</h2>

      <div className="article-kind-grid">
        <label className={`article-kind-card ${!draft.magazineEnabled ? "selected" : ""}`}>
          <input type="radio" checked={!draft.magazineEnabled} onChange={chooseSingle} />
          <span className="article-kind-icon" aria-hidden="true">▧</span>
          <span>
            <strong>通常記事を作成</strong>
            <small>1つの記事をこれまでと同じ作成フローで仕上げます。</small>
          </span>
        </label>
        <label className={`article-kind-card ${draft.magazineEnabled ? "selected" : ""}`}>
          <input type="radio" checked={draft.magazineEnabled} onChange={chooseMagazine} />
          <span className="article-kind-icon" aria-hidden="true">▤</span>
          <span>
            <strong>マガジンモード</strong>
            <small>マガジン全体の構成を先に設計してから、各記事を順番に作成します。</small>
          </span>
        </label>
      </div>

      <div className="generation-select-row">
        <label className="reference-field">
          <span>本文の作り方</span>
          <select
            value={draft.generationMode}
            onChange={(event) => patch("generationMode", event.target.value as ArticleCreationDraft["generationMode"])}
          >
            <option value="prompt_export">AI用プロンプトを作る</option>
            <option value="manual">自分で本文を書く</option>
          </select>
        </label>
      </div>

      {draft.magazineEnabled ? (
        <MagazinePlannerPanel
          draft={draft}
          plan={magazinePlan}
          patch={patch}
          setGenre={setGenre}
          setSubgenre={setSubgenre}
          onPlanChange={onMagazinePlanChange}
        />
      ) : (
        <p className="beginner-help">記事テーマの別入力は不要です。ジャンル・サブジャンル等を決めたあと、STEP 5で記事タイトルを作成します。</p>
      )}
    </div>
  );
}

export function ImagePlanStep({
  draft,
  patch,
}: {
  draft: ArticleCreationDraft;
  patch: ArticleDraftPatch;
}) {
  return (
    <div className="wizard-pane">
      <p className="eyebrow">STEP 3</p><h2>記事に画像を入れますか？</h2>
      <label className="choice-card"><input type="checkbox" checked={draft.coverEnabled} onChange={(event) => patch("coverEnabled", event.target.checked)} /><span><strong>アイキャッチ画像を作る</strong><small>記事の先頭に表示するメイン画像です。基本はONがおすすめです。</small></span></label>
      <label className="choice-card"><input type="checkbox" checked={draft.inlineEnabled} onChange={(event) => patch("inlineEnabled", event.target.checked)} /><span><strong>挿絵を作る</strong><small>本文の途中に入れる画像です。必要な場合だけONにしてください。</small></span></label>
      {(draft.coverEnabled || draft.inlineEnabled) && (
        <label className="route-field image-style-field">
          <span>画像の画風</span>
          <select value={draft.imageStyle} onChange={(event) => patch("imageStyle", event.target.value)}>
            {IMAGE_STYLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <small>アニメ風・漫画風・イラスト風・図解・水彩・写真風などから選べます。「AIおまかせ」は共通プリセットや記事内容から最適化します。</small>
        </label>
      )}
      {draft.inlineEnabled && (
        <PresetNumberSelectWithCustom
          className="route-field"
          label="挿絵枚数"
          value={draft.inlineCount}
          onChange={(inlineCount) => patch("inlineCount", inlineCount)}
          presets={[1, 2, 3, 4, 5]}
          min={1}
          max={10}
          suffix="枚"
          description="通常は1〜5枚。必要な場合は最大10枚まで自由入力できます。"
        />
      )}
    </div>
  );
}

export function ArticleConditionsStep({
  draft,
  patch,
  setGenre,
  setCustomGenre,
  setSubgenre,
  setArticleType,
}: {
  draft: ArticleCreationDraft;
  patch: ArticleDraftPatch;
  setGenre: (value: string) => void;
  setCustomGenre: (value: string) => void;
  setSubgenre: (value: string) => void;
  setArticleType: (value: ArticleType) => void;
}) {
  const genreSelectValue = genreSelectionValue(draft.genre);
  const subgenreSelectValue = subgenreSelectionValue(draft.genre, draft.subgenre);
  const subgenreOptions = subgenreOptionsFor(draft.genre);
  const priceSelectionValue = paidArticlePriceSelectionValue(draft.price);

  return (
    <div className="wizard-pane">
      <p className="eyebrow">STEP 4</p><h2>記事の基本条件を選んでください</h2>
      <p className="beginner-help">年齢・ジャンル・サブジャンルなどの選択条件をAAS Knowledge Compilerが組み合わせ、タイトル・本文・画像・SNS向けの指示へ反映します。</p>
      <div className="creator-form-grid">
        <label className="route-field"><span>掲載先</span><select value={draft.publicationTarget} disabled={draft.magazineEnabled} onChange={(event) => patch("publicationTarget", event.target.value as PublicationTarget)}>{draft.magazineEnabled ? <option value="note">note（マガジン）</option> : <><option value="note">note</option><option value="tips">Tips</option><option value="brain">Brain</option><option value="blog">ブログ</option></>}</select></label>
        <label className="route-field"><span>記事タイプ</span><select value={draft.articleType} onChange={(event) => setArticleType(event.target.value as ArticleType)}><option value="free">無料記事</option><option value="paid">有料記事</option></select></label>
        <label className="route-field"><span>ジャンル</span><select value={genreSelectValue} onChange={(event) => setGenre(event.target.value)}>{GENRE_OPTIONS.map((genre) => <option key={genre} value={genre}>{genre}</option>)}</select>{genreSelectValue === "その他" && <input className="taxonomy-custom-input" value={draft.genre === "その他" ? "" : draft.genre} onChange={(event) => setCustomGenre(event.target.value)} placeholder="例: 観葉植物、ペット防災、AI英会話" maxLength={120} />}</label>
        <label className="route-field"><span>サブジャンル</span><select value={subgenreSelectValue} onChange={(event) => setSubgenre(event.target.value)}>{subgenreOptions.map((subgenre) => <option key={subgenre} value={subgenre}>{subgenre}</option>)}</select>{subgenreSelectValue === "その他" && <input className="taxonomy-custom-input" value={draft.subgenre === "その他" ? "" : draft.subgenre} onChange={(event) => patch("subgenre", event.target.value.slice(0, 120))} placeholder="サブジャンルを具体的に入力" maxLength={120} />}</label>
        <label className="route-field"><span>対象年齢</span><select value={draft.ageGroup} onChange={(event) => patch("ageGroup", event.target.value)}>{AGE_GROUP_OPTIONS.map((age) => <option key={age} value={age}>{age}</option>)}</select></label>
        <label className="route-field"><span>対象性別</span><select value={draft.gender} onChange={(event) => patch("gender", event.target.value)}>{GENDER_OPTIONS.map((gender) => <option key={gender} value={gender}>{gender}</option>)}</select></label>
        <SelectWithCustom
          className="route-field"
          label="文字数の目安"
          value={String(draft.targetLength)}
          onChange={(value) => patch(
            "targetLength",
            Math.max(500, Math.min(50000, Math.trunc(Number(value) || 500))),
          )}
          options={TARGET_LENGTH_OPTIONS.map((option) => ({
            value: String(option.value),
            label: option.label,
          }))}
          placeholder="文字数を選択"
          customPlaceholder="500〜50,000文字で自由入力"
          inputType="number"
          min={500}
          max={50000}
        />
        {draft.articleType === "paid" && (
          <div className="paid-price-settings">
            <label className="route-field">
              <span>価格（円）</span>
              <select
                value={priceSelectionValue}
                onChange={(event) => {
                  if (event.target.value === "custom") {
                    if (priceSelectionValue !== "custom") patch("price", draft.price ?? 980);
                    return;
                  }
                  patch("price", Number(event.target.value));
                }}
              >
                {PAID_ARTICLE_PRICE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                <option value="custom">自由入力</option>
              </select>
            </label>
            {priceSelectionValue === "custom" && (
              <label className="route-field">
                <span>自由価格（円）</span>
                <input type="number" min={1} step={1} value={draft.price ?? 980} onChange={(event) => patch("price", Math.max(1, Math.trunc(Number(event.target.value) || 1)))} />
              </label>
            )}
            {draft.publicationTarget === "note" && (
              <p className="beginner-help paid-price-note">note公式では通常会員100〜50,000円、プレミアム/note proは上限100,000円です。読み物系の売上上位記事平均983円、実用ノウハウ系1,842円を参考に、980円・1,980円付近を選びやすくしています。</p>
            )}
          </div>
        )}
        <label className="choice-card compact"><input type="checkbox" checked={draft.affiliateEnabled} onChange={(event) => patch("affiliateEnabled", event.target.checked)} /><span><strong>アフィリエイトを使う</strong><small>商品・サービス紹介を含む記事の場合にON</small></span></label>
        {draft.magazineEnabled && <div className="magazine-inline-status"><strong>▤ マガジン作成モード</strong><small>STEP 2で選んだマガジン設計を保存時に引き継ぎます。</small></div>}
      </div>
      {(genreSelectValue === "その他" || subgenreSelectValue === "その他") && <p className="knowledge-learning-note">自由入力したジャンル・サブジャンルは、記事本文とは分離して候補名と利用回数だけを集計します。管理者は個人を特定せず集計候補を確認し、必要なものだけ正式ナレッジへ承認できます。</p>}
    </div>
  );
}

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
          {aiLaunchOptions.map((app) => <button key={app.key} className="openai-launch-action" type="button" onClick={() => { onBeforeExternalLaunch(); launchAiApp(app.key); }}>選択中の{app.label}を開く ↗</button>)}
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
            {aiLaunchOptions.map((app) => <button key={app.key} className="openai-launch-action" type="button" onClick={() => { onBeforeExternalLaunch(); launchAiApp(app.key); }}>選択中の{app.label}を開く ↗</button>)}
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

export function PreviewStep({
  draft,
  imagePrompts,
  combinedImagePrompt,
  onBeforeExternalLaunch,
  setMessage,
}: {
  draft: ArticleCreationDraft;
  imagePrompts: ImagePromptItem[];
  combinedImagePrompt: string;
  onBeforeExternalLaunch: () => void;
  setMessage: MessageSetter;
}) {
  return (
    <div className="wizard-pane">
      <p className="eyebrow">STEP 7</p><h2>内容を確認しましょう</h2>
      <div className="preview-meta"><span>{draft.publicationTarget}</span><span>{draft.articleType === "paid" ? "有料" : "無料"}</span><span>{draft.genre || "ジャンル未指定"}</span><span>{draft.subgenre || "サブジャンル未指定"}</span><span>{draft.body.length.toLocaleString()}文字</span></div>
      <h3>{draft.title || "タイトル未入力"}</h3>
      <pre className="creator-preview">{draft.body || "本文がまだありません。"}</pre>

      {imagePrompts.length > 0 && combinedImagePrompt && (
        <section className="creator-image-prompts" aria-label="記事画像生成プロンプト">
          <div className="creator-image-prompts-head">
            <h3>画像生成プロンプト（一括・個別）</h3>
            <p className="panel-muted">STEP 3の画像設定と完成本文をもとに、一括作成用と画像ごとの個別作成用プロンプトを用意しています。</p>
          </div>
          <article className="creator-image-prompt-card">
            <div className="creator-image-prompt-title">
              <strong>まとめて画像作成プロンプト</strong>
              <span>{imagePrompts.length}枚分</span>
            </div>
            <textarea className="prompt-area large" readOnly value={combinedImagePrompt} />
            <div className="openai-prompt-actions">
              <CopyButton value={combinedImagePrompt} label="まとめて画像プロンプトをコピー" setMessage={setMessage} />
              {AI_LAUNCH_OPTIONS.map((app) => (
                <button key={app.key} className="openai-launch-action" type="button" onClick={() => { onBeforeExternalLaunch(); launchAiApp(app.key); }}>
                  {app.label}を開く ↗
                </button>
              ))}
            </div>
            <div className="creator-image-prompt-meta">
              {imagePrompts.map((item) => (
                <small key={item.kind + "-" + item.order}>
                  {item.kind === "cover" ? "アイキャッチ" : "挿絵 " + item.order}
                  {item.insertionMarker ? " / <!-- " + item.insertionMarker + " -->" : ""}
                  {" / " + item.suggestedFilename}
                </small>
              ))}
            </div>
          </article>
          <div className="route-notice">
            <strong>画像生成では一時チャットは使用不可</strong><br />
            ChatGPTで画像を作成する場合は通常チャットを使用してください。一括作成・個別作成のどちらでも同じです。
          </div>
          <div className="creator-image-prompts-head">
            <h4>個別に画像を作成</h4>
            <p className="panel-muted">必要な画像だけ作り直したい場合は、下の各プロンプトを1つずつコピーして画像生成AIへ貼り付けてください。</p>
          </div>
          {imagePrompts.map((item) => {
            const label = item.kind === "cover" ? "アイキャッチ" : "挿絵 " + item.order;
            return (
              <article className="creator-image-prompt-card" key={item.kind + "-individual-" + item.order}>
                <div className="creator-image-prompt-title">
                  <strong>{label}・個別作成プロンプト</strong>
                  <span>{item.suggestedFilename}</span>
                </div>
                <textarea className="prompt-area large" readOnly value={item.prompt} />
                <div className="openai-prompt-actions">
                  <CopyButton value={item.prompt} label={label + "の個別画像プロンプトをコピー"} setMessage={setMessage} />
                  {AI_LAUNCH_OPTIONS.map((app) => (
                    <button key={app.key} className="openai-launch-action" type="button" onClick={() => { onBeforeExternalLaunch(); launchAiApp(app.key); }}>
                      {app.label}を開く ↗
                    </button>
                  ))}
                </div>
                <div className="creator-image-prompt-meta">
                  <small>
                    {item.insertionMarker ? "差し込み位置: <!-- " + item.insertionMarker + " --> / " : ""}
                    {"保存名: " + item.suggestedFilename + " / alt候補: " + item.altText}
                  </small>
                </div>
              </article>
            );
          })}
          <p className="beginner-help">一括作成は全画像を同じ世界観でまとめて依頼する時、個別作成は特定の画像だけ作成・再作成する時に使います。どちらも一時チャットは使用せず、通常チャットで画像生成してください。</p>
        </section>
      )}
    </div>
  );
}

export function SaveStep({
  draft,
  patch,
  tagsText,
  setTagsText,
  busy,
  createdId,
  onSave,
  setMessage,
}: {
  draft: ArticleCreationDraft;
  patch: ArticleDraftPatch;
  tagsText: string;
  setTagsText: (value: string) => void;
  busy: boolean;
  createdId: string;
  onSave: () => Promise<void>;
  setMessage: MessageSetter;
}) {
  const [publicationCopied, setPublicationCopied] = useState(false);
  const publicationBody = publicationBodyForCopy(draft.body, draft.title);
  const editorLink = publicationEditorLink(draft.publicationTarget);
  const publicationLabel = draft.publicationTarget === "note"
    ? "note"
    : draft.publicationTarget === "tips"
      ? "Tips"
      : draft.publicationTarget === "brain"
        ? "Brain"
        : "ブログ";

  const copyPublicationBody = async () => {
    if (!publicationBody) return;
    try {
      const mode = await copyNoteRichText(publicationBody);
      setPublicationCopied(true);
      window.setTimeout(() => setPublicationCopied(false), 2600);
      setMessage(publicationLabel + "へ貼り付ける装飾付き本文をコピーしました（" + (mode === "rich" ? "HTML形式" : "リッチテキスト形式") + "）。");
    } catch (error) {
      setPublicationCopied(false);
      setMessage(error instanceof Error ? error.message : "装飾付きコピーに失敗しました。");
    }
  };
  return (
    <div className="wizard-pane">
      <p className="eyebrow">STEP 8</p><h2>タグを設定して記事ライブラリへ保存</h2>
      <p className="panel-muted">タグは記事内容が完成してから決めます。ジャンル・サブジャンルに合わせて投稿前の最終設定として入力してください。</p>
      <section className="creator-publish-copy" aria-label="掲載用コピー">
        <h3>完成記事を掲載先へコピー</h3>
        <p className="panel-muted">タイトルと本文を分けてコピーします。本文は見出し・太字・引用・リスト等をHTMLのリッチテキストとしてコピーし、挿絵位置と有料エリア位置はnoteへ貼り付けても見える目印として残します。</p>
        <div className="openai-prompt-actions">
          <CopyButton value={draft.title} label="タイトルをコピー" setMessage={setMessage} />
          <button className="primary-action" type="button" disabled={!publicationBody} onClick={() => void copyPublicationBody()}>{publicationCopied ? "装飾付きでコピーしました ✓" : "完成本文を装飾付きコピー"}</button>
        </div>
        {draft.publicationTarget === "note" && draft.articleType === "paid" && (
          <div className="note-paid-area-guide">
            <strong>有料noteの仕上げ</strong>
            <small>本文をnoteへ貼り付けると「【ここから有料エリア】」が残ります。noteの「有料エリア設定」でその位置に有料ラインを設定し、設定後に目印の文字だけ削除してください。</small>
          </div>
        )}
        {draft.inlineEnabled && (
          <div className="note-image-marker-guide">
            <strong>挿絵の差し込み</strong>
            <small>「【挿絵1をここに挿入】」などの目印位置へ画像を挿入し、画像配置後に目印の文字だけ削除してください。</small>
          </div>
        )}
        {editorLink
          ? <a className="openai-launch-action creator-publication-link" href={editorLink} target="_blank" rel="noreferrer">{publicationLabel}の投稿先を開く ↗</a>
          : <p className="beginner-help">「ブログ」は特定サービスを指さないため外部URLを固定していません。利用中のブログ管理画面を開いて貼り付けてください。</p>}
      </section>
      <label className="route-field"><span>タグ（任意・投稿前に設定）</span><input value={tagsText} onChange={(event) => setTagsText(event.target.value)} placeholder="例：恋愛, 人間関係, 職場" /></label>
      <label className="route-field"><span>保存状態</span><select value={draft.saveStatus} onChange={(event) => patch("saveStatus", event.target.value as SaveStatus)}><option value="draft">下書き</option><option value="writing">執筆中</option><option value="ready">完成</option></select></label>
      <dl className="route-meta"><div><dt>タイトル</dt><dd>{draft.title || "未入力"}</dd></div><div><dt>掲載先</dt><dd>{draft.publicationTarget}</dd></div><div><dt>ジャンル</dt><dd>{draft.genre} / {draft.subgenre}</dd></div><div><dt>本文</dt><dd>{draft.body.length.toLocaleString()}文字</dd></div><div><dt>画像</dt><dd>cover {draft.coverEnabled ? "ON" : "OFF"} / inline {draft.inlineEnabled ? draft.inlineCount : 0}</dd></div></dl>
      {!createdId && <button className="primary-action" type="button" disabled={busy || !draft.title.trim()} onClick={() => void onSave()}>{busy ? "保存中…" : "記事ライブラリへ保存"}</button>}
      {createdId && <div className="route-notice"><strong>保存完了</strong><br />Article ID: {createdId}</div>}
    </div>
  );
}
