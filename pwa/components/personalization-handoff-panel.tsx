"use client";

import { useMemo, useState } from "react";

import {
  AI_PROVIDER_LABELS,
  buildPersonalizationHandoffPrompt,
  type AiProvider,
  type UserWritingProfile,
} from "@/lib/user-personalization";

type PersonalizationTextKey = "personaContext" | "customInstructions" | "avoidPhrases";

type PresetOption = {
  value: string;
  label: string;
  group: string;
};

const PERSONA_PRESETS: PresetOption[] = [
  { group: "読者", label: "初心者向けにする", value: "主な読者は初心者。専門用語はかみ砕いて説明する" },
  { group: "読者", label: "経験者向けにする", value: "主な読者は経験者。基礎説明は短くし、実践的な判断材料を増やす" },
  { group: "目的", label: "理解・学習を優先", value: "目的は読者の理解・学習を助けること" },
  { group: "目的", label: "行動につなげる", value: "目的は読者が次の行動を自分で選べるようにすること" },
  { group: "視点", label: "実務・実践を重視", value: "実際に使う場面を想定し、実務・実践の視点を重視する" },
  { group: "信頼性", label: "事実と推測を分ける", value: "確認できた事実と推測・一般論を明確に分ける" },
  { group: "信頼性", label: "未確認の経験を作らない", value: "私自身の未確認の経験・実績・感情を作らない" },
  { group: "読みやすさ", label: "専門用語を補足", value: "専門用語を使う場合は短い補足を付ける" },
];

const INSTRUCTION_PRESETS: PresetOption[] = [
  { group: "構成", label: "結論から書く", value: "最初に結論や要点を示してから詳しく説明する" },
  { group: "構成", label: "手順で整理する", value: "手順がある内容はステップ形式で整理する" },
  { group: "構成", label: "メリット・注意点を両方", value: "メリットだけでなく注意点・向かないケースも書く" },
  { group: "具体性", label: "具体例を入れる", value: "抽象的な説明だけで終わらせず、具体例を入れる" },
  { group: "具体性", label: "判断基準を入れる", value: "読者が自分で判断できる基準やチェックポイントを入れる" },
  { group: "文体", label: "人間味を残す", value: "整えすぎたAI文ではなく、人が書いたような自然な文のリズムを残す" },
  { group: "文体", label: "同じ語尾を続けない", value: "同じ語尾や同じ文型を連続させない" },
  { group: "文体", label: "短い段落を中心", value: "長い段落を避け、スマホでも読みやすい短めの段落を中心にする" },
  { group: "情報量", label: "簡潔にする", value: "重複や前置きを減らし、必要な情報を簡潔にまとめる" },
  { group: "情報量", label: "詳しく説明する", value: "結論だけで終わらせず、理由・背景・具体例まで詳しく説明する" },
];

const AVOID_PRESETS: PresetOption[] = [
  { group: "誇張", label: "成果保証を避ける", value: "絶対に成功する・必ず稼げる・誰でもできる等の成果保証表現" },
  { group: "誇張", label: "煽りを避ける", value: "不安を過度に煽る表現や、今すぐ行動しないと損と断定する表現" },
  { group: "捏造", label: "架空の体験談を避ける", value: "確認していない自分の体験談・感想・実績を作ること" },
  { group: "捏造", label: "架空レビューを避ける", value: "存在を確認していない口コミ・レビュー・利用者の反応を作ること" },
  { group: "AI感", label: "AI定型句を避ける", value: "「いかがでしたでしょうか」等の不自然なAI定型文や不要なまとめ文" },
  { group: "AI感", label: "同じ語尾の連続を避ける", value: "同じ語尾・同じ接続表現を何度も連続させること" },
  { group: "装飾", label: "絵文字の使いすぎを避ける", value: "意味のない絵文字の連打や、毎行に絵文字を付けること" },
  { group: "装飾", label: "感嘆符の連打を避ける", value: "感嘆符や疑問符を過剰に連続使用すること" },
  { group: "表現", label: "曖昧な褒め言葉を避ける", value: "具体的な根拠のない「すごい」「最強」「革命的」等の抽象的な褒め言葉" },
  { group: "構成", label: "長い前置きを避ける", value: "本題に入るまでの長すぎる前置きや重複説明" },
];

