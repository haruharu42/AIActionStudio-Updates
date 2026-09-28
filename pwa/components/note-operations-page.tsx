"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AasReferenceHeader } from "@/components/aas-reference-shell";
import { NoteMembershipCockpit } from "@/components/note-operations/note-membership-cockpit";
import { NoteCalendarTab, NoteStartGuideTab } from "@/components/note-operations/note-operations-static-tabs";
import { useSharedAccessState } from "@/components/access-state-provider";
import { ActiveWorkspacePresetBadge } from "@/features/presets/active-workspace-preset-badge";
import { useWorkspacePreset } from "@/features/presets/workspace-preset-provider";
import { launchAiApp } from "@/lib/ai-app-links";
import { APP_RELEASE_STATE_EVENT } from "@/lib/app-release";
import {
  AAS_ADMIN_NOTE_PROFILE_PRESET,
  NOTE_ACCOUNT_GENRES,
  NOTE_ACCOUNT_STYLES,
  NOTE_AUDIENCE_PRESETS,
  NOTE_MONETIZATION_STYLES,
  NOTE_OPERATION_GOALS,
  NOTE_SCHEDULE_TYPE_LABELS,
  NOTE_TONE_PRESETS,
  applyAasAdminNoteProfilePreset,
  applyRuntimeWorkspacePresetToNoteProfile,
  buildNoteAccountResearchPrompt,
  buildNoteProfileDraft,
  buildNoteScheduleResearchPrompt,
  currentJstMonth,
  previousJstMonth,
  summarizeNoteSchedulePerformance,
  loadNoteArticleOutputSnapshot,
  exportNoteAiSchedulePlanJson,
  exportNoteOperationsJson,
  exportNoteScheduleCsv,
  listNoteSchedule,
  loadNoteAiSchedulePlan,
  loadNoteOperationProfile,
  isNoteArticleScheduleItem,
  parseNoteAiSchedulePlan,
  parseNoteOperationsImport,
  replaceNoteSchedule,
  replaceNoteScheduleMonth,
  saveNoteAiSchedulePlan,
  saveNoteOperationProfile,
  setNoteScheduleStatus,
  todayJstDateKey,
  type NoteAiSchedulePlan,
  type NoteArticleOutputSnapshot,
  type NoteOperationProfile,
  type NoteScheduleItem,
} from "@/features/note";
import {
  GENRE_OPTIONS,
  genreSelectionValue,
  subgenreOptionsFor,
  subgenreSelectionValue,
} from "@/lib/phase18-content-options";
import {
  downloadText,
  noteOperationsGateFor,
  notePerformanceLoopAvailable,
  noteScheduleResponseStorageKey,
} from "@/components/note-operations/note-operations-page-helpers";
import { getSupabaseClient } from "@/lib/supabase";
import {
  AI_PROVIDER_LABELS,
  loadWritingProfile,
  saveWritingProfile,
  type AiProvider,
  type UserWritingProfile,
} from "@/lib/user-personalization";

type Tab = "start" | "profile" | "plan" | "calendar" | "membership";

