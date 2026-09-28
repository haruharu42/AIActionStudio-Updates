import { MagazinePlannerPanel } from "@/components/article-create/magazine-planner";
import { PresetNumberSelectWithCustom, SelectWithCustom } from "@/components/select-with-custom";
import type { MagazinePlanDraft } from "@/lib/magazine-planner";
import {
  type ArticleCreationDraft,
  type ArticleType,
  type PublicationTarget,
} from "@/lib/phase11-create";
import {
  AI_PLAN_LABELS,
  AI_PROVIDER_LABELS,
  summarizeWritingProfile,
  type AiPlan,
  type AiProvider,
  type UserWritingProfile,
} from "@/lib/user-personalization";
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
import type { ArticleDraftPatch } from "@/components/article-create/article-create-step-shared";

export type { ArticleDraftPatch } from "@/components/article-create/article-create-step-shared";
export { TitleStep, BodyStep } from "@/components/article-create/article-create-generation-steps";
export { PreviewStep, SaveStep } from "@/components/article-create/article-create-finish-steps";

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
            <p className="beginner-help paid-price-note">
              980円・1,480円・1,980円などはAASの入力用プリセットです。実際に設定できる価格帯・手数料・販売条件は、{draft.publicationTarget === "note" ? "note" : draft.publicationTarget === "tips" ? "Tips" : draft.publicationTarget === "brain" ? "Brain" : "利用中のブログ／販売サービス"}側の最新ルールを投稿前に確認してください。
            </p>
          </div>
        )}
        <label className="choice-card compact"><input type="checkbox" checked={draft.affiliateEnabled} onChange={(event) => patch("affiliateEnabled", event.target.checked)} /><span><strong>アフィリエイトを使う</strong><small>商品・サービス紹介を含む記事の場合にON</small></span></label>
        {draft.magazineEnabled && <div className="magazine-inline-status"><strong>▤ マガジン作成モード</strong><small>STEP 2で選んだマガジン設計を保存時に引き継ぎます。</small></div>}
      </div>
      {(genreSelectValue === "その他" || subgenreSelectValue === "その他") && <p className="knowledge-learning-note">自由入力したジャンル・サブジャンルは、記事本文とは分離して候補名と利用回数だけを集計します。管理者は個人を特定せず集計候補を確認し、必要なものだけ正式ナレッジへ承認できます。</p>}
    </div>
  );
}