const PROVIDER_GUIDANCE: Record<AiProvider, { title: string; detail: string; caution: string }> = {
  chatgpt: {
    title: "ChatGPTへ引き継ぐ",
    detail: "一時チャットは開始前に「パーソナライズあり / なし」を選べます。AASの引き継ぎプロンプトは、その選択とは別に、この会話へ明示的な文章設定として渡せます。",
    caution: "AASの設定がChatGPTのメモリやカスタム指示へ自動登録されるわけではありません。",
  },
  claude: {
    title: "Claudeへ引き継ぐ",
    detail: "シークレットチャットでは既存メモリを使いません。AASの引き継ぎプロンプトを貼ることで、この会話内だけに文章設定を明示できます。",
    caution: "Claude側のメモリ・プロフィール・カスタムスタイルへAASが自動登録することはありません。",
  },
  gemini: {
    title: "Geminiへ引き継ぐ",
    detail: "一時チャットではパーソナライズされた回答は利用できません。AASの引き継ぎプロンプトを貼ると、アカウントのパーソナライズではなく、この会話の明示指示として設定を渡せます。",
    caution: "Gemini側のPersonal Intelligenceや保存済み指示へAASが自動登録することはありません。",
  },
};

function splitItems(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim().replace(/^[-・]\s*/, ""))
    .filter((item, index, items) => item.length > 0 && items.indexOf(item) === index);
}

function joinItems(items: string[], maxLength: number): string {
  return items.join("\n").slice(0, maxLength);
}

