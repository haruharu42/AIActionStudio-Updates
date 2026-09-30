"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AasReferenceHeader } from "@/components/aas-reference-shell";
import { AppLoadingScreen } from "@/components/app-loading-screen";
import { useSharedAccessState } from "@/components/access-state-provider";
import { ActiveWorkspacePresetBadge } from "@/features/presets/active-workspace-preset-badge";
import { applyWorkspacePresetToAccountDesign } from "@/features/presets/preset-adapters";
import { useWorkspacePreset } from "@/features/presets/workspace-preset-provider";
import { AccountStarterKitPanel } from "@/components/account-starter-kit-panel";
import {
  ACCOUNT_DESIGN_AUDIENCES,
  ACCOUNT_DESIGN_CONTENT_FOCUS,
  ACCOUNT_DESIGN_GENRES,
  ACCOUNT_DESIGN_GOALS,
  ACCOUNT_DESIGN_MONETIZATION,
  ACCOUNT_DESIGN_PLATFORMS,
  ACCOUNT_DESIGN_STYLES,
  ACCOUNT_DESIGN_TONES,
  ACCOUNT_DESIGN_TRUST,
  accountDesignLabels,
  buildPlatformProfileDraft,
  loadPlatformAccountDesigns,
  restorePlatformAccountDesignDraft,
  savePlatformAccountDesign,
  serializePlatformAccountDesignDraft,
  type AccountDesignAudience,
  type AccountDesignContentFocus,
  type AccountDesignGenre,
  type AccountDesignGoal,
  type AccountDesignMonetization,
  type AccountDesignPlatform,
  type AccountDesignStyle,
  type AccountDesignTone,
  type AccountDesignTrust,
  type PlatformAccountDesign,
} from "@/features/account-design";
import { getSupabaseClient } from "@/lib/supabase";

function platformLabel(platform: AccountDesignPlatform): string {
  return ACCOUNT_DESIGN_PLATFORMS.find((item) => item.value === platform)?.label ?? platform;
}

const ACCOUNT_DESIGN_DRAFT_STORAGE_PREFIX = "aas.account-design.draft.v1";

function initialAccountDesignPlatform(): AccountDesignPlatform {
  if (typeof window === "undefined") return "note";
  const value = new URLSearchParams(window.location.search).get("platform");
  return value === "tips" || value === "brain" || value === "note" ? value : "note";
}

function accountDesignDraftStorageKey(userId: string, platform: AccountDesignPlatform): string {
  return `${ACCOUNT_DESIGN_DRAFT_STORAGE_PREFIX}:${userId}:${platform}`;
}

function saveLocalAccountDesignDraft(design: PlatformAccountDesign): void {
  try {
    window.localStorage.setItem(
      accountDesignDraftStorageKey(design.userId, design.platform),
      serializePlatformAccountDesignDraft(design),
    );
  } catch {
    // Cloud save remains available even if this browser blocks local storage.
  }
}

function clearLocalAccountDesignDraft(userId: string, platform: AccountDesignPlatform): void {
  try {
    window.localStorage.removeItem(accountDesignDraftStorageKey(userId, platform));
  } catch {
    // Nothing else is required if local storage is unavailable.
  }
}

