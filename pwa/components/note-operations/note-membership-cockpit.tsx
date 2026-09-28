"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { NoteMembershipAdvisor } from "@/components/note-operations/note-membership-advisor";
import { NoteMembershipMetricsPanel } from "@/components/note-operations/note-membership-metrics-panel";
import {
  NOTE_MEMBERSHIP_LAUNCH_CHECKLIST,
  buildMembershipCalendarPrompt,
  buildMembershipImprovePrompt,
  buildMembershipPagePrompt,
  buildMembershipPricingPrompt,
  buildMembershipPromotionPrompt,
  membershipArticleHref,
  membershipLaunchStorageKey,
  type MembershipCalendarInput,
  type MembershipImproveInput,
  type MembershipLaunchChecklistKey,
  type MembershipPageInput,
  type MembershipPricingInput,
  type MembershipPromotionInput,
  type NoteMembershipCockpitTab,
} from "@/lib/note-membership-cockpit";
import { launchAiApp } from "@/lib/ai-app-links";
import type { NoteOperationProfile } from "@/features/note";
import type { NoteMembershipMetricsEntry } from "@/lib/note-membership-metrics";
import {
  AI_PROVIDER_LABELS,
  type AiProvider,
} from "@/lib/user-personalization";

const TABS: readonly { key: NoteMembershipCockpitTab; label: string; short: string }[] = [
  { key: "consult", label: "相談・設計", short: "相談" },
  { key: "pricing", label: "料金・特典診断", short: "料金" },
  { key: "launch", label: "開始準備", short: "準備" },
  { key: "page", label: "紹介ページ", short: "紹介" },
  { key: "promotion", label: "告知・集客", short: "告知" },
  { key: "calendar", label: "月間運営", short: "運営" },
  { key: "improve", label: "改善相談", short: "改善" },
];

function CopyActions({
  prompt,
  selectedAi,
  onMessage,
}: {
  prompt: string;
  selectedAi: AiProvider;
  onMessage(message: string): void;
}) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      onMessage("プロンプトをコピーしました。");
      return true;
    } catch {
      onMessage("自動コピーできませんでした。下のプロンプト欄からコピーしてください。");
      return false;
    }
  };

  return (
    <>
      <div className="note-membership-actions">
        <button
          type="button"
          className="primary-action"
          onClick={() => void (async () => {
            const copyTask = copy();
            launchAiApp(selectedAi);
            await copyTask;
          })()}
        >
          プロンプトをコピーして{AI_PROVIDER_LABELS[selectedAi]}を開く
        </button>
        <button type="button" onClick={() => void copy()}>プロンプトだけコピー</button>
      </div>
      <details className="note-membership-prompt">
        <summary>生成されるプロンプトを確認</summary>
        <textarea value={prompt} readOnly rows={18} />
      </details>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  children,
  note,
}: {
  label: string;
  value: string | number;
  onChange(value: string): void;
  children: ReactNode;
  note?: string;
}) {
  return (
    <label className="note-membership-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
      {note ? <small>{note}</small> : null}
    </label>
  );
}

