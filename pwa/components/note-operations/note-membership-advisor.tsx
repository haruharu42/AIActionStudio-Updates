"use client";

import { useMemo, useState } from "react";

import { launchAiApp } from "@/lib/ai-app-links";
import {
  NOTE_MEMBERSHIP_AUDIENCES,
  NOTE_MEMBERSHIP_BENEFITS,
  NOTE_MEMBERSHIP_CONSULTATIONS,
  NOTE_MEMBERSHIP_FREQUENCIES,
  NOTE_MEMBERSHIP_KNOWLEDGE,
  NOTE_MEMBERSHIP_PRICE_BANDS,
  NOTE_MEMBERSHIP_PURPOSES,
  NOTE_MEMBERSHIP_TRIALS,
  NOTE_MEMBERSHIP_VISIBILITIES,
  NOTE_MEMBERSHIP_WORKLOADS,
  buildNoteMembershipAdvisorPrompt,
  type NoteMembershipAdvisorInput,
  type NoteMembershipAudienceStage,
  type NoteMembershipBenefit,
  type NoteMembershipConsultation,
  type NoteMembershipFrequency,
  type NoteMembershipPriceBand,
  type NoteMembershipPurpose,
  type NoteMembershipTrial,
  type NoteMembershipVisibility,
  type NoteMembershipWorkload,
} from "@/lib/note-membership-advisor";
import type { NoteOperationProfile } from "@/features/note";
import {
  AI_PROVIDER_LABELS,
  type AiProvider,
} from "@/lib/user-personalization";