export function PlatformAccountDesignPage() {
  const { state, client } = useSharedAccessState();
  const { preference: workspacePreference } = useWorkspacePreset();
  const [loadError, setLoadError] = useState("");
  const [designs, setDesigns] = useState<Record<AccountDesignPlatform, PlatformAccountDesign> | null>(null);
  const [platform, setPlatform] = useState<AccountDesignPlatform>(() => initialAccountDesignPlatform());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [dirtyPlatforms, setDirtyPlatforms] = useState<AccountDesignPlatform[]>([]);

  useEffect(() => {
    if (state.kind !== "ready" || !client) return;
    let active = true;
    queueMicrotask(() => {
      if (active) setLoadError("");
    });
    const boot = async () => {
      try {
        const next = await loadPlatformAccountDesigns(client, state.profile.id);
        const restored = { ...next };
        const dirty: AccountDesignPlatform[] = [];
        for (const item of ACCOUNT_DESIGN_PLATFORMS) {
          const key = accountDesignDraftStorageKey(state.profile.id, item.value);
          let raw: string | null = null;
          try {
            raw = window.localStorage.getItem(key);
          } catch {
            raw = null;
          }
          const localDraft = restorePlatformAccountDesignDraft(raw, next[item.value]);
          if (localDraft) {
            restored[item.value] = localDraft;
            dirty.push(item.value);
          } else if (raw) {
            clearLocalAccountDesignDraft(state.profile.id, item.value);
          }
        }
        if (active) {
          setDesigns(restored);
          setDirtyPlatforms(dirty);
        }
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : "アカウント設計を読み込めませんでした。");
      }
    };
    void boot();
    return () => { active = false; };
  }, [client, state]);

  const design = designs?.[platform] ?? null;
  const labels = useMemo(() => design ? accountDesignLabels(design) : null, [design]);
  const platformMeta = ACCOUNT_DESIGN_PLATFORMS.find((item) => item.value === platform);

  const patch = <K extends keyof PlatformAccountDesign>(key: K, value: PlatformAccountDesign[K]) => {
    if (!designs) return;
    const nextDesign = { ...designs[platform], [key]: value };
    setDesigns({ ...designs, [platform]: nextDesign });
    saveLocalAccountDesignDraft(nextDesign);
    setDirtyPlatforms((current) => current.includes(platform) ? current : [...current, platform]);
    setMessage("");
  };

  const applyStarterDesign = (nextDesign: PlatformAccountDesign) => {
    if (!designs || nextDesign.platform !== platform || nextDesign.userId !== designs[platform].userId) return;
    setDesigns({ ...designs, [platform]: nextDesign });
    saveLocalAccountDesignDraft(nextDesign);
    setDirtyPlatforms((current) => current.includes(platform) ? current : [...current, platform]);
    setMessage("");
  };

  const save = async () => {
    if (!design) return;
    setBusy(true);
    setMessage("");
    try {
      const saved = await savePlatformAccountDesign(getSupabaseClient(), design);
      setDesigns((current) => current ? { ...current, [platform]: saved } : current);
      clearLocalAccountDesignDraft(saved.userId, platform);
      setDirtyPlatforms((current) => current.filter((item) => item !== platform));
      setMessage(`${platformLabel(platform)}のアカウント設計を保存しました。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "アカウント設計を保存できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const reloadCurrentPlatform = async () => {
    if (state.kind !== "ready") return;
    setBusy(true);
    setMessage("");
    try {
      const latest = await loadPlatformAccountDesigns(getSupabaseClient(), state.profile.id);
      clearLocalAccountDesignDraft(state.profile.id, platform);
      setDesigns((current) => current ? { ...current, [platform]: latest[platform] } : latest);
      setDirtyPlatforms((current) => current.filter((item) => item !== platform));
      setMessage(`${platformLabel(platform)}の最新設計を再読み込みしました。`);
    } catch {
      setMessage("最新のアカウント設計を再読み込みできませんでした。");
    } finally {
      setBusy(false);
    }
  };

  if (state.kind === "loading") {
    return <AppLoadingScreen message="アカウント設計の利用権を確認しています…" />;
  }

  if (state.kind === "ready" && client && !designs && !loadError) {
    return <AppLoadingScreen message="note / Tips / Brain のアカウント設計を読み込んでいます…" />;
  }

  if (state.kind !== "ready" || !client || !designs || !design || !labels) {
    return (
      <div className="account-design-shell">
        <AasReferenceHeader />
        <main className="account-design-gate">
          <p className="eyebrow">ACCOUNT DESIGN</p>
          <h1>note / Tips / Brain アカウント設計</h1>
          {state.kind === "unavailable" && <p>アカウント設計を読み込めませんでした。通信状態を確認してください。</p>}
          {state.kind === "signed_out" && <p>先にログインしてください。</p>}
          {state.kind === "pending" && <p>アカウント承認後に利用できます。</p>}
          {state.kind === "suspended" && <p>現在このアカウントは一時停止中です。</p>}
          {state.kind === "disabled" && <p>現在このアカウントでは利用できません。</p>}
          {state.kind === "entitlement_denied" && <p>PWA利用権を確認できませんでした。</p>}
          {state.kind === "ready" && loadError && <p>{loadError}</p>}
          <Link href="/">← ホームへ戻る</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="account-design-shell">
      <AasReferenceHeader />
      <main className="account-design-main">
        <header className="account-design-head">
          <div>
            <p className="eyebrow">ACCOUNT DESIGN</p>
            <h1>note / Tips / Brain アカウント設計</h1>
            <p>初心者は選ぶだけでOK。「その他」を選んだ項目だけ自由入力できます。媒体ごとに別々の設計をクラウド保存し、保存前の変更はこの端末へ自動退避します。</p>
          </div>
          <Link href="/tools">機能一覧へ</Link>
        </header>

        <div className="account-design-security">
          <strong>外部サービスのログイン情報は保存しません</strong>
          <span>パスワード・Cookie・アクセストークン・認証コードは入力不要です。AASが保存するのはアカウント設計だけです。</span>
        </div>

        <ActiveWorkspacePresetBadge feature="account_design" />
        {workspacePreference?.applyAccountDesign && (
          <div className="account-design-preset-apply">
            <div>
              <strong>設定画面の共通プリセットをアカウント設計へ反映</strong>
              <small>経験・資格・背景は変更せず、ジャンル・読者・発信トーン・収益化方針・主なテーマだけを反映します。</small>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!designs || !design) return;
                const nextDesign = applyWorkspacePresetToAccountDesign(design, workspacePreference);
                setDesigns({ ...designs, [platform]: nextDesign });
                saveLocalAccountDesignDraft(nextDesign);
                setDirtyPlatforms((current) => current.includes(platform) ? current : [...current, platform]);
                setMessage("共通プリセットをアカウント設計へ反映しました。内容を確認して保存してください。");
              }}
            >
              この設計へ反映
            </button>
          </div>
        )}

        <nav className="account-design-platforms" aria-label="設計する掲載先">
          {ACCOUNT_DESIGN_PLATFORMS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={platform === item.value ? "active" : ""}
              onClick={() => { setPlatform(item.value); setMessage(""); }}
            >
              <strong>{item.label}</strong>
              <small>{item.description}</small>
              <span>{dirtyPlatforms.includes(item.value) ? "● 保存前の変更あり" : designs[item.value].ready ? "✓ 設計済み" : "未完了"}</span>
            </button>
          ))}
        </nav>

        {message && <div className="route-notice account-design-message" role="status">{message}</div>}

        <AccountStarterKitPanel design={design} onApply={applyStarterDesign} />

        <section className="account-design-panel">
          <div className="account-design-section-head">
            <div>
              <span>{platform.toUpperCase()} ACCOUNT</span>
              <h2>{platformMeta?.label}の基本設計</h2>
              <p>8項目を選ぶと、右下の設計サマリーへすぐ反映されます。</p>
            </div>
            {platform === "note" && <Link href="/note-operations">note運営アシスタントへ ›</Link>}
          </div>

          <div className="account-design-layout">
            <div className="account-design-choice-grid">
              <label>
                <span>① ジャンル</span>
                <select value={design.genrePreset} onChange={(event) => patch("genrePreset", event.target.value as AccountDesignGenre)}>
                  {ACCOUNT_DESIGN_GENRES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                {design.genrePreset === "other" && <input value={design.customGenre} maxLength={120} onChange={(event) => patch("customGenre", event.target.value)} placeholder="ジャンルを入力" />}
              </label>

              <label>
                <span>② どんなアカウントにする？</span>
                <select value={design.accountStylePreset} onChange={(event) => patch("accountStylePreset", event.target.value as AccountDesignStyle)}>
                  {ACCOUNT_DESIGN_STYLES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                {design.accountStylePreset === "other" && <input value={design.customAccountStyle} maxLength={180} onChange={(event) => patch("customAccountStyle", event.target.value)} placeholder="希望するアカウント型を入力" />}
              </label>

              <label>
                <span>③ 主に誰に届ける？</span>
                <select value={design.audiencePreset} onChange={(event) => patch("audiencePreset", event.target.value as AccountDesignAudience)}>
                  {ACCOUNT_DESIGN_AUDIENCES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                {design.audiencePreset === "other" && <input value={design.customAudience} maxLength={300} onChange={(event) => patch("customAudience", event.target.value)} placeholder="届けたい読者を入力" />}
              </label>

              <label>
                <span>④ 文章・発信の雰囲気</span>
                <select value={design.tonePreset} onChange={(event) => patch("tonePreset", event.target.value as AccountDesignTone)}>
                  {ACCOUNT_DESIGN_TONES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                {design.tonePreset === "other" && <input value={design.customTone} maxLength={120} onChange={(event) => patch("customTone", event.target.value)} placeholder="希望する雰囲気を入力" />}
              </label>

              <label>
                <span>⑤ 収益化方針</span>
                <select value={design.monetizationPreset} onChange={(event) => patch("monetizationPreset", event.target.value as AccountDesignMonetization)}>
                  {ACCOUNT_DESIGN_MONETIZATION.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                {design.monetizationPreset === "other" && <input value={design.customMonetization} maxLength={180} onChange={(event) => patch("customMonetization", event.target.value)} placeholder="収益化方針を入力" />}
              </label>

              <label>
                <span>⑥ 運営目的</span>
                <select value={design.goalPreset} onChange={(event) => patch("goalPreset", event.target.value as AccountDesignGoal)}>
                  {ACCOUNT_DESIGN_GOALS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                {design.goalPreset === "other" && <input value={design.customGoal} maxLength={180} onChange={(event) => patch("customGoal", event.target.value)} placeholder="運営目的を入力" />}
              </label>

              <label>
                <span>⑦ 信頼の作り方</span>
                <select value={design.trustPreset} onChange={(event) => patch("trustPreset", event.target.value as AccountDesignTrust)}>
                  {ACCOUNT_DESIGN_TRUST.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                {design.trustPreset === "other" && <input value={design.customTrust} maxLength={180} onChange={(event) => patch("customTrust", event.target.value)} placeholder="信頼の作り方を入力" />}
              </label>

              <label>
                <span>⑧ コンテンツの中心</span>
                <select value={design.contentFocusPreset} onChange={(event) => patch("contentFocusPreset", event.target.value as AccountDesignContentFocus)}>
                  {ACCOUNT_DESIGN_CONTENT_FOCUS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                {design.contentFocusPreset === "other" && <input value={design.customContentFocus} maxLength={180} onChange={(event) => patch("customContentFocus", event.target.value)} placeholder="中心にしたいコンテンツを入力" />}
              </label>
            </div>

            <aside className="account-design-summary">
              <span>DESIGN SUMMARY</span>
              <h3>{platformMeta?.label}設計サマリー</h3>
              <dl>
                <div><dt>ジャンル</dt><dd>{labels.genre}</dd></div>
                <div><dt>アカウント型</dt><dd>{labels.style}</dd></div>
                <div><dt>読者</dt><dd>{labels.audience}</dd></div>
                <div><dt>トーン</dt><dd>{labels.tone}</dd></div>
                <div><dt>収益化</dt><dd>{labels.monetization}</dd></div>
                <div><dt>目的</dt><dd>{labels.goal}</dd></div>
                <div><dt>信頼</dt><dd>{labels.trust}</dd></div>
                <div><dt>中心内容</dt><dd>{labels.contentFocus}</dd></div>
              </dl>
            </aside>
          </div>

          <details className="account-design-advanced">
            <summary>必要な人だけ：表示名・テーマ・経験・プロフィール文</summary>
            <div className="account-design-detail-grid">
              <label><span>表示名（任意）</span><input value={design.displayName} maxLength={120} onChange={(event) => patch("displayName", event.target.value)} placeholder="未定でもOK" /></label>
              <label className="full"><span>扱いたいテーマ・キーワード（任意）</span><textarea value={design.mainTopics.join("\n")} onChange={(event) => patch("mainTopics", event.target.value.split(/[\n,、]/).map((value) => value.trim()).filter(Boolean).slice(0, 12))} placeholder={"例：ChatGPT活用\nAI副業\n初心者向け手順"} /></label>
              <label className="full"><span>事実として書ける経験・資格・背景（任意）</span><textarea value={design.experienceNote} maxLength={1200} onChange={(event) => patch("experienceNote", event.target.value)} placeholder="実際に事実として書ける内容だけ入力してください。未入力でもOKです。" /></label>
              <label className="full">
                <span>プロフィール文の下書き（任意）</span>
                <textarea value={design.profileDraft} maxLength={1200} onChange={(event) => patch("profileDraft", event.target.value)} placeholder="選択内容からAASでたたき台を作れます。" />
                <button type="button" onClick={() => patch("profileDraft", buildPlatformProfileDraft(design))}>選択内容からプロフィール文を作る</button>
              </label>
            </div>
          </details>

          <label className="account-design-ready">
            <input type="checkbox" checked={design.ready} onChange={(event) => patch("ready", event.target.checked)} />
            <span><strong>{platformMeta?.label}の基本設計が決まった</strong><small>後からいつでも変更できます。</small></span>
          </label>

          <div className="account-design-actions">
            <button className="primary-action" type="button" disabled={busy} onClick={() => void save()}>{busy ? "保存中…" : `${platformMeta?.label}の設計を保存`}</button>
            {dirtyPlatforms.includes(platform) && <button className="secondary-action" type="button" disabled={busy} onClick={() => void reloadCurrentPlatform()}>保存前の変更を破棄して最新を再読込</button>}
            <Link href={`/create?publicationTarget=${platform}`}>この設計を使って記事を作る ›</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
