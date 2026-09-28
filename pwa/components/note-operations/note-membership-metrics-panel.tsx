"use client";

import { useEffect, useState } from "react";

import {
  currentMembershipMetricsMonth,
  hasMembershipMetrics,
  membershipMetricsStorageKey,
  parseMembershipMetricsEntries,
  parseMembershipMetricsEntry,
  upsertMembershipMetricsEntry,
  type NoteMembershipMetricsEntry,
} from "@/lib/note-membership-metrics";

function emptyEntry(month = currentMembershipMetricsMonth()): NoteMembershipMetricsEntry {
  return {
    month,
    memberCount: null,
    newMembers: null,
    cancellations: null,
    revenueYen: null,
    postCount: null,
    operationHours: null,
    memo: "",
  };
}

function numberOrNull(value: string, decimals = false): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return decimals ? Math.round(parsed * 10) / 10 : Math.floor(parsed);
}

function MetricInput({
  label,
  value,
  suffix,
  onChange,
  decimal = false,
}: {
  label: string;
  value: number | null;
  suffix: string;
  onChange(value: number | null): void;
  decimal?: boolean;
}) {
  return (
    <label className="note-membership-metric-field">
      <span>{label}</span>
      <div>
        <input
          type="number"
          min="0"
          step={decimal ? "0.5" : "1"}
          inputMode="decimal"
          value={value ?? ""}
          onChange={(event) => onChange(numberOrNull(event.target.value, decimal))}
        />
        <small>{suffix}</small>
      </div>
    </label>
  );
}

export function NoteMembershipMetricsPanel({
  userId,
  entries,
  onEntriesChange,
  onMessage,
}: {
  userId: string;
  entries: NoteMembershipMetricsEntry[];
  onEntriesChange(entries: NoteMembershipMetricsEntry[]): void;
  onMessage(message: string): void;
}) {
  const [draft, setDraft] = useState<NoteMembershipMetricsEntry>(() => emptyEntry());

  useEffect(() => {
    let active = true;
    let restored: NoteMembershipMetricsEntry[] = [];
    try {
      const raw = window.localStorage.getItem(membershipMetricsStorageKey(userId));
      restored = raw ? parseMembershipMetricsEntries(JSON.parse(raw) as unknown) : [];
    } catch {
      restored = [];
    }

    queueMicrotask(() => {
      if (!active) return;
      onEntriesChange(restored);
      setDraft(emptyEntry());
    });
    return () => { active = false; };
  }, [onEntriesChange, userId]);

  const persist = (next: NoteMembershipMetricsEntry[]) => {
    onEntriesChange(next);
    try {
      window.localStorage.setItem(membershipMetricsStorageKey(userId), JSON.stringify(next));
    } catch {
      onMessage("端末への保存に失敗しました。この画面を閉じるまでは入力内容を保持します。");
    }
  };

  const save = () => {
    if (!hasMembershipMetrics(draft)) {
      onMessage("会員数・加入・解約・売上・投稿数・運営時間・メモのどれかを入力してください。");
      return;
    }
    const validated = parseMembershipMetricsEntry(draft);
    if (!validated) {
      onMessage("対象月または数値を確認してください。負の値や大きすぎる値は保存できません。");
      return;
    }
    const next = upsertMembershipMetricsEntry(entries, validated);
    persist(next);
    setDraft(emptyEntry(validated.month));
    onMessage(validated.month + " のメンバーシップ実績を保存しました。");
  };

  const remove = (month: string) => {
    persist(entries.filter((entry) => entry.month !== month));
    onMessage(month + " の実績履歴を削除しました。");
  };

  return (
    <section className="note-membership-metrics" aria-labelledby="note-membership-metrics-title">
      <div className="note-membership-metrics-head">
        <div>
          <span>YOUR ACTUAL DATA</span>
          <h4 id="note-membership-metrics-title">実績入力・改善履歴</h4>
          <p>入力した数値だけを改善相談へ渡します。空欄の数値をAIが推測・補完することはありません。</p>
        </div>
        <b>端末内保存</b>
      </div>

      <div className="note-membership-metrics-privacy">
        この端末へAASアカウント別に保存します。noteのログイン情報・Cookie・認証情報・会員個人情報は保存しません。
      </div>

      <div className="note-membership-metrics-grid">
        <label className="note-membership-metric-field">
          <span>対象月</span>
          <div>
            <input
              type="month"
              max={currentMembershipMetricsMonth()}
              value={draft.month}
              onChange={(event) => setDraft((current) => ({ ...current, month: event.target.value }))}
            />
          </div>
        </label>
        <MetricInput label="月末時点の会員数" value={draft.memberCount} suffix="人" onChange={(value) => setDraft((x) => ({ ...x, memberCount: value }))} />
        <MetricInput label="新規加入" value={draft.newMembers} suffix="人" onChange={(value) => setDraft((x) => ({ ...x, newMembers: value }))} />
        <MetricInput label="解約" value={draft.cancellations} suffix="人" onChange={(value) => setDraft((x) => ({ ...x, cancellations: value }))} />
        <MetricInput label="売上" value={draft.revenueYen} suffix="円" onChange={(value) => setDraft((x) => ({ ...x, revenueYen: value }))} />
        <MetricInput label="メンバー向け投稿数" value={draft.postCount} suffix="本" onChange={(value) => setDraft((x) => ({ ...x, postCount: value }))} />
        <MetricInput label="運営時間" value={draft.operationHours} suffix="時間" decimal onChange={(value) => setDraft((x) => ({ ...x, operationHours: value }))} />
      </div>

      <label className="note-membership-metrics-memo">
        <span>その月のメモ（任意）</span>
        <textarea
          rows={3}
          maxLength={1000}
          value={draft.memo}
          onChange={(event) => setDraft((current) => ({ ...current, memo: event.target.value.slice(0, 1000) }))}
          placeholder="例：限定記事を週1に変更 / 質問受付を月2回へ整理"
        />
      </label>

      <button type="button" className="primary-action note-membership-metrics-save" onClick={save}>
        この月の実績を保存・更新
      </button>

      {entries.length > 0 ? (
        <div className="note-membership-metrics-history">
          <div>
            <strong>保存済みの改善履歴</strong>
            <small>最新6か月分をAI改善相談へ渡します。</small>
          </div>
          {entries.map((entry) => (
            <article key={entry.month}>
              <strong>{entry.month}</strong>
              <div>
                {entry.memberCount !== null ? <span>会員 {entry.memberCount}人</span> : null}
                {entry.newMembers !== null ? <span>加入 {entry.newMembers}人</span> : null}
                {entry.cancellations !== null ? <span>解約 {entry.cancellations}人</span> : null}
                {entry.revenueYen !== null ? <span>売上 {entry.revenueYen.toLocaleString("ja-JP")}円</span> : null}
                {entry.postCount !== null ? <span>投稿 {entry.postCount}本</span> : null}
                {entry.operationHours !== null ? <span>運営 {entry.operationHours}時間</span> : null}
              </div>
              {entry.memo ? <p>{entry.memo}</p> : null}
              <button type="button" onClick={() => remove(entry.month)}>この月を削除</button>
            </article>
          ))}
        </div>
      ) : (
        <p className="note-membership-metrics-empty">まだ実績は保存されていません。入力なしでも改善相談は利用できます。</p>
      )}
    </section>
  );
}