export function NoteOperationsPage() {
  const { state: accessState, client } = useSharedAccessState();
  const { preference: workspacePreference } = useWorkspacePreset();
  const [initError, setInitError] = useState("");
  const [tab, setTab] = useState<Tab>("start");
  const [profile, setProfile] = useState<NoteOperationProfile | null>(null);
  const [schedule, setSchedule] = useState<NoteScheduleItem[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [targetMonth, setTargetMonth] = useState(currentJstMonth());
  const [calendarMonth, setCalendarMonth] = useState(currentJstMonth());
  const [selectedAi, setSelectedAi] = useState<AiProvider>("chatgpt");
  const [writingProfile, setWritingProfile] = useState<UserWritingProfile | null>(null);
  const [accountPrompt, setAccountPrompt] = useState("");
  const [schedulePrompt, setSchedulePrompt] = useState("");
  const [scheduleResponse, setScheduleResponse] = useState("");
  const [scheduleResponseLoaded, setScheduleResponseLoaded] = useState(false);
  const [schedulePreview, setSchedulePreview] = useState<NoteAiSchedulePlan | null>(null);
  const [performanceLoopEnabled, setPerformanceLoopEnabled] = useState(false);
  const [articleOutput, setArticleOutput] = useState<NoteArticleOutputSnapshot | null>(null);
  const [previousArticleOutput, setPreviousArticleOutput] = useState<NoteArticleOutputSnapshot | null>(null);

  const gate = useMemo(() => noteOperationsGateFor(accessState, initError), [accessState, initError]);

  useEffect(() => {
    if (accessState.kind !== "ready" || !client) return;
    let active = true;
    const userId = accessState.profile.id;
    queueMicrotask(() => {
      if (active) setInitError("");
    });
    const boot = async () => {
      try {
        const [nextProfile, nextSchedule, nextWritingProfile] = await Promise.all([
          loadNoteOperationProfile(client, userId),
          listNoteSchedule(client, userId),
          loadWritingProfile(client, userId),
        ]);
        let savedScheduleResponse = "";
        try {
          savedScheduleResponse = window.localStorage.getItem(noteScheduleResponseStorageKey(userId)) ?? "";
        } catch {
          // Device storage is optional. The current session still works without it.
        }
        if (active) {
          setProfile(nextProfile);
          setSchedule(nextSchedule);
          setWritingProfile(nextWritingProfile);
          setSelectedAi(nextWritingProfile.preferredAi);
          setScheduleResponse(savedScheduleResponse);
          setScheduleResponseLoaded(true);
        }
      } catch (error) {
        if (active) setInitError(error instanceof Error ? error.message : "note運営を初期化できませんでした。");
      }
    };
    void boot();
    return () => { active = false; };
  }, [accessState, client]);

  const referenceMonth = useMemo(
    () => targetMonth === currentJstMonth() ? targetMonth : previousJstMonth(targetMonth),
    [targetMonth],
  );
  const referencePerformance = useMemo(
    () => summarizeNoteSchedulePerformance(schedule, referenceMonth),
    [schedule, referenceMonth],
  );
  const previousMonth = useMemo(() => previousJstMonth(targetMonth), [targetMonth]);
  const previousPerformance = useMemo(
    () => referenceMonth === previousMonth ? undefined : summarizeNoteSchedulePerformance(schedule, previousMonth),
    [schedule, referenceMonth, previousMonth],
  );

  useEffect(() => {
    const syncReleaseGate = () => setPerformanceLoopEnabled(notePerformanceLoopAvailable());
    syncReleaseGate();
    window.addEventListener(APP_RELEASE_STATE_EVENT, syncReleaseGate);
    return () => window.removeEventListener(APP_RELEASE_STATE_EVENT, syncReleaseGate);
  }, []);

  useEffect(() => {
    if (gate.kind !== "ready" || !scheduleResponseLoaded) return;
    try {
      const key = noteScheduleResponseStorageKey(gate.userId);
      if (scheduleResponse) {
        window.localStorage.setItem(key, scheduleResponse);
      } else {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Ignore storage failures. Do not block schedule import.
    }
  }, [gate, scheduleResponse, scheduleResponseLoaded]);

  useEffect(() => {
    if (gate.kind !== "ready" || !performanceLoopEnabled) return;
    let active = true;
    const client = getSupabaseClient();
    void Promise.all([
      loadNoteArticleOutputSnapshot(client, gate.userId, referenceMonth).catch(() => null),
      referenceMonth === previousMonth
        ? Promise.resolve(null)
        : loadNoteArticleOutputSnapshot(client, gate.userId, previousMonth).catch(() => null),
    ]).then(([currentSnapshot, previousSnapshot]) => {
      if (!active) return;
      setArticleOutput(currentSnapshot);
      setPreviousArticleOutput(previousSnapshot);
    });
    return () => { active = false; };
  }, [gate, performanceLoopEnabled, previousMonth, referenceMonth]);

  const articleSchedule = useMemo(
    () => schedule.filter((item) => isNoteArticleScheduleItem(item)),
    [schedule],
  );

  const groupedByDate = useMemo(() => {
    const map = new Map<string, NoteScheduleItem[]>();
    for (const item of articleSchedule) {
      const list = map.get(item.scheduledDate) ?? [];
      list.push(item);
      map.set(item.scheduledDate, list);
    }
    return map;
  }, [articleSchedule]);

  const previewPostingTimes = useMemo(() => {
    if (!schedulePreview) return [] as string[];
    const byDate = new Map<string, string[]>();
    for (const item of schedulePreview.schedule) {
      const times = byDate.get(item.scheduledDate) ?? [];
      if (!times.includes(item.scheduledTime)) times.push(item.scheduledTime);
      byDate.set(item.scheduledDate, times);
    }
    let result: string[] = [];
    for (const times of byDate.values()) {
      const sorted = [...times].sort();
      if (sorted.length > result.length) result = sorted;
    }
    return result;
  }, [schedulePreview]);

  const saveProfile = async () => {
    if (gate.kind !== "ready" || !profile) return;
    setBusy(true);
    setMessage("");
    try {
      await saveNoteOperationProfile(getSupabaseClient(), profile);
      setMessage("note運営設定を保存しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const openAccountBuilderAi = async () => {
    if (gate.kind !== "ready" || !profile) return;
    setBusy(true);
    setMessage("");
    try {
      await saveNoteOperationProfile(getSupabaseClient(), profile);
      if (writingProfile && writingProfile.preferredAi !== selectedAi) {
        const saved = await saveWritingProfile(getSupabaseClient(), { ...writingProfile, preferredAi: selectedAi });
        setWritingProfile(saved);
      }
      const prompt = buildNoteAccountResearchPrompt(profile, selectedAi);
      setAccountPrompt(prompt);
      try {
        await navigator.clipboard.writeText(prompt);
        setMessage(`${AI_PROVIDER_LABELS[selectedAi]}用の最新調査プロンプトをコピーしました。AI側で貼り付けて実行してください。`);
      } catch {
        setMessage("クリップボードへコピーできなかったため、下のプロンプト欄からコピーしてください。");
      }
      launchAiApp(selectedAi);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI用アカウント構成プロンプトを作成できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const openScheduleBuilderAi = async () => {
    if (gate.kind !== "ready" || !profile) return;
    setBusy(true);
    setMessage("");
    try {
      await saveNoteOperationProfile(getSupabaseClient(), profile);
      if (writingProfile && writingProfile.preferredAi !== selectedAi) {
        const saved = await saveWritingProfile(getSupabaseClient(), { ...writingProfile, preferredAi: selectedAi });
        setWritingProfile(saved);
      }
      const [freshArticleOutput, freshPreviousArticleOutput] = performanceLoopEnabled
        ? await Promise.all([
            loadNoteArticleOutputSnapshot(getSupabaseClient(), gate.userId, referenceMonth).catch(() => null),
            referenceMonth === previousMonth
              ? Promise.resolve(null)
              : loadNoteArticleOutputSnapshot(getSupabaseClient(), gate.userId, previousMonth).catch(() => null),
          ])
        : [undefined, undefined];
      if (performanceLoopEnabled) {
        setArticleOutput(freshArticleOutput ?? null);
        setPreviousArticleOutput(freshPreviousArticleOutput ?? null);
      }
      const prompt = buildNoteScheduleResearchPrompt(
        profile,
        selectedAi,
        targetMonth,
        todayJstDateKey(),
        performanceLoopEnabled ? referencePerformance : undefined,
        freshArticleOutput,
        performanceLoopEnabled ? previousPerformance : undefined,
        freshPreviousArticleOutput,
      );
      setSchedulePrompt(prompt);
      setSchedulePreview(null);
      try {
        await navigator.clipboard.writeText(prompt);
        setMessage(`${AI_PROVIDER_LABELS[selectedAi]}用の月間運用リサーチプロンプトをコピーしました。AIが回答したら、回答全文をコピーしてAASへ戻ってください。`);
      } catch {
        setMessage("クリップボードへコピーできなかったため、下のプロンプト欄からコピーしてください。");
      }
      launchAiApp(selectedAi);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "月間運用プロンプトを作成できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const previewAiSchedule = (text: string) => {
    setMessage("");
    try {
      const plan = parseNoteAiSchedulePlan(text, targetMonth);
      setScheduleResponse(text);
      setSchedulePreview(plan);
      setMessage(`${targetMonth.replace("-", "年")}月のAI運用案を読み込みました。内容を確認してからAASへ反映してください。`);
    } catch (error) {
      setSchedulePreview(null);
      setMessage(error instanceof Error ? error.message : "AIの運用スケジュールを読み込めませんでした。");
    }
  };

  const applySchedulePlan = async (plan: NoteAiSchedulePlan) => {
    if (gate.kind !== "ready") return;
    setBusy(true);
    setMessage("");
    try {
      const client = getSupabaseClient();
      const next = await replaceNoteScheduleMonth(client, gate.userId, targetMonth, plan.schedule);
      setSchedule(next);
      setSchedulePreview(plan);
      setCalendarMonth(targetMonth);
      let historySaved = true;
      try {
        await saveNoteAiSchedulePlan(client, gate.userId, plan);
      } catch {
        historySaved = false;
      }
      setMessage(historySaved
        ? `${targetMonth.replace("-", "年")}月のAI運用スケジュールをAASへ反映しました。カレンダーで確認できます。`
        : `${targetMonth.replace("-", "年")}月の予定は反映できましたが、AI調査メモだけ保存できませんでした。予定自体は利用できます。`);
      setTab("calendar");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI運用スケジュールを反映できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const applyAiSchedule = async () => {
    if (!schedulePreview) return;
    await applySchedulePlan(schedulePreview);
  };

  const importAndApplyAiSchedule = async (text: string) => {
    setMessage("");
    try {
      const plan = parseNoteAiSchedulePlan(text, targetMonth);
      setScheduleResponse(text);
      setSchedulePreview(plan);
      await applySchedulePlan(plan);
    } catch (error) {
      setSchedulePreview(null);
      setMessage(error instanceof Error ? error.message : "AIの運用スケジュールを読み込めませんでした。");
    }
  };

  const pasteAndApplyAiSchedule = async () => {
    try {
      if (!navigator.clipboard?.readText) {
        throw new Error("この端末ではクリップボードの自動読み込みを利用できません。回答全文を下の欄へ貼り付けてください。");
      }
      const text = await navigator.clipboard.readText();
      if (!text.trim()) throw new Error("クリップボードに読み込めるAI回答がありません。AIの回答全文をコピーしてからお試しください。");
      await importAndApplyAiSchedule(text);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "クリップボードからAI回答を読み込めませんでした。");
    }
  };

  const importAiScheduleFile = async (file: File) => {
    try {
      const text = await file.text();
      await importAndApplyAiSchedule(text);
    } catch {
      setMessage("AIスケジュールファイルを読み込めませんでした。");
    }
  };


  const clearScheduleResponse = () => {
    setScheduleResponse("");
    setSchedulePreview(null);
    if (gate.kind === "ready") {
      try {
        window.localStorage.removeItem(noteScheduleResponseStorageKey(gate.userId));
      } catch {
        // The UI state is already cleared even if browser storage is unavailable.
      }
    }
    setMessage("貼り付けたAI回答をクリアしました。");
  };


  const copyAiScheduleJson = async () => {
    if (!schedulePreview) return;
    const text = exportNoteAiSchedulePlanJson(schedulePreview);
    try {
      await navigator.clipboard.writeText(text);
      setMessage("AAS用の運用プランJSONをコピーしました。そのまま保存・共有・再貼り付けできます。");
    } catch {
      setMessage("JSONをクリップボードへコピーできませんでした。JSONファイル保存をお使いください。");
    }
  };

  const changeStatus = async (item: NoteScheduleItem, done: boolean) => {
    if (gate.kind !== "ready" || !item.id) return;
    setBusy(true);
    try {
      await setNoteScheduleStatus(getSupabaseClient(), gate.userId, item.id, done ? "done" : "planned");
      setSchedule((current) => current.map((value) => value.id === item.id ? { ...value, status: done ? "done" : "planned" } : value));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "状態を更新できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const importFile = async (file: File) => {
    if (gate.kind !== "ready" || !profile) return;
    setBusy(true);
    setMessage("");
    try {
      const parsed = parseNoteOperationsImport(await file.text(), file.name);
      if (!parsed.schedule.length) throw new Error("読み込める予定がありません。");
      if (!window.confirm(parsed.schedule.length + "件の予定を読み込み、現在のスケジュールと入れ替えますか？")) return;
      const nextProfile = parsed.profile ? { ...profile, ...parsed.profile, userId: gate.userId, timezone: "Asia/Tokyo" } : profile;
      await saveNoteOperationProfile(getSupabaseClient(), nextProfile);
      const nextSchedule = await replaceNoteSchedule(getSupabaseClient(), gate.userId, parsed.schedule);
      setProfile(nextProfile);
      setSchedule(nextSchedule);
      setMessage("運営データを読み込みました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ファイルを読み込めませんでした。");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (gate.kind !== "ready") return;
    let active = true;
    void loadNoteAiSchedulePlan(getSupabaseClient(), gate.userId, targetMonth).then(
      (plan) => {
        if (active && plan) setSchedulePreview(plan);
      },
      () => {
        // Previous plan history is optional. Schedule browsing must still work.
      },
    );
    return () => { active = false; };
  }, [gate, targetMonth]);

  if (gate.kind === "loading" || (gate.kind === "ready" && !profile)) return null;

  if (gate.kind !== "ready" || !profile) {
    return (
      <div className="note-ops-shell">
        <AasReferenceHeader />
        <main className="note-ops-gate">
          <p className="eyebrow">NOTE OPERATIONS</p>
          <h1>note運営アシスタント</h1>
          {gate.kind === "signed_out" && <p>先にログインしてください。</p>}
          {gate.kind === "error" && <p>{gate.message}</p>}
          <Link href="/">← ホームへ戻る</Link>
        </main>
      </div>
    );
  }

  const detailedGenreSelection = genreSelectionValue(profile.articleGenre);
  const detailedSubgenreOptions = subgenreOptionsFor(profile.articleGenre);
  const detailedSubgenreSelection = subgenreSelectionValue(profile.articleGenre, profile.articleSubgenre);

  return (
    <div className="note-ops-shell">
      <AasReferenceHeader />
      <main className="note-ops-main">
        <header className="note-ops-head">
          <div>
            <p className="eyebrow">NOTE OPERATIONS</p>
            <h1>note運営アシスタント</h1>
            <p>アカウント準備からプロフィール、無料・有料noteの運用予定、メンバーシップ相談、毎日のToDoまでAASで管理します。</p>
          </div>
          <Link href="/">ホームへ</Link>
        </header>

        <div className="note-ops-security-note">
          <strong>noteのログイン情報は保存しません</strong>
          <span>AASはnoteのパスワード、Cookie、認証コード、アクセストークンを入力・保存しません。運営計画と公開予定だけを管理します。</span>
        </div>

        <nav className="note-ops-tabs" aria-label="note運営メニュー">
          <button className={tab === "start" ? "active" : ""} onClick={() => setTab("start")}>1. はじめ方</button>
          <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}>2. プロフィール</button>
          <button className={tab === "plan" ? "active" : ""} onClick={() => setTab("plan")}>3. 運用プラン</button>
          <button className={tab === "calendar" ? "active" : ""} onClick={() => setTab("calendar")}>4. カレンダー</button>
          <button className={tab === "membership" ? "active" : ""} onClick={() => setTab("membership")}>5. メンバーシップ相談</button>
        </nav>

        {message && <div className="route-notice note-ops-message">{message}</div>}

        {tab === "start" && (
          <NoteStartGuideTab
            profile={profile}
            busy={busy}
            onProfileChange={setProfile}
            onSave={saveProfile}
          />
        )}
        {tab === "profile" && (
          <section className="note-ops-panel">
            <div className="note-ops-section-head">
              <div><span>PROFILE BUILDER</span><h2>初心者向け・選ぶだけプロフィール設計</h2></div>
              <Link href="/account-design">note / Tips / Brain 共通設計へ ›</Link>
            </div>
            <p className="note-ops-hint">この画面はnote運営専用の既存設定です。3媒体をまとめて設計する場合は「note / Tips / Brain 共通設計」を使えます。まずプルダウンで近いものを選ぶだけで大丈夫です。「その他」を選んだ場合だけ自由入力できます。経験・資格・実績は、実際に事実として書ける内容だけ使用します。</p>

            <ActiveWorkspacePresetBadge feature="note" />
            {workspacePreference?.applyNote && (
              <div className="note-shared-preset-apply">
                <div>
                  <strong>設定画面の共通プリセットをnote運営設定にも使う</strong>
                  <small>経験・資格・背景、投稿頻度、投稿時間、準備完了チェックは変更しません。</small>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = applyRuntimeWorkspacePresetToNoteProfile(profile);
                    setProfile(next);
                    setMessage("共通プリセットをnoteプロフィール条件へ反映しました。内容を確認してから保存してください。");
                  }}
                >
                  note設定へ反映
                </button>
              </div>
            )}

            {gate.isAdmin && (
              <section className="note-aas-admin-preset" aria-labelledby="aas-note-admin-preset-title">
                <div className="note-aas-admin-preset-head">
                  <div>
                    <span>ADMIN ONLY</span>
                    <h3 id="aas-note-admin-preset-title">AAS運営用プロフィール設定</h3>
                    <p>AI Article Studio自体のnote運営に使う管理者専用プリセットです。一般ユーザーには表示されません。</p>
                  </div>
                  <b>管理者限定</b>
                </div>
                <div className="note-aas-admin-preset-grid">
                  <div><small>主ジャンル</small><strong>{AAS_ADMIN_NOTE_PROFILE_PRESET.genre}</strong></div>
                  <div><small>運営スタイル</small><strong>{AAS_ADMIN_NOTE_PROFILE_PRESET.style}</strong></div>
                  <div><small>想定読者</small><strong>{AAS_ADMIN_NOTE_PROFILE_PRESET.audience}</strong></div>
                  <div><small>文章の雰囲気</small><strong>{AAS_ADMIN_NOTE_PROFILE_PRESET.tone}</strong></div>
                  <div><small>収益化方針</small><strong>{AAS_ADMIN_NOTE_PROFILE_PRESET.monetization}</strong></div>
                  <div><small>運営目的</small><strong>{AAS_ADMIN_NOTE_PROFILE_PRESET.goal}</strong></div>
                </div>
                <div className="note-aas-admin-topics">
                  <small>AAS向けの主なテーマ</small>
                  <div>{AAS_ADMIN_NOTE_PROFILE_PRESET.mainTopics.map((topic) => <span key={topic}>{topic}</span>)}</div>
                </div>
                <p className="note-aas-admin-warning">既存の「経験・資格・背景」、投稿時間、投稿頻度、準備完了チェックは変更しません。プリセット反映後も各項目を自由に編集でき、自動保存はされません。</p>
                <button
                  className="primary-action"
                  type="button"
                  onClick={() => {
                    const next = applyAasAdminNoteProfilePreset(profile);
                    setProfile(next);
                    setMessage("AAS運営用の管理者プリセットを反映しました。内容を確認し、「設定をAASに保存」で保存してください。");
                  }}
                >
                  AAS運営用設定を反映
                </button>
              </section>
            )}

            <div className="note-profile-choice-grid">
              <label><span>① noteアカウントの大きなジャンル</span><select value={profile.accountGenre} onChange={(event) => setProfile({ ...profile, accountGenre: event.target.value as NoteOperationProfile["accountGenre"] })}>{NOTE_ACCOUNT_GENRES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>{profile.accountGenre === "other" && <input value={profile.customGenre} maxLength={120} onChange={(event) => setProfile({ ...profile, customGenre: event.target.value })} placeholder="運営したいジャンルを入力" />}</label>
              <label><span>② 記事作成で使う詳細ジャンル</span><select value={detailedGenreSelection} onChange={(event) => { const value = event.target.value; setProfile({ ...profile, articleGenre: value, articleSubgenre: subgenreOptionsFor(value)[0] ?? "AIおまかせ" }); }}>{GENRE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select>{detailedGenreSelection === "その他" && <input value={profile.articleGenre === "その他" ? "" : profile.articleGenre} maxLength={120} onChange={(event) => setProfile({ ...profile, articleGenre: event.target.value || "その他", articleSubgenre: "AIおまかせ" })} placeholder="詳細ジャンルを自由入力" />}</label>
              <label><span>③ 記事作成で使うサブジャンル</span><select value={detailedSubgenreSelection} onChange={(event) => setProfile({ ...profile, articleSubgenre: event.target.value })}>{detailedSubgenreOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select>{detailedSubgenreSelection === "その他" && <input value={profile.articleSubgenre === "その他" ? "" : profile.articleSubgenre} maxLength={120} onChange={(event) => setProfile({ ...profile, articleSubgenre: event.target.value || "その他" })} placeholder="サブジャンルを自由入力" />}</label>
              <label><span>④ どんなアカウントにしたい？</span><select value={profile.accountStyle} onChange={(event) => setProfile({ ...profile, accountStyle: event.target.value as NoteOperationProfile["accountStyle"] })}>{NOTE_ACCOUNT_STYLES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>{profile.accountStyle === "other" && <input value={profile.customAccountStyle} maxLength={180} onChange={(event) => setProfile({ ...profile, customAccountStyle: event.target.value })} placeholder="例：失敗談も含めて一緒に学ぶアカウント" />}</label>
              <label><span>⑤ 主に誰に届けたい？</span><select value={profile.audiencePreset} onChange={(event) => setProfile({ ...profile, audiencePreset: event.target.value as NoteOperationProfile["audiencePreset"] })}>{NOTE_AUDIENCE_PRESETS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>{profile.audiencePreset === "other" && <input value={profile.customAudience} maxLength={300} onChange={(event) => setProfile({ ...profile, customAudience: event.target.value })} placeholder="届けたい読者を入力" />}</label>
              <label><span>⑥ 文体・文章の雰囲気</span><select value={profile.tonePreset} onChange={(event) => setProfile({ ...profile, tonePreset: event.target.value as NoteOperationProfile["tonePreset"] })}>{NOTE_TONE_PRESETS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>{profile.tonePreset === "other" && <input value={profile.customTone} maxLength={120} onChange={(event) => setProfile({ ...profile, customTone: event.target.value })} placeholder="希望する文体・雰囲気を入力" />}</label>
              <label><span>⑦ 収益化はどうしたい？</span><select value={profile.monetizationStyle} onChange={(event) => setProfile({ ...profile, monetizationStyle: event.target.value as NoteOperationProfile["monetizationStyle"] })}>{NOTE_MONETIZATION_STYLES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>{profile.monetizationStyle === "other" && <input value={profile.customMonetizationStyle} maxLength={180} onChange={(event) => setProfile({ ...profile, customMonetizationStyle: event.target.value })} placeholder="希望する収益化方針を入力" />}</label>
              <label><span>⑧ 運営の目的は？</span><select value={profile.operationGoal} onChange={(event) => setProfile({ ...profile, operationGoal: event.target.value as NoteOperationProfile["operationGoal"] })}>{NOTE_OPERATION_GOALS.map((goal) => <option key={goal.value} value={goal.value}>{goal.label}</option>)}</select></label>
            </div>

            <details className="note-profile-advanced">
              <summary>必要な人だけ：自由入力で詳しく設定</summary>
              <div className="note-profile-grid">
                <label><span>希望する表示名（任意）</span><input value={profile.noteDisplayName} maxLength={120} onChange={(event) => setProfile({ ...profile, noteDisplayName: event.target.value })} placeholder="未定でもOK" /></label>
                <label><span>読者の補足（任意）</span><input value={profile.targetReader} maxLength={600} onChange={(event) => setProfile({ ...profile, targetReader: event.target.value })} placeholder="例：AIをこれから使う30代の会社員" /></label>
                <label className="full"><span>扱いたいテーマ・キーワード（任意）</span><textarea value={profile.mainTopics.join("\n")} onChange={(event) => setProfile({ ...profile, mainTopics: event.target.value.split(/[\n,、]/).map((value) => value.trim()).filter(Boolean).slice(0, 12) })} placeholder={"例：ChatGPT活用\nAI副業\n初心者向け手順"} /></label>
                <label className="full"><span>事実として書ける経験・資格・背景（任意）</span><textarea value={profile.experienceNote} maxLength={1200} onChange={(event) => setProfile({ ...profile, experienceNote: event.target.value })} placeholder="未入力でもOK。AIが架空の経歴を追加することはありません。" /></label>
              </div>
            </details>

            <div className="note-ai-account-builder">
              <div className="note-ai-builder-head">
                <div><span>AI ACCOUNT DESIGN</span><h3>よく使うAIでアカウント構成候補を作る</h3><p>選んだ条件をもとに、実行時点のnote公式情報と直近トレンドをWeb検索してから3つの構成案を作るプロンプトです。</p></div>
              </div>
              <div className="note-ai-provider-grid">
                {(["chatgpt","gemini","claude"] as AiProvider[]).map((provider) => (
                  <button type="button" key={provider} className={selectedAi === provider ? "active" : ""} onClick={() => setSelectedAi(provider)}>
                    <strong>{AI_PROVIDER_LABELS[provider]}</strong>
                    <small>{writingProfile?.preferredAi === provider ? "現在のよく使うAI" : "選択する"}</small>
                  </button>
                ))}
              </div>
              <div className="note-ai-research-note">
                <strong>毎回、最新情報を調査</strong>
                <span>note公式の最新変更・創作カレンダー・開催中/直近の企画・選択ジャンルの直近90日/12か月トレンドを確認し、出典URLと日付を付けるよう指示します。検索できない場合は最新情報を作らないルールです。</span>
              </div>
              <button className="primary-action note-ai-build-button" type="button" disabled={busy} onClick={() => void openAccountBuilderAi()}>
                {busy ? "準備中…" : `${AI_PROVIDER_LABELS[selectedAi]}で最新情報から構成候補を作る`}
              </button>
              <p className="note-data-note">プロンプトをクリップボードへコピーして選択したAIを開きます。AASからAIサービスへAPIキーやnoteログイン情報は送信しません。</p>
              {accountPrompt && <details className="note-account-prompt"><summary>AIへ渡すプロンプトを確認・コピー</summary><textarea readOnly value={accountPrompt} rows={18} onFocus={(event) => event.currentTarget.select()} /></details>}
            </div>

            <div className="note-local-profile-draft">
              <strong>AIを使わない簡易プロフィール案</strong>
              <div className="note-profile-actions">
                <button type="button" onClick={() => setProfile({ ...profile, bioDraft: buildNoteProfileDraft(profile) })}>入力内容だけで下書きを作る</button>
                <button className="primary-action" type="button" disabled={busy} onClick={() => void saveProfile()}>設定をAASに保存</button>
              </div>
              {profile.bioDraft && <label className="note-profile-draft-field"><span>プロフィール文の下書き</span><textarea value={profile.bioDraft} maxLength={1200} onChange={(event) => setProfile({ ...profile, bioDraft: event.target.value })} /></label>}
            </div>
          </section>
        )}

        {tab === "plan" && (
          <section className="note-ops-panel">
            <div className="note-ops-section-head"><div><span>AI MONTHLY OPERATION PLAN</span><h2>AIに1か月の運用スケジュールを決めてもらう</h2></div></div>
            <p className="note-ops-hint">開始日ではなく「対象月」で計画します。投稿回数、有料noteの頻度、1日の投稿回数、曜日、時間帯、記事テーマまでChatGPT / Gemini / Claudeが最新情報を調査して提案します。時間や頻度は成果保証ではなく、検証するための運用仮説として扱います。</p>

            <div className="note-ai-month-controls">
              <label>
                <span>① 計画したい月</span>
                <input type="month" min={currentJstMonth()} value={targetMonth} onChange={(event) => { setTargetMonth(event.target.value || currentJstMonth()); setSchedulePreview(null); setArticleOutput(null); setPreviousArticleOutput(null); }} />
              </label>
              <div>
                <span>② リサーチに使うAI</span>
                <div className="note-ai-provider-grid">
                  {(["chatgpt","gemini","claude"] as AiProvider[]).map((provider) => (
                    <button type="button" key={provider} className={selectedAi === provider ? "active" : ""} onClick={() => setSelectedAi(provider)}>
                      <strong>{AI_PROVIDER_LABELS[provider]}</strong>
                      <small>{writingProfile?.preferredAi === provider ? "現在のよく使うAI" : "選択する"}</small>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <section className="note-monthly-target-card">
              <div>
                <strong>月の記事作成数の目安</strong>
                <span>ノルマではありません。AIは前月までの予定・完了状況とAASで実際に作成した記事数、今月の残り日数を見て多少前後させます。途中で何度でも組み直せます。</span>
              </div>
              <div className="note-monthly-target-grid">
                <label><span>無料note / 月の目安</span><input type="number" min={0} max={60} value={profile.freePostsPerMonth} onChange={(event) => { const freePostsPerMonth = Math.max(0, Math.min(60, Number(event.target.value) || 0)); setProfile({ ...profile, freePostsPerMonth, weeklyPostCount: Math.max(1, Math.min(14, Math.round((freePostsPerMonth + profile.paidPostsPerMonth) / 4))) }); }} /></label>
                <label><span>有料note / 月の目安</span><input type="number" min={0} max={60} value={profile.paidPostsPerMonth} onChange={(event) => { const paidPostsPerMonth = Math.max(0, Math.min(60, Number(event.target.value) || 0)); setProfile({ ...profile, paidPostsPerMonth, weeklyPostCount: Math.max(1, Math.min(14, Math.round((profile.freePostsPerMonth + paidPostsPerMonth) / 4))) }); }} /></label>
                <label><span>無料noteの文字数目安</span><input type="number" min={500} max={50000} step={500} value={profile.freeTargetLength} onChange={(event) => setProfile({ ...profile, freeTargetLength: Math.max(500, Math.min(50000, Number(event.target.value) || 4000)) })} /></label>
                <label><span>有料noteの文字数目安</span><input type="number" min={500} max={50000} step={500} value={profile.paidTargetLength} onChange={(event) => setProfile({ ...profile, paidTargetLength: Math.max(500, Math.min(50000, Number(event.target.value) || 7000)) })} /></label>
              </div>
              <small>月間本数は「目安」です。通常は近い本数を基準にしつつ、継続できた本数・前月実績・当月作成数によってAIが増減します。文字数はカレンダーから記事作成へ進む際の初期値として自動反映されます。</small>
              <button type="button" disabled={busy} onClick={() => void saveProfile()}>この目安をAASに保存</button>
            </section>

            <div className="note-ai-decision-list">
              <strong>AIに決めてもらう内容</strong>
              <div>
                <span>月間目安から実際の無料/有料本数を調整</span><span>1日に何回まで投稿するか</span><span>無料note / 有料noteの配分</span>
                <span>前月・今月の実績に合わせた増減</span><span>投稿する曜日・時間帯</span><span>その月の記事テーマ</span>
                <span>トレンド記事と長期記事の配分</span><span>無料note / 有料noteの作成日・時間</span>
                {performanceLoopEnabled && <span>実際の作成本数に合わせた途中再計画</span>}
              </div>
            </div>

            <div className="note-ai-research-note">
              <strong>最新情報を毎回調査</strong>
              <span>note公式、創作カレンダー、現在の企画・お題、カテゴリ/おすすめの仕組み、選択ジャンルの直近30日・90日・12か月を確認します。AIが決めるカレンダー予定は「無料note作成」「有料note作成」の2種類だけです。</span>
            </div>

            {performanceLoopEnabled && (
              <div className="note-ai-research-note">
                <strong>{targetMonth === currentJstMonth() ? "今月の実績から残り期間を組み直せます" : "直前月の実績から次月を調整します"}</strong>
                <span>
                  {referencePerformance
                    ? `${referenceMonth.replace("-", "年")}月の予定は${referencePerformance.scheduledPosts}件、完了${referencePerformance.donePosts}件、スキップ${referencePerformance.skippedPosts}件、未完了${referencePerformance.remainingPlannedPosts}件（完了率${referencePerformance.adherenceRate}%）です。`
                    : `${referenceMonth.replace("-", "年")}月の運用予定実績はまだありません。`}
                  {articleOutput
                    ? ` AASではnote記事を${articleOutput.createdPosts}本作成済み（無料${articleOutput.freeCreated} / 有料${articleOutput.paidCreated}）です。`
                    : " AAS内のnote記事作成実績はまだありません。"}
                  {previousPerformance && ` 前月${previousMonth.replace("-", "年")}月は予定${previousPerformance.scheduledPosts}件・完了${previousPerformance.donePosts}件（無料完了${previousPerformance.freeDone} / 有料完了${previousPerformance.paidDone}）でした。`}
                  {previousArticleOutput && ` 前月にAASで実際に作成したnoteは${previousArticleOutput.createdPosts}本（無料${previousArticleOutput.freeCreated} / 有料${previousArticleOutput.paidCreated}）です。`}
                  本文・PV・売上・購入率はAIへ渡しません。予定より多くても少なくても問題なく、再計画時は前月までの実績も参考に今日以降だけを組み直します。
                </span>
              </div>
            )}

            <button type="button" className="primary-action note-ai-build-button" disabled={busy} onClick={() => void openScheduleBuilderAi()}>
              {busy
                ? "準備中…"
                : targetMonth === currentJstMonth() && performanceLoopEnabled
                  ? `${AI_PROVIDER_LABELS[selectedAi]}で今月の残りを実績から組み直す`
                  : `${AI_PROVIDER_LABELS[selectedAi]}で${targetMonth.replace("-", "年")}月をリサーチする`}
            </button>

            {schedulePrompt && <details className="note-account-prompt"><summary>AIへ渡す月間スケジュール用プロンプトを確認</summary><textarea readOnly value={schedulePrompt} rows={18} onFocus={(event) => event.currentTarget.select()} /></details>}

            <div className="note-ai-import-box note-ai-easy-import">
              <div>
                <strong>③ AIの回答をそのままAASへ反映</strong>
                <small>JSONは不要です。ChatGPT / Gemini / Claudeの回答全文をそのままコピーしてください。AASが回答内の「無料note作成」「有料note作成」の予定表を自動で探します。</small>
              </div>
              <div className="note-ai-easy-actions">
                <button type="button" className="primary-action" disabled={busy} onClick={() => void pasteAndApplyAiSchedule()}>
                  {busy ? "反映中…" : "コピーしたAI回答を読み込んで反映"}
                </button>
                <span>または</span>
              </div>
              <textarea
                value={scheduleResponse}
                onChange={(event) => setScheduleResponse(event.target.value)}
                placeholder={"ここにAIの回答全文をそのまま貼り付けてください。前後に説明文があっても大丈夫です。"}
                rows={10}
              />
              <div className="note-data-actions">
                <button type="button" className="primary-action" disabled={busy || !scheduleResponse.trim()} onClick={() => void importAndApplyAiSchedule(scheduleResponse)}>
                  貼り付けた回答をそのまま反映
                </button>
                <button type="button" disabled={!scheduleResponse.trim()} onClick={() => previewAiSchedule(scheduleResponse)}>反映前に内容だけ確認</button>
                <button type="button" className="note-clear-response-button" disabled={!scheduleResponse} onClick={clearScheduleResponse}>貼り付け内容をクリア</button>
                <label className="note-import-button">ファイルから反映<input type="file" accept=".json,.txt,application/json,text/plain" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importAiScheduleFile(file); event.currentTarget.value = ""; }} /></label>
              </div>
              <p className="note-data-note">AIにはAASへ貼る予定表だけを返すよう指示します。貼り付けた内容はこの端末でアカウント別に保存され、「貼り付け内容をクリア」を押すまで再読み込みやAI再実行でも消えません。対象月が今月の場合、過去・完了・スキップ履歴は残し、今日以降の未実行記事予定だけを入れ替えます。</p>
            </div>

            {schedulePreview && (
              <div className="note-ai-plan-preview">
                <div className="note-ops-section-head"><div><span>RESEARCH PREVIEW</span><h2>{schedulePreview.targetMonth.replace("-", "年")}月 AI運用案</h2></div></div>
                <div className="note-plan-stats">
                  <article><small>平均投稿/週</small><strong>{schedulePreview.recommendation.postsPerWeek}</strong></article>
                  <article><small>有料note/週</small><strong>{schedulePreview.recommendation.paidPostsPerWeek}</strong></article>
                  <article><small>無料 / 有料</small><strong>{schedulePreview.recommendation.freePosts} / {schedulePreview.recommendation.paidPosts}</strong></article>
                  <article><small>1日最大</small><strong>{schedulePreview.recommendation.maxPostsPerDay}</strong></article>
                  <article className="note-plan-times"><small>投稿時間</small><strong>{previewPostingTimes.length ? previewPostingTimes.join(" / ") : "—"}</strong></article>
                </div>

                {schedulePreview.researchSummary && <div className="note-ai-plan-text"><strong>最新動向</strong><p>{schedulePreview.researchSummary}</p></div>}
                {schedulePreview.strategySummary && <div className="note-ai-plan-text"><strong>今月の運用方針</strong><p>{schedulePreview.strategySummary}</p></div>}
                {schedulePreview.recommendation.reason && <div className="note-ai-plan-text"><strong>この投稿頻度にした理由</strong><p>{schedulePreview.recommendation.reason}</p></div>}

                {schedulePreview.warnings.length > 0 && <div className="note-ai-plan-warnings"><strong>AASの確認事項</strong>{schedulePreview.warnings.map((warning) => <p key={warning}>• {warning}</p>)}</div>}

                <div className="note-ai-plan-sample">
                  <strong>予定プレビュー（{schedulePreview.schedule.length}件）</strong>
                  {schedulePreview.schedule.slice(0, 12).map((item, index) => (
                    <div key={item.scheduledDate + item.scheduledTime + index}><span>{item.scheduledDate} {item.scheduledTime}</span><b>{NOTE_SCHEDULE_TYPE_LABELS[item.itemType]}</b><em>{item.title}</em></div>
                  ))}
                  {schedulePreview.schedule.length > 12 && <small>ほか {schedulePreview.schedule.length - 12}件。反映後はカレンダーで全件確認できます。</small>}
                </div>

                {schedulePreview.sources.length > 0 && <details className="note-ai-plan-sources"><summary>AIが参照した情報源（{schedulePreview.sources.length}件）</summary>{schedulePreview.sources.map((source) => <div key={source.url}><strong>{source.title || "出典"}</strong><span>{source.publishedAt}</span><code>{source.url}</code>{source.whyUsed && <p>{source.whyUsed}</p>}</div>)}</details>}

                <details className="note-profile-advanced">
                  <summary>上級者向け：JSONバックアップ</summary>
                  <div className="note-data-actions">
                    <button type="button" onClick={() => void copyAiScheduleJson()}>AAS用JSONをコピー</button>
                    <button type="button" onClick={() => downloadText(`aas-note-schedule-${schedulePreview.targetMonth}.json`, exportNoteAiSchedulePlanJson(schedulePreview), "application/json;charset=utf-8")}>JSONファイルで保存</button>
                  </div>
                </details>
                <button type="button" className="primary-action note-ai-apply-button" disabled={busy} onClick={() => void applyAiSchedule()}>
                  {targetMonth === currentJstMonth() ? "今日以降の予定を組み直して反映" : "この月のAASスケジュールに反映"}
                </button>
                <p className="note-data-note">対象月だけを入れ替えます。他の月の予定は残ります。今月を途中で再計画する場合も、過去の予定と完了済み履歴は残します。AIの調査概要と根拠もAASへ保存するため、後から「なぜこの頻度にしたか」を確認できます。{performanceLoopEnabled ? "再計画では、予定実績とAAS内で実際に作成した無料/有料noteの本数を参考にします。本文や売上は自動学習しません。過去・完了・スキップ履歴は残し、今日以降の未実行予定だけを組み直します。" : ""}</p>
              </div>
            )}

            <details className="note-profile-advanced note-schedule-backup">
              <summary>バックアップ・従来形式の読み込み</summary>
              <div className="note-data-actions">
                <button type="button" disabled={!schedule.length} onClick={() => downloadText("aas-note-schedule.csv", exportNoteScheduleCsv(schedule), "text/csv;charset=utf-8")}>現在の予定をCSV保存</button>
                <button type="button" disabled={!schedule.length} onClick={() => downloadText("aas-note-operations.json", exportNoteOperationsJson(profile, schedule), "application/json;charset=utf-8")}>AAS運営データをJSON保存</button>
                <label className="note-import-button">従来JSON/CSVを読み込む<input type="file" accept=".json,.csv,application/json,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file); event.currentTarget.value = ""; }} /></label>
              </div>
            </details>
          </section>
        )}

        {tab === "membership" && (
          <NoteMembershipCockpit
            userId={gate.userId}
            profile={profile}
            selectedAi={selectedAi}
            onMessage={setMessage}
            onOpenCalendar={() => setTab("calendar")}
          />
        )}

        {tab === "calendar" && (
          <NoteCalendarTab
            profile={profile}
            calendarMonth={calendarMonth}
            groupedByDate={groupedByDate}
            articleSchedule={articleSchedule}
            busy={busy}
            onCalendarMonthChange={setCalendarMonth}
            onChangeStatus={changeStatus}
          />
        )}

      </main>
    </div>
  );
}