export function NoteMembershipCockpit({
  userId,
  profile,
  selectedAi,
  onMessage,
  onOpenCalendar,
}: {
  userId: string;
  profile: NoteOperationProfile;
  selectedAi: AiProvider;
  onMessage(message: string): void;
  onOpenCalendar(): void;
}) {
  const [tab, setTab] = useState<NoteMembershipCockpitTab>("consult");
  const [checked, setChecked] = useState<MembershipLaunchChecklistKey[]>([]);

  const [pricing, setPricing] = useState<MembershipPricingInput>({
    planCount: 2,
    currentPrice: "未設定・AIに相談",
    mainValue: "mixed",
    individualSupport: "light",
    weeklyHours: "1_3",
    goal: "balance",
  });
  const [pageInput, setPageInput] = useState<MembershipPageInput>({
    angle: "beginner",
    length: "standard",
    faq: "yes",
  });
  const [promotion, setPromotion] = useState<MembershipPromotionInput>({
    channel: "note",
    stage: "before_open",
    focus: "concept",
    image: "ai",
  });
  const [calendar, setCalendar] = useState<MembershipCalendarInput>({
    cadence: "weekly1",
    contentMix: "mixed",
    monthGoal: "habit",
  });
  const [improve, setImprove] = useState<MembershipImproveInput>({
    problem: "join",
    evidence: "none",
    changeRange: "small",
  });
  const [articleTheme, setArticleTheme] = useState("");
  const [metricsEntries, setMetricsEntries] = useState<NoteMembershipMetricsEntry[]>([]);

  useEffect(() => {
    let active = true;
    try {
      const raw = window.localStorage.getItem(membershipLaunchStorageKey(userId));
      if (!raw) return () => { active = false; };
      const value: unknown = JSON.parse(raw);
      if (!Array.isArray(value)) return () => { active = false; };
      const allowed = new Set(NOTE_MEMBERSHIP_LAUNCH_CHECKLIST.map((item) => item.key));
      const restored = value.filter((item): item is MembershipLaunchChecklistKey =>
        typeof item === "string" && allowed.has(item as MembershipLaunchChecklistKey),
      );
      queueMicrotask(() => {
        if (active) setChecked(restored);
      });
    } catch {
      // Device storage is optional.
    }
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(membershipLaunchStorageKey(userId), JSON.stringify(checked));
    } catch {
      // Progress remains available for this session.
    }
  }, [checked, userId]);

  const pricingPrompt = useMemo(() => buildMembershipPricingPrompt(profile, pricing), [profile, pricing]);
  const pagePrompt = useMemo(() => buildMembershipPagePrompt(profile, pageInput), [profile, pageInput]);
  const promotionPrompt = useMemo(() => buildMembershipPromotionPrompt(profile, promotion), [profile, promotion]);
  const calendarPrompt = useMemo(() => buildMembershipCalendarPrompt(profile, calendar), [profile, calendar]);
  const improvePrompt = useMemo(
    () => buildMembershipImprovePrompt(profile, improve, metricsEntries),
    [profile, improve, metricsEntries],
  );

  const progress = Math.round((checked.length / NOTE_MEMBERSHIP_LAUNCH_CHECKLIST.length) * 100);

  return (
    <section className="note-membership-cockpit" aria-labelledby="note-membership-cockpit-title">
      <div className="note-membership-cockpit-head">
        <div>
          <span>MEMBERSHIP COCKPIT</span>
          <h2 id="note-membership-cockpit-title">noteメンバーシップ運営コックピット</h2>
          <p>設計して終わりではなく、開始準備・募集・月間運営・改善まで1つの流れで進めます。</p>
        </div>
        <b>{progress}% 準備</b>
      </div>

      <nav className="note-membership-cockpit-tabs" aria-label="メンバーシップ運営メニュー">
        {TABS.map((item, index) => (
          <button
            key={item.key}
            type="button"
            className={tab === item.key ? "active" : ""}
            onClick={() => setTab(item.key)}
            title={item.label}
          >
            <span>{index + 1}</span>
            <strong>{item.label}</strong>
            <small>{item.short}</small>
          </button>
        ))}
      </nav>

      {tab === "consult" && (
        <NoteMembershipAdvisor
          profile={profile}
          selectedAi={selectedAi}
          onMessage={onMessage}
        />
      )}

      {tab === "pricing" && (
        <section className="note-membership-workspace">
          <div className="note-membership-workspace-head">
            <div><span>PRICE & BENEFIT</span><h3>料金・特典バランス診断</h3></div>
            <p>価格だけでなく、個別対応・更新頻度・運営時間まで含めて診断します。</p>
          </div>
          <div className="note-membership-grid">
            <Field label="プラン数" value={pricing.planCount} onChange={(value) => setPricing((x) => ({ ...x, planCount: Number(value) }))}>
              {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}プラン</option>)}
            </Field>
            <Field label="現在または想定価格" value={pricing.currentPrice} onChange={(value) => setPricing((x) => ({ ...x, currentPrice: value }))}>
              {["未設定・AIに相談","300〜500円","500〜1,000円","1,000〜3,000円","3,000〜5,000円","5,000円以上"].map((x) => <option key={x} value={x}>{x}</option>)}
            </Field>
            <Field label="中心価値" value={pricing.mainValue} onChange={(value) => setPricing((x) => ({ ...x, mainValue: value as MembershipPricingInput["mainValue"] }))}>
              <option value="content">限定記事・コンテンツ</option><option value="community">コミュニティ・交流</option><option value="qa">質問・Q&A</option><option value="individual">個別相談</option><option value="support">応援・活動支援</option><option value="mixed">複数を組み合わせる</option>
            </Field>
            <Field label="個別対応" value={pricing.individualSupport} onChange={(value) => setPricing((x) => ({ ...x, individualSupport: value as MembershipPricingInput["individualSupport"] }))}>
              <option value="none">なし</option><option value="light">軽い質問対応</option><option value="medium">月数件の個別対応</option><option value="heavy">継続的な個別相談</option>
            </Field>
            <Field label="運営可能時間" value={pricing.weeklyHours} onChange={(value) => setPricing((x) => ({ ...x, weeklyHours: value as MembershipPricingInput["weeklyHours"] }))}>
              <option value="under1">週1時間以内</option><option value="1_3">週1〜3時間</option><option value="3_5">週3〜5時間</option><option value="5_plus">週5時間以上</option>
            </Field>
            <Field label="価格方針" value={pricing.goal} onChange={(value) => setPricing((x) => ({ ...x, goal: value as MembershipPricingInput["goal"] }))}>
              <option value="easy_join">参加ハードルを低く</option><option value="balance">価格と価値のバランス</option><option value="premium">少人数・高付加価値</option><option value="ai">AIに判断してもらう</option>
            </Field>
          </div>
          <CopyActions prompt={pricingPrompt} selectedAi={selectedAi} onMessage={onMessage} />
        </section>
      )}

      {tab === "launch" && (
        <section className="note-membership-workspace">
          <div className="note-membership-workspace-head">
            <div><span>LAUNCH CHECK</span><h3>開始準備チェックリスト</h3></div>
            <p>この端末へアカウント別に保存します。noteのログイン情報は保存しません。</p>
          </div>
          <div className="note-membership-progress">
            <div><span style={{ width: progress + "%" }} /></div>
            <strong>{checked.length} / {NOTE_MEMBERSHIP_LAUNCH_CHECKLIST.length} 完了</strong>
          </div>
          <div className="note-membership-checklist">
            {NOTE_MEMBERSHIP_LAUNCH_CHECKLIST.map((item, index) => (
              <label key={item.key}>
                <input
                  type="checkbox"
                  checked={checked.includes(item.key)}
                  onChange={(event) => setChecked((current) =>
                    event.target.checked
                      ? [...new Set([...current, item.key])]
                      : current.filter((key) => key !== item.key),
                  )}
                />
                <span>{index + 1}</span>
                <strong>{item.label}</strong>
              </label>
            ))}
          </div>
          <div className="note-membership-launch-links">
            <a href="https://note.com/help/pg/membership" target="_blank" rel="noreferrer">note公式メンバーシップ運営ガイド ↗</a>
            <button type="button" onClick={() => setTab("page")}>紹介ページを作る →</button>
            <button type="button" onClick={() => setTab("promotion")}>告知を作る →</button>
          </div>
        </section>
      )}

      {tab === "page" && (
        <section className="note-membership-workspace">
          <div className="note-membership-workspace-head">
            <div><span>MEMBERSHIP PAGE</span><h3>メンバーシップ紹介ページ作成</h3></div>
            <p>見出し・箇条書き・FAQ・画像位置まで含め、noteへ貼りやすい原稿を作ります。</p>
          </div>
          <div className="note-membership-grid">
            <Field label="紹介ページの訴求軸" value={pageInput.angle} onChange={(value) => setPageInput((x) => ({ ...x, angle: value as MembershipPageInput["angle"] }))}>
              <option value="beginner">初心者にも分かりやすく</option><option value="benefit">参加価値を明確に</option><option value="community">交流・仲間感を重視</option><option value="creator">制作の裏側・支援</option><option value="professional">専門性・実務価値</option>
            </Field>
            <Field label="文章量" value={pageInput.length} onChange={(value) => setPageInput((x) => ({ ...x, length: value as MembershipPageInput["length"] }))}>
              <option value="short">短め</option><option value="standard">標準</option><option value="detailed">詳しく</option>
            </Field>
            <Field label="FAQ" value={pageInput.faq} onChange={(value) => setPageInput((x) => ({ ...x, faq: value as MembershipPageInput["faq"] }))}>
              <option value="yes">入れる</option><option value="no">入れない</option>
            </Field>
          </div>
          <CopyActions prompt={pagePrompt} selectedAi={selectedAi} onMessage={onMessage} />
        </section>
      )}

      {tab === "promotion" && (
        <section className="note-membership-workspace">
          <div className="note-membership-workspace-head">
            <div><span>PROMOTION</span><h3>募集・集客プロモーション</h3></div>
            <p>note・X・Threads・Instagram向けに、段階に合わせた告知原稿と画像指示を作ります。</p>
          </div>
          <div className="note-membership-grid">
            <Field label="告知媒体" value={promotion.channel} onChange={(value) => setPromotion((x) => ({ ...x, channel: value as MembershipPromotionInput["channel"] }))}>
              <option value="note">note告知記事</option><option value="x">X</option><option value="threads">Threads</option><option value="instagram">Instagram</option>
            </Field>
            <Field label="募集段階" value={promotion.stage} onChange={(value) => setPromotion((x) => ({ ...x, stage: value as MembershipPromotionInput["stage"] }))}>
              <option value="before_open">公開前の予告</option><option value="just_opened">公開開始直後</option><option value="ongoing">継続募集</option>
            </Field>
            <Field label="中心訴求" value={promotion.focus} onChange={(value) => setPromotion((x) => ({ ...x, focus: value as MembershipPromotionInput["focus"] }))}>
              <option value="concept">誰向け・コンセプト</option><option value="benefits">特典・参加価値</option><option value="founder">始める理由</option><option value="limited">実在する人数制限等</option><option value="faq">疑問解消</option>
            </Field>
            <Field label="画像・スクショ" value={promotion.image} onChange={(value) => setPromotion((x) => ({ ...x, image: value as MembershipPromotionInput["image"] }))}>
              <option value="ai">必要性をAIが判断</option><option value="yes">使う</option><option value="no">使わない</option>
            </Field>
          </div>
          <CopyActions prompt={promotionPrompt} selectedAi={selectedAi} onMessage={onMessage} />
        </section>
      )}

      {tab === "calendar" && (
        <section className="note-membership-workspace">
          <div className="note-membership-workspace-head">
            <div><span>MONTHLY OPERATION</span><h3>メンバー限定コンテンツ月間運営</h3></div>
            <p>更新を増やしすぎず、限定記事・掲示板・Q&Aなどを4週間へ整理します。</p>
          </div>
          <div className="note-membership-grid">
            <Field label="基本頻度" value={calendar.cadence} onChange={(value) => setCalendar((x) => ({ ...x, cadence: value as MembershipCalendarInput["cadence"] }))}>
              <option value="weekly1">週1回</option><option value="weekly2">週2回</option><option value="monthly2">月2回</option><option value="monthly1">月1回</option>
            </Field>
            <Field label="コンテンツ構成" value={calendar.contentMix} onChange={(value) => setCalendar((x) => ({ ...x, contentMix: value as MembershipCalendarInput["contentMix"] }))}>
              <option value="article">限定記事中心</option><option value="article_board">限定記事＋掲示板</option><option value="article_qa">限定記事＋Q&A</option><option value="mixed">複数を組み合わせる</option>
            </Field>
            <Field label="今月の優先目的" value={calendar.monthGoal} onChange={(value) => setCalendar((x) => ({ ...x, monthGoal: value as MembershipCalendarInput["monthGoal"] }))}>
              <option value="habit">無理なく継続</option><option value="value">会員価値を明確に</option><option value="conversation">交流を増やす</option><option value="retention">継続体験を整える</option>
            </Field>
          </div>
          <CopyActions prompt={calendarPrompt} selectedAi={selectedAi} onMessage={onMessage} />
          <div className="note-membership-article-links">
            <label>
              <span>記事へ引き継ぐテーマ（任意）</span>
              <input value={articleTheme} onChange={(event) => setArticleTheme(event.target.value.slice(0, 300))} placeholder="例：今月のAASアップデートをメンバー向けに深掘り" />
            </label>
            <div>
              <Link href={membershipArticleHref(articleTheme, "member")}>メンバー限定用記事を作る →</Link>
              <Link href={membershipArticleHref(articleTheme, "announcement")}>告知用の無料記事を作る →</Link>
              <Link href={membershipArticleHref(articleTheme, "qa")}>Q&A回答記事を作る →</Link>
              <button type="button" onClick={onOpenCalendar}>既存noteカレンダーを見る →</button>
            </div>
            <small>メンバー限定公開の設定はnote側で行います。AASの「有料記事の有料エリア」とは別扱いです。</small>
          </div>
        </section>
      )}

      {tab === "improve" && (
        <section className="note-membership-workspace">
          <div className="note-membership-workspace-head">
            <div><span>IMPROVEMENT</span><h3>開始後の改善相談</h3></div>
            <p>実績が少ない時は原因を断定せず、仮説→確認→小さな改善の順で見直します。</p>
          </div>
          <div className="note-membership-grid">
            <Field label="困っていること" value={improve.problem} onChange={(value) => setImprove((x) => ({ ...x, problem: value as MembershipImproveInput["problem"] }))}>
              <option value="join">加入につながりにくい</option><option value="retention">継続されにくい</option><option value="upper_plan">上位プランが選ばれにくい</option><option value="workload">運営負荷が高い</option><option value="engagement">交流・反応が少ない</option><option value="description">紹介ページが弱い</option>
            </Field>
            <Field label="確認できる実績データ" value={improve.evidence} onChange={(value) => setImprove((x) => ({ ...x, evidence: value as MembershipImproveInput["evidence"] }))}>
              <option value="none">まだほぼない</option><option value="some">少しある</option><option value="enough">比較できる程度ある</option>
            </Field>
            <Field label="変更してよい範囲" value={improve.changeRange} onChange={(value) => setImprove((x) => ({ ...x, changeRange: value as MembershipImproveInput["changeRange"] }))}>
              <option value="small">小さく改善</option><option value="medium">料金・特典も見直す</option><option value="large">プラン構造から見直す</option>
            </Field>
          </div>
          <NoteMembershipMetricsPanel
            userId={userId}
            entries={metricsEntries}
            onEntriesChange={setMetricsEntries}
            onMessage={onMessage}
          />
          <CopyActions prompt={improvePrompt} selectedAi={selectedAi} onMessage={onMessage} />
        </section>
      )}
    </section>
  );
}
