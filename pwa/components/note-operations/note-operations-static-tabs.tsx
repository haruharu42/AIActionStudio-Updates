"use client";

import Link from "next/link";

import {
  NOTE_SCHEDULE_TYPE_LABELS,
  todayJstDateKey,
  type NoteOperationProfile,
  type NoteScheduleItem,
} from "@/features/note";
import {
  createHref,
  monthCells,
  moveMonth,
  typeClass,
} from "@/components/note-operations/note-operations-page-helpers";

const NOTE_HOME_URL = "https://note.com/";
const NOTE_PROFILE_OFFICIAL = "https://note.com/info/n/n27cb842c7737";
const NOTE_PAID_OFFICIAL = "https://note.com/info/n/na5f43ec69740";
const NOTE_RESERVATION_OFFICIAL = "https://note.com/info/n/nc84e9a40b092";

export function NoteStartGuideTab({
  profile,
  busy,
  onProfileChange,
  onSave,
}: {
  profile: NoteOperationProfile;
  busy: boolean;
  onProfileChange: (profile: NoteOperationProfile) => void;
  onSave: () => void | Promise<void>;
}) {
  return (
    <section className="note-ops-panel">
      <div className="note-ops-section-head">
        <div><span>START GUIDE</span><h2>noteを始める順番</h2></div>
        <a href={NOTE_HOME_URL} target="_blank" rel="noreferrer">note公式を開く ↗</a>
      </div>
      <div className="note-start-steps">
        <article><b>1</b><div><strong>noteアカウントを作る</strong><p>note公式を開き、画面の案内に沿ってアカウントを作成します。AASへnoteのパスワードを入力する必要はありません。</p></div></article>
        <article><b>2</b><div><strong>表示名・アイコン・発信テーマを決める</strong><p>誰に何を届けるアカウントかを先に決めると、プロフィールと記事テーマをそろえやすくなります。</p></div></article>
        <article><b>3</b><div><strong>プロフィール文と自己紹介記事を準備</strong><p>noteでは投稿した記事をプロフィールとして表示できる仕組みがあります。AASでは入力した事実だけから下書きを作ります。</p><a href={NOTE_PROFILE_OFFICIAL} target="_blank" rel="noreferrer">note公式のプロフィール案内 ↗</a></div></article>
        <article><b>4</b><div><strong>無料noteで読者の入口を作る</strong><p>AASおすすめとして、最初は無料記事を軸に投稿習慣とテーマの反応を確認します。これは成果を保証するものではありません。</p></div></article>
        <article><b>5</b><div><strong>必要に応じて有料noteを組み合わせる</strong><p>有料記事は価格と無料で読める範囲をnote側で設定します。</p><a href={NOTE_PAID_OFFICIAL} target="_blank" rel="noreferrer">note公式の有料記事案内 ↗</a></div></article>
        <article><b>6</b><div><strong>AASカレンダーで継続する</strong><p>AIが決めた「無料note作成」「有料note作成」の日付と時間だけをAASカレンダーへ保存します。AASカレンダー自体はプランを問わず使えます。note側の予約投稿はnoteプレミアム / note pro向け機能として案内されています。</p><a href={NOTE_RESERVATION_OFFICIAL} target="_blank" rel="noreferrer">note公式の予約投稿案内 ↗</a></div></article>
      </div>
      <div className="note-ready-checks">
        <label><input type="checkbox" checked={profile.accountReady} onChange={(event) => onProfileChange({ ...profile, accountReady: event.target.checked })} /> noteアカウントの作成が完了した</label>
        <label><input type="checkbox" checked={profile.profileReady} onChange={(event) => onProfileChange({ ...profile, profileReady: event.target.checked })} /> プロフィールの準備が完了した</label>
      </div>
      <button className="primary-action" disabled={busy} onClick={() => void onSave()}>進捗を保存</button>
    </section>
  );
}

export function NoteCalendarTab({
  profile,
  calendarMonth,
  groupedByDate,
  articleSchedule,
  busy,
  onCalendarMonthChange,
  onChangeStatus,
}: {
  profile: NoteOperationProfile;
  calendarMonth: string;
  groupedByDate: ReadonlyMap<string, NoteScheduleItem[]>;
  articleSchedule: NoteScheduleItem[];
  busy: boolean;
  onCalendarMonthChange: (month: string) => void;
  onChangeStatus: (item: NoteScheduleItem, done: boolean) => void | Promise<void>;
}) {
  return (
    <section className="note-ops-panel">
      <div className="note-calendar-head">
        <button onClick={() => onCalendarMonthChange(moveMonth(calendarMonth, -1))}>←</button>
        <div><span>CALENDAR</span><h2>{calendarMonth.replace("-", "年")}月</h2></div>
        <button onClick={() => onCalendarMonthChange(moveMonth(calendarMonth, 1))}>→</button>
      </div>
      <div className="note-calendar-weekdays">{["日","月","火","水","木","金","土"].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="note-calendar-grid">
        {monthCells(calendarMonth).map((cell) => {
          const items = groupedByDate.get(cell.date) ?? [];
          return (
            <article key={cell.date} className={(cell.current ? "" : "outside ") + (cell.date === todayJstDateKey() ? "today" : "")}>
              <strong>{Number(cell.date.slice(-2))}</strong>
              <div>{items.map((item, index) => <span key={item.id ?? item.scheduledDate + item.scheduledTime + index} className={typeClass(item)} title={item.title}>{item.scheduledTime} {NOTE_SCHEDULE_TYPE_LABELS[item.itemType]}</span>)}</div>
            </article>
          );
        })}
      </div>

      <div className="note-schedule-list">
        <h3>予定一覧</h3>
        {articleSchedule.length === 0 ? <p>無料note・有料noteの作成予定はまだありません。「運用プラン」からAIに作成してもらってください。</p> : articleSchedule.slice(0, 120).map((item, index) => (
          <article key={item.id ?? item.scheduledDate + item.scheduledTime + index} className={item.status === "done" ? "done" : ""}>
            <div className={"note-schedule-type " + typeClass(item)}>{NOTE_SCHEDULE_TYPE_LABELS[item.itemType]}</div>
            <div>
              <small>{item.scheduledDate} {item.scheduledTime}</small>
              <strong>{item.title}</strong>
              {item.theme && <span>テーマ：{item.theme}</span>}
            </div>
            <div className="note-schedule-actions">
              {(item.itemType === "free_note" || item.itemType === "paid_note") && <Link href={createHref(item, profile)}>この記事を作る</Link>}
              {item.id && <button disabled={busy} onClick={() => void onChangeStatus(item, item.status !== "done")}>{item.status === "done" ? "未完了に戻す" : "完了"}</button>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