function PresetAdder({
  title,
  description,
  value,
  options,
  maxLength,
  onChange,
}: {
  title: string;
  description: string;
  value: string;
  options: PresetOption[];
  maxLength: number;
  onChange: (value: string) => void;
}) {
  const [selected, setSelected] = useState("");
  const [custom, setCustom] = useState("");
  const [notice, setNotice] = useState("");
  const items = useMemo(() => splitItems(value), [value]);
  const grouped = useMemo(() => {
    const groups = new Map<string, PresetOption[]>();
    for (const option of options) {
      const list = groups.get(option.group) ?? [];
      list.push(option);
      groups.set(option.group, list);
    }
    return [...groups.entries()];
  }, [options]);

  const addItem = (candidate: string) => {
    const next = candidate.trim().replace(/\s+/g, " ");
    if (!next) {
      setNotice("追加する内容を選択または入力してください。");
      return;
    }
    if (items.includes(next)) {
      setNotice("この内容はすでに追加されています。");
      return;
    }
    if (items.length >= 12) {
      setNotice("1項目につき最大12件まで追加できます。");
      return;
    }
    const joined = [...items, next].join("\n");
    if (joined.length > maxLength) {
      setNotice(`保存できる上限は${maxLength}文字です。`);
      return;
    }
    onChange(joinItems([...items, next], maxLength));
    setSelected("");
    setCustom("");
    setNotice("");
  };

  const removeItem = (target: string) => {
    onChange(joinItems(items.filter((item) => item !== target), maxLength));
    setNotice("");
  };

  return (
    <section className="personalization-preset-builder">
      <div className="personalization-preset-builder-head">
        <div>
          <strong>{title}</strong>
          <small>{description}</small>
        </div>
        <span>{items.length}/12件</span>
      </div>

      <div className="personalization-preset-add">
        <select value={selected} onChange={(event) => setSelected(event.target.value)}>
          <option value="">選んで追加</option>
          {grouped.map(([group, groupOptions]) => (
            <optgroup key={group} label={group}>
              {groupOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <button type="button" disabled={!selected} onClick={() => addItem(selected)}>追加</button>
      </div>

      {items.length > 0 ? (
        <div className="personalization-preset-chips" aria-label={`${title}の追加済み項目`}>
          {items.map((item) => (
            <span key={item}>
              <b>{options.find((option) => option.value === item)?.label ?? item}</b>
              <button type="button" aria-label={`${item}を削除`} onClick={() => removeItem(item)}>×</button>
            </span>
          ))}
        </div>
      ) : (
        <p className="personalization-preset-empty">まだ追加されていません。必要なものだけ選べばOKです。</p>
      )}

      <div className="personalization-custom-add">
        <label>
          <span>一覧にない内容を自由入力</span>
          <input
            value={custom}
            maxLength={300}
            onChange={(event) => setCustom(event.target.value)}
            placeholder="例: 専門用語には身近な例えを1つ入れる"
            onKeyDown={(event) => {
              if (event.key === "Enter" && custom.trim()) {
                event.preventDefault();
                addItem(custom);
              }
            }}
          />
        </label>
        <button type="button" disabled={!custom.trim()} onClick={() => addItem(custom)}>自由入力を追加</button>
      </div>

      {notice && <p className="personalization-preset-notice" role="status">{notice}</p>}
    </section>
  );
}

export function PersonalizationHandoffPanel({
  profile,
  onChange,
}: {
  profile: UserWritingProfile;
  onChange: <K extends keyof UserWritingProfile>(key: K, value: UserWritingProfile[K]) => void;
}) {
  const [message, setMessage] = useState("");

  const copyHandoff = async (provider: AiProvider) => {
    const prompt = buildPersonalizationHandoffPrompt(profile, provider);
    if (!navigator.clipboard?.writeText) {
      setMessage("このブラウザーでは自動コピーできません。設定を保存後、対応ブラウザーでコピーしてください。");
      return;
    }
    try {
      await navigator.clipboard.writeText(prompt);
      setMessage(`${AI_PROVIDER_LABELS[provider]}用のパーソナライズ引き継ぎプロンプトをコピーしました。`);
    } catch {
      setMessage("コピーできませんでした。ブラウザーのクリップボード権限を確認してください。");
    }
  };

  const setText = (key: PersonalizationTextKey, value: string) => onChange(key, value);

  return (
    <section className="personalization-handoff" aria-labelledby="personalization-handoff-title">
      <div className="personalization-handoff-head">
        <div>
          <span>AAS PERSONALIZATION HANDOFF</span>
          <h3 id="personalization-handoff-title">AIへ伝える追加条件</h3>
          <p>
            基本はプルダウンから選んで「追加」するだけです。必要な項目はいくつでも組み合わせられ、
            一覧にない内容だけ自由入力で追加できます。
          </p>
        </div>
      </div>

      <div className="personalization-handoff-scope">
        <div>
          <strong>① 選ぶ</strong>
          <p>読者・構成・文体・NG表現など、よく使う条件をプルダウンから選びます。</p>
        </div>
        <div>
          <strong>② 追加する</strong>
          <p>「追加」を押すと条件が保存候補に入り、不要な条件は×で外せます。</p>
        </div>
        <div>
          <strong>③ 足りない時だけ自由入力</strong>
          <p>一覧にない自分だけのルールも、短い文章で追加できます。</p>
        </div>
      </div>

      <div className="personalization-handoff-fields">
        <PresetAdder
          title="AIに伝えたい執筆上の前提"
          description="誰向けに・何を重視して書くかを選びます。"
          value={profile.personaContext}
          options={PERSONA_PRESETS}
          maxLength={1200}
          onChange={(value) => setText("personaContext", value)}
        />
        <PresetAdder
          title="追加の文章・回答指示"
          description="構成、具体性、人間味、説明量などを選びます。"
          value={profile.customInstructions}
          options={INSTRUCTION_PRESETS}
          maxLength={2400}
          onChange={(value) => setText("customInstructions", value)}
        />
        <PresetAdder
          title="避けたい言葉・表現"
          description="誇張・捏造・AIっぽさなど、出してほしくない表現を選びます。"
          value={profile.avoidPhrases}
          options={AVOID_PRESETS}
          maxLength={1200}
          onChange={(value) => setText("avoidPhrases", value)}
        />
      </div>

      <div className="personalization-handoff-warning" role="note">
        <strong>秘密情報は入力しないでください</strong>
        <p>
          パスワード、APIキー、アクセストークン、認証コード、クレジットカード・銀行情報などは保存しないでください。
          ここで選択・入力した設定は、AASが作成する外部AI向けプロンプトへ含まれる場合があります。
        </p>
      </div>

      <details className="personalization-provider-details">
        <summary>ChatGPT・Claude・Geminiへの引き継ぎ方法を見る</summary>
        <div className="personalization-provider-handoff">
          {(Object.keys(PROVIDER_GUIDANCE) as AiProvider[]).map((provider) => {
            const item = PROVIDER_GUIDANCE[provider];
            return (
              <article key={provider}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                  <small>{item.caution}</small>
                </div>
                <button type="button" onClick={() => void copyHandoff(provider)}>
                  {AI_PROVIDER_LABELS[provider]}用をコピー
                </button>
              </article>
            );
          })}
        </div>
      </details>

      <div className="personalization-handoff-note">
        <strong>自動反映について</strong>
        <p>
          個人最適化がONの場合はAASが生成する記事・SNSプロンプトへ自動反映されます。
          別のチャットへ最初から渡したい場合だけ、上のAI別引き継ぎプロンプトをコピーしてください。
        </p>
      </div>

      {message && <p className="personalization-handoff-message" role="status">{message}</p>}
    </section>
  );
}
