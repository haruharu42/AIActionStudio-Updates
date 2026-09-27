"use client";

import { useState } from "react";

import {
  AI_PROVIDER_LABELS,
  buildPersonalizationHandoffPrompt,
  type AiProvider,
  type UserWritingProfile,
} from "@/lib/user-personalization";

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
    detail: "一時チャットではパーソナライズされた回答を利用しません。AASの引き継ぎプロンプトを貼ると、アカウントのパーソナライズではなく、この会話の明示指示として設定を渡せます。",
    caution: "Gemini側のPersonal Intelligenceや保存済み指示へAASが自動登録することはありません。",
  },
};

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
      setMessage("このブラウザーでは自動コピーできません。下の設定を保存後、対応ブラウザーでコピーしてください。");
      return;
    }
    try {
      await navigator.clipboard.writeText(prompt);
      setMessage(`${AI_PROVIDER_LABELS[provider]}用のパーソナライズ引き継ぎプロンプトをコピーしました。`);
    } catch {
      setMessage("コピーできませんでした。ブラウザーのクリップボード権限を確認してください。");
    }
  };

  return (
    <section className="personalization-handoff" aria-labelledby="personalization-handoff-title">
      <div className="personalization-handoff-head">
        <div>
          <span>AAS PERSONALIZATION HANDOFF</span>
          <h3 id="personalization-handoff-title">自分の設定をAIへ引き継ぐ</h3>
          <p>
            AASに自分の文章・回答の好みを保存できます。個人最適化がONのときはAASの生成プロンプトへ自動反映し、
            ON/OFFに関係なくChatGPT・Claude・Geminiへ渡す専用プロンプトをコピーできます。
          </p>
        </div>
      </div>

      <div className="personalization-handoff-scope">
        <div>
          <strong>引き継げるもの</strong>
          <p>文章の雰囲気、見出し、箇条書き、CTA、普段の掲載先・ジャンル、下で入力する追加指示・NG表現。</p>
        </div>
        <div>
          <strong>自動では引き継がれないもの</strong>
          <p>各AIサービス側のメモリ、チャット履歴、カスタム指示、Personal Intelligenceなどのアカウント設定。</p>
        </div>
      </div>

      <div className="personalization-handoff-fields">
        <label>
          <span>AIに伝えたい執筆上の前提</span>
          <textarea
            rows={4}
            maxLength={1200}
            value={profile.personaContext}
            onChange={(event) => onChange("personaContext", event.target.value.slice(0, 1200))}
            placeholder="例: noteでAI副業の記事を作っています。主な読者はAI初心者です。専門用語はできるだけかみ砕いてください。"
          />
          <small>{profile.personaContext.length}/1200文字</small>
        </label>

        <label>
          <span>追加の文章・回答指示</span>
          <textarea
            rows={5}
            maxLength={2400}
            value={profile.customInstructions}
            onChange={(event) => onChange("customInstructions", event.target.value.slice(0, 2400))}
            placeholder="例: 最初に結論を提示する。実例を入れる。専門用語には短い補足を付ける。文章は人間味を残し、同じ語尾を続けない。"
          />
          <small>{profile.customInstructions.length}/2400文字</small>
        </label>

        <label>
          <span>避けたい言葉・表現</span>
          <textarea
            rows={3}
            maxLength={1200}
            value={profile.avoidPhrases}
            onChange={(event) => onChange("avoidPhrases", event.target.value.slice(0, 1200))}
            placeholder="例: 絶対に稼げる / 誰でも成功 / 煽りすぎる表現 / 不自然なAI定型文"
          />
          <small>{profile.avoidPhrases.length}/1200文字</small>
        </label>
      </div>

      <div className="personalization-handoff-warning" role="note">
        <strong>入力しないでください</strong>
        <p>
          パスワード、APIキー、アクセストークン、認証コード、クレジットカード・銀行情報などの秘密情報は保存しないでください。
          この設定は、AASが作成する外部AI向けプロンプトへ含まれる場合があります。
        </p>
      </div>

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

      <div className="personalization-handoff-note">
        <strong>使い方</strong>
        <p>
          個人最適化がONの場合はAASが生成する記事・SNSプロンプトへ自動反映されます。別のチャットで最初から自分の設定を渡したい場合は、
          上のボタンで引き継ぎプロンプトをコピーし、最初のメッセージとして貼り付けてください。
        </p>
      </div>

      {message && <p className="personalization-handoff-message" role="status">{message}</p>}
    </section>
  );
}