function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange(value: T): void;
  options: readonly { value: T; label: string }[];
}) {
  return (
    <label className="note-membership-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

export function NoteMembershipAdvisor({
  profile,
  selectedAi,
  onMessage,
}: {
  profile: NoteOperationProfile;
  selectedAi: AiProvider;
  onMessage(message: string): void;
}) {
  const [form, setForm] = useState<NoteMembershipAdvisorInput>({
    consultation: "new",
    purpose: "mixed",
    audienceStage: "free_readers",
    planCount: 2,
    priceBand: "ai",
    primaryBenefit: "member_articles",
    secondaryBenefit: "board",
    frequency: "weekly1",
    workload: "1_3",
    trial: "ai",
    visibility: "public",
    note: "",
  });

  const prompt = useMemo(
    () => buildNoteMembershipAdvisorPrompt(profile, form),
    [profile, form],
  );

  const update = <K extends keyof NoteMembershipAdvisorInput>(
    key: K,
    value: NoteMembershipAdvisorInput[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const copyPrompt = async (): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(prompt);
      onMessage("noteメンバーシップ相談プロンプトをコピーしました。");
      return true;
    } catch {
      onMessage("自動コピーできませんでした。下のプロンプト欄からコピーしてください。");
      return false;
    }
  };

  const copyAndOpenAi = async () => {
    const copyTask = copyPrompt();
    launchAiApp(selectedAi);
    await copyTask;
  };

  return (
    <section className="note-membership-advisor" aria-labelledby="note-membership-advisor-title">
      <div className="note-membership-head">
        <div>
          <span>NOTE MEMBERSHIP ADVISOR</span>
          <h2 id="note-membership-advisor-title">noteメンバーシップ相談・設計</h2>
          <p>
            料金・特典・プラン数・更新頻度をプルダウンで選ぶだけで、
            現在のnoteプロフィールと専用Knowledgeを使ってメンバーシップ案を作ります。
          </p>
        </div>
        <b>選ぶだけで相談</b>
      </div>

      <div className="note-membership-official">
        <strong>note公式仕様を基準に設計</strong>
        <span>
          月額制、複数プラン、限定記事・掲示板等の特典、1ヶ月無料、2026年8月以降の請求仕様などを確認対象にしています。
          料金・手数料・請求条件など変わりうる項目は公開前に最新のnote公式画面を再確認します。
        </span>
      </div>

      <div className="note-membership-step">
        <div><span>1</span><strong>相談したいことを選ぶ</strong></div>
        <p>0から作る場合も、料金や特典だけ見直す場合も同じ窓口で相談できます。</p>
      </div>

      <div className="note-membership-grid">
        <SelectField<NoteMembershipConsultation>
          label="何を相談しますか？"
          value={form.consultation}
          onChange={(value) => update("consultation", value)}
          options={NOTE_MEMBERSHIP_CONSULTATIONS}
        />
        <SelectField<NoteMembershipPurpose>
          label="メンバーシップの中心目的"
          value={form.purpose}
          onChange={(value) => update("purpose", value)}
          options={NOTE_MEMBERSHIP_PURPOSES}
        />
        <SelectField<NoteMembershipAudienceStage>
          label="主に想定する読者"
          value={form.audienceStage}
          onChange={(value) => update("audienceStage", value)}
          options={NOTE_MEMBERSHIP_AUDIENCES}
        />
        <label className="note-membership-field">
          <span>プラン数</span>
          <select
            value={form.planCount}
            onChange={(event) => update("planCount", Number(event.target.value))}
          >
            {[1, 2, 3, 4, 5].map((count) => (
              <option key={count} value={count}>{count}プラン</option>
            ))}
          </select>
          <small>過去のnote公式案内では最大5プラン。公開時は最新仕様を確認します。</small>
        </label>
        <SelectField<NoteMembershipPriceBand>
          label="希望する料金帯"
          value={form.priceBand}
          onChange={(value) => update("priceBand", value)}
          options={NOTE_MEMBERSHIP_PRICE_BANDS}
        />
        <SelectField<NoteMembershipBenefit>
          label="主な特典"
          value={form.primaryBenefit}
          onChange={(value) => update("primaryBenefit", value)}
          options={NOTE_MEMBERSHIP_BENEFITS}
        />
        <SelectField<NoteMembershipBenefit>
          label="補助特典"
          value={form.secondaryBenefit}
          onChange={(value) => update("secondaryBenefit", value)}
          options={NOTE_MEMBERSHIP_BENEFITS}
        />
        <SelectField<NoteMembershipFrequency>
          label="更新・提供頻度"
          value={form.frequency}
          onChange={(value) => update("frequency", value)}
          options={NOTE_MEMBERSHIP_FREQUENCIES}
        />
        <SelectField<NoteMembershipWorkload>
          label="運営に使える時間"
          value={form.workload}
          onChange={(value) => update("workload", value)}
          options={NOTE_MEMBERSHIP_WORKLOADS}
        />
        <SelectField<NoteMembershipTrial>
          label="1ヶ月無料"
          value={form.trial}
          onChange={(value) => update("trial", value)}
          options={NOTE_MEMBERSHIP_TRIALS}
        />
        <SelectField<NoteMembershipVisibility>
          label="公開方法"
          value={form.visibility}
          onChange={(value) => update("visibility", value)}
          options={NOTE_MEMBERSHIP_VISIBILITIES}
        />
      </div>

      <details className="note-membership-extra">
        <summary>補足したいことがある場合だけ入力</summary>
        <label>
          <span>相談メモ</span>
          <textarea
            rows={5}
            value={form.note}
            onChange={(event) => update("note", event.target.value.slice(0, 2000))}
            placeholder="例: 個別相談は月2名までにしたい / 既存の有料記事を活かしたい / 初心者向けにしたい"
          />
        </label>
      </details>

      <div className="note-membership-step">
        <div><span>2</span><strong>AIへ相談する</strong></div>
        <p>
          {AI_PROVIDER_LABELS[selectedAi]}へ、現在のnoteプロフィール・選択内容・専用Knowledgeをまとめた相談プロンプトを渡します。
        </p>
      </div>

      <div className="note-membership-actions">
        <button type="button" className="primary-action" onClick={() => void copyAndOpenAi()}>
          プロンプトをコピーして{AI_PROVIDER_LABELS[selectedAi]}を開く
        </button>
        <button type="button" onClick={() => void copyPrompt()}>プロンプトだけコピー</button>
      </div>

      <div className="note-membership-output-guide">
        <strong>AIが作る内容</strong>
        <div>
          <span>コンセプト3案</span>
          <span>料金候補と理由</span>
          <span>プラン別特典</span>
          <span>無料 / 有料 / 会員限定の役割分担</span>
          <span>最初の30日運営案</span>
          <span>概要文・プラン説明</span>
          <span>FAQ</span>
          <span>告知記事・SNS案</span>
          <span>運営負荷チェック</span>
        </div>
      </div>

      <details className="note-membership-prompt">
        <summary>生成される相談プロンプトを確認</summary>
        <textarea value={prompt} readOnly rows={18} />
      </details>

      <div className="note-membership-source-links">
        <strong>Knowledgeの公式確認先</strong>
        {NOTE_MEMBERSHIP_KNOWLEDGE.sourceUrls.map((url) => (
          <a key={url} href={url} target="_blank" rel="noreferrer">{url} ↗</a>
        ))}
      </div>
    </section>
  );
}
