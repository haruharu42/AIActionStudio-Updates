"use client";

import Link from "next/link";

import { AdminSelectWithCustom } from "@/components/admin-form-controls";
import { useEffect, useMemo, useState } from "react";

import {
  adminCreateAppRelease,
  adminListAppReleases,
  adminRollbackAppRelease,
  adminSetAppReleaseTester,
  type AdminAppRelease,
  type AdminReleaseSnapshot,
} from "@/lib/app-release";
import { getSupabaseClient } from "@/lib/supabase";
import {
  AAS_CANARY_PWA_URL,
  AAS_PREVIEW_RELEASE_BRANCH,
  checkGithubReleaseReadiness,
  confirmCanaryDeployment,
  loadPublicPwaDeployments,
  requestCanaryPwaDeployment,
  requestPublicPwaDeployment,
  type PublicDeployment,
  type PublicDeploymentSnapshot,
  type GithubReleaseReadiness,
} from "@/lib/release-deployment";

type FormState = {
  version: string;
  title: string;
  notes: string;
  updateKind: "optional" | "required";
};

const RELEASE_TITLE_OPTIONS = [
  "記事作成UI改善",
  "記事作成の不具合修正",
  "管理者ツール改善",
  "表示・操作性改善",
  "認証・ログイン改善",
  "パフォーマンス改善",
  "安定性・セキュリティ改善",
  "新機能追加",
  "軽微な修正",
] as const;

const PREVIEW_BUILD_SHA = (process.env.NEXT_PUBLIC_AAS_BUILD_SHA ?? "").trim();
const IS_PREVIEW_DEPLOYMENT = process.env.NEXT_PUBLIC_AAS_RELEASE_AUDIENCE === "preview";
const PREVIEW_BUILD_SHORT = /^[0-9a-f]{40}$/.test(PREVIEW_BUILD_SHA) ? PREVIEW_BUILD_SHA.slice(0, 12) : "";

async function loadLivePreviewBuildSha(): Promise<string> {
  const response = await fetch("/?aas-build-check=" + Date.now(), {
    cache: "no-store",
    headers: { Accept: "text/html" },
  });
  if (!response.ok) throw new Error("preview build metadata request failed");
  const html = await response.text();
  const document = new DOMParser().parseFromString(html, "text/html");
  const value = document.querySelector('meta[name="aas-build-sha"]')?.getAttribute("content")?.trim() ?? "";
  return /^[0-9a-f]{40}$/.test(value) ? value : "";
}

function releaseMatchesPreviewBuild(release: AdminAppRelease | null): boolean {
  return Boolean(release && PREVIEW_BUILD_SHORT && release.build_key.endsWith("-" + PREVIEW_BUILD_SHORT));
}

const EMPTY_FORM: FormState = {
  version: "",
  title: "",
  notes: "",
  updateKind: "optional",
};

const PUBLISH_VERIFICATION_ITEMS = [
  { key: "preview-ci", label: "Production CanaryのbuildとCIを確認", detail: "Canaryへ出したsource SHAでTypecheck / Lint / 回帰テストが成功し、Canaryデプロイも成功している。" },
  { key: "tester-core", label: "公開テスターで主要導線を確認", detail: "AAS-000002等の指定テスターでProduction Canaryへ入り、ログイン・記事作成・保存・設定など主要導線を確認した。" },
  { key: "iphone-pwa", label: "iPhone実機Canaryを確認", detail: "Production Canaryをホーム画面または対応ブラウザで起動し、主要画面・復帰・キャッシュ更新を確認した。" },
  { key: "second-device", label: "別端末・別ブラウザのCanaryを確認", detail: "PCまたは別対応ブラウザでもProduction Canaryの主要導線に致命的な崩れ・runtime errorがない。" },
  { key: "tester-notifications", label: "Production Canary通知を確認", detail: "公開PWA側のテスター案内、Canary遷移、通知センターが想定どおり動作する。" },
  { key: "rollback", label: "停止・ロールバック経路を確認", detail: "Feature Controlのメンテナンス停止と、直前公開版へ戻す手順を確認した。" },
  { key: "operations", label: "重大な未解決障害がないことを確認", detail: "Security & Operationsで公開を止めるべきcritical/errorが残っていない。" },
] as const;

type PublishVerificationKey = (typeof PUBLISH_VERIFICATION_ITEMS)[number]["key"];

function publishVerificationStorageKey(releaseId: string): string {
  return `aas.release.publish-verification.${releaseId}`;
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("ja-JP");
}

function deploymentStatusLabel(status: PublicDeployment["status"]): string {
  if (status === "requested") return "公開要求を受付";
  if (status === "dispatched") return "GitHubへ送信済み";
  if (status === "running") return "テスト・一般公開処理中";
  if (status === "succeeded") return "一般公開PWAへ反映済み";
  if (status === "failed") return "一般公開に失敗";
  return "公開処理をキャンセル";
}

function statusLabel(status: AdminAppRelease["status"]): string {
  if (status === "candidate") return "管理者テスト中";
  if (status === "published") return "公開済み";
  if (status === "rolled_back") return "ロールバック済み";
  return "終了";
}

export function AdminReleasePage() {
  const [snapshot, setSnapshot] = useState<AdminReleaseSnapshot | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [testerAasId, setTesterAasId] = useState("AAS-000002");
  const [publishVerification, setPublishVerification] = useState<PublishVerificationKey[]>([]);
  const [currentSessionAal, setCurrentSessionAal] = useState<"aal1" | "aal2" | null>(null);
  const [aalCheckFailed, setAalCheckFailed] = useState(false);
  const [deploymentSnapshot, setDeploymentSnapshot] = useState<PublicDeploymentSnapshot | null>(null);
  const [githubReadiness, setGithubReadiness] = useState<GithubReleaseReadiness | null>(null);

  useEffect(() => {
    let active = true;
    const client = getSupabaseClient();
    void adminListAppReleases(client)
      .then((next) => { if (active) setSnapshot(next); })
      .catch(() => { if (active) setError("リリース情報を取得できませんでした。"); });
    void loadPublicPwaDeployments(client)
      .then((next) => { if (active) setDeploymentSnapshot(next); })
      .catch(() => { if (active) setDeploymentSnapshot(null); });
    void client.auth.mfa.getAuthenticatorAssuranceLevel().then(
      ({ data, error: aalError }) => {
        if (!active) return;
        if (aalError) {
          setCurrentSessionAal(null);
          setAalCheckFailed(true);
          return;
        }
        setCurrentSessionAal(data.currentLevel === "aal2" ? "aal2" : "aal1");
        setAalCheckFailed(false);
      },
      () => {
        if (!active) return;
        setCurrentSessionAal(null);
        setAalCheckFailed(true);
      },
    );
    return () => { active = false; };
  }, []);

  const current = useMemo(
    () => snapshot?.releases.find((release) => release.id === snapshot.channel.current_release_id) ?? null,
    [snapshot],
  );
  const candidate = useMemo(
    () => snapshot?.releases.find((release) => release.id === snapshot.channel.candidate_release_id) ?? null,
    [snapshot],
  );

  useEffect(() => {
    if (!candidate) {
      queueMicrotask(() => setPublishVerification([]));
      return;
    }
    try {
      const raw = window.localStorage.getItem(publishVerificationStorageKey(candidate.id));
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      const allowed = new Set(PUBLISH_VERIFICATION_ITEMS.map((item) => item.key));
      const restored = Array.isArray(parsed)
        ? parsed.filter((key): key is PublishVerificationKey => typeof key === "string" && allowed.has(key as PublishVerificationKey))
        : [];
      queueMicrotask(() => setPublishVerification(restored));
    } catch {
      queueMicrotask(() => setPublishVerification([]));
    }
  }, [candidate]);

  const publishVerificationReady = PUBLISH_VERIFICATION_ITEMS.every((item) => publishVerification.includes(item.key));
  const candidateCanaryDeployment = useMemo(
    () => candidate
      ? deploymentSnapshot?.deployments.find(
          (deployment) => deployment.release_id === candidate.id && deployment.deployment_kind === "canary",
        ) ?? null
      : null,
    [candidate, deploymentSnapshot],
  );
  const candidatePublicDeployment = useMemo(
    () => candidate
      ? deploymentSnapshot?.deployments.find(
          (deployment) => deployment.release_id === candidate.id && deployment.deployment_kind === "public",
        ) ?? null
      : null,
    [candidate, deploymentSnapshot],
  );
  const activeDeployment = useMemo(
    () => [candidatePublicDeployment, candidateCanaryDeployment].find(
      (deployment) => deployment && ["requested", "dispatched", "running"].includes(deployment.status),
    ) ?? null,
    [candidateCanaryDeployment, candidatePublicDeployment],
  );
  const canaryDeploymentInProgress = Boolean(
    candidateCanaryDeployment && ["requested", "dispatched", "running"].includes(candidateCanaryDeployment.status),
  );
  const publicDeploymentInProgress = Boolean(
    candidatePublicDeployment && ["requested", "dispatched", "running"].includes(candidatePublicDeployment.status),
  );
  const canaryVerified = Boolean(
    candidateCanaryDeployment?.status === "succeeded" && candidateCanaryDeployment.verified_at,
  );
  const candidateMatchesPreview = releaseMatchesPreviewBuild(candidate);
  const canaryMatchesCandidate = Boolean(
    candidate
      && candidateCanaryDeployment
      && candidateCanaryDeployment.status === "succeeded"
      && candidate.build_key.endsWith("-" + candidateCanaryDeployment.source_sha.slice(0, 12)),
  );

  useEffect(() => {
    if (!activeDeployment) return;
    let active = true;
    const client = getSupabaseClient();
    const timer = window.setInterval(() => {
      void loadPublicPwaDeployments(client, activeDeployment.id)
        .then(async (next) => {
          if (!active) return;
          setDeploymentSnapshot(next);
          const refreshed = next.deployments.find((deployment) => deployment.id === activeDeployment.id);
          if (refreshed?.status === "succeeded") {
            const releases = await adminListAppReleases(client);
            if (!active) return;
            setSnapshot(releases);
            setMessage(
              refreshed.deployment_kind === "canary"
                ? "Production Canaryへの反映が完了しました。指定テスターで確認してください。"
                : "一般公開PWAへの反映が完了しました。",
            );
          } else if (refreshed?.status === "failed") {
            setError(
              refreshed.error_message
                || (refreshed.deployment_kind === "canary"
                  ? "Production Canaryへの反映に失敗しました。内容を確認して再実行してください。"
                  : "一般公開PWAへの反映に失敗しました。内容を確認して再実行してください。"),
            );
          }
        })
        .catch(() => {
          // A temporary status refresh failure must not interrupt an in-progress deployment.
        });
    }, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [activeDeployment]);

  const togglePublishVerification = (key: PublishVerificationKey) => {
    if (!candidate) return;
    setPublishVerification((current) => {
      const next = current.includes(key) ? current.filter((item) => item !== key) : [...current, key];
      try {
        window.localStorage.setItem(publishVerificationStorageKey(candidate.id), JSON.stringify(next));
      } catch {
        // Verification remains available for this browser session.
      }
      return next;
    });
  };

  const diagnoseGithub = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    setGithubReadiness(null);
    try {
      const readiness = await checkGithubReleaseReadiness(getSupabaseClient());
      setGithubReadiness(readiness);
    } catch {
      setError("GitHub公開連携の読み取り診断に失敗しました。公開操作は開始していません。");
    } finally {
      setBusy(false);
    }
  };

  const createCandidate = async () => {
    if (busy) return;
    const version = form.version.trim();
    const title = form.title.trim();
    if (!/^\d+\.\d+\.\d+([+-][0-9A-Za-z.-]+)?$/.test(version)) {
      setError("バージョンは 1.2.3 の形式で入力してください。");
      return;
    }
    if (!title) {
      setError("アップデート名を入力してください。");
      return;
    }
    if (!IS_PREVIEW_DEPLOYMENT || !PREVIEW_BUILD_SHORT) {
      setError("管理者テスト版の登録は最新Preview PWAから行ってください。Preview Build SHAを確認できません。");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const liveBuildSha = await loadLivePreviewBuildSha();
      if (!liveBuildSha) {
        setError("現在配信中のPreview Buildを確認できませんでした。通信状態を確認して再読み込みしてください。");
        return;
      }
      if (liveBuildSha !== PREVIEW_BUILD_SHA) {
        setError(
          "この画面は古いPreview Buildです。最新Previewへ更新してから候補版を登録してください。"
          + " 現在の画面: " + PREVIEW_BUILD_SHA.slice(0, 12)
          + " / 最新: " + liveBuildSha.slice(0, 12),
        );
        return;
      }

      const next = await adminCreateAppRelease(getSupabaseClient(), {
        version,
        title,
        notes: form.notes.trim(),
        updateKind: form.updateKind,
        buildKey: "pwa-" + version.replace(/[^0-9A-Za-z.-]/g, "-") + "-" + PREVIEW_BUILD_SHORT,
      });
      setSnapshot(next);
      setForm(EMPTY_FORM);
      setMessage("管理者テスト版として登録しました。一般ユーザーにはまだ公開されていません。");
    } catch {
      setError("候補版を登録できませんでした。同じバージョンがないか確認してください。");
    } finally {
      setBusy(false);
    }
  };

  const deployCanary = async (release: AdminAppRelease) => {
    if (busy || canaryDeploymentInProgress) return;
    if (!IS_PREVIEW_DEPLOYMENT) {
      setError("Production Canaryへの反映はPreview PWAの管理者画面から実行してください。");
      return;
    }
    if (currentSessionAal !== "aal2") {
      setError("Production Canaryへの反映には管理者MFA（AAL2）での再認証が必要です。");
      return;
    }
    if (!/^[0-9a-f]{40}$/.test(PREVIEW_BUILD_SHA) || !releaseMatchesPreviewBuild(release)) {
      setError("候補版と現在のPreview Buildが一致しません。最新Previewで候補版を登録し直してください。");
      return;
    }
    if (!window.confirm(
      "v" + release.version + " をProduction Canaryへ反映しますか？\n\n"
      + "指定テスターだけがCanaryを利用できます。一般公開PWAは変更しません。\n"
      + "Build: " + PREVIEW_BUILD_SHA.slice(0, 12),
    )) return;

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const client = getSupabaseClient();
      const request = await requestCanaryPwaDeployment(client, release.id, PREVIEW_BUILD_SHA);
      const deployments = await loadPublicPwaDeployments(client, request.requestId);
      setDeploymentSnapshot(deployments);
      setMessage("Production Canaryへの反映を開始しました。完了後、指定テスターだけがCanaryを確認できます。");
    } catch (canaryError) {
      setError(canaryError instanceof Error ? canaryError.message : "Production Canaryへの反映を開始できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const confirmCanary = async () => {
    if (busy || !candidateCanaryDeployment || candidateCanaryDeployment.status !== "succeeded" || canaryVerified) return;
    if (!publishVerificationReady) {
      setError("Production Canary確認チェックをすべて完了してください。");
      return;
    }
    if (currentSessionAal !== "aal2") {
      setError("Production Canary確認の確定には管理者MFA（AAL2）での再認証が必要です。");
      return;
    }
    if (!canaryMatchesCandidate) {
      setError("Production Canaryと現在の候補版が一致しません。Canaryを作り直してください。");
      return;
    }
    if (!window.confirm(
      "AAS-000002等の指定テスターでProduction Canaryの確認が完了しましたか？\n\n"
      + "確認済みにすると、このCanaryでテストした同一artifactだけが一般公開へ昇格できます。",
    )) return;

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const client = getSupabaseClient();
      await confirmCanaryDeployment(client, candidateCanaryDeployment.id);
      const deployments = await loadPublicPwaDeployments(client);
      setDeploymentSnapshot(deployments);
      setMessage("Production Canaryを確認済みにしました。同一artifactを一般公開へ昇格できます。");
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Production Canaryを確認済みにできませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const setTester = async (aasUserId: string, enabled: boolean) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const next = await adminSetAppReleaseTester(getSupabaseClient(), aasUserId, enabled);
      setSnapshot(next);
      if (enabled) setTesterAasId("");
      setMessage(enabled ? aasUserId + " を一般ユーザーテスターに設定しました。" : aasUserId + " のテスター指定を解除しました。");
    } catch {
      setError("テスター設定を更新できませんでした。activeな一般ユーザーのAAS IDを確認してください。");
    } finally {
      setBusy(false);
    }
  };

  const publish = async (release: AdminAppRelease) => {
    if (busy || deploymentInProgress) return;
    if (!IS_PREVIEW_DEPLOYMENT) {
      setError("一般公開PWAへの反映はPreview PWAの管理者画面から実行してください。");
      return;
    }
    if (!publishVerificationReady) {
      setError("全体公開前チェックをすべて確認してください。");
      return;
    }
    if (currentSessionAal !== "aal2") {
      setError("一般公開PWAへの反映には現在の管理者セッションでMFA認証（AAL2）が必要です。管理者MFA画面で再認証してください。");
      return;
    }
    if (!/^[0-9a-f]{40}$/.test(PREVIEW_BUILD_SHA)) {
      setError("現在のPreview Build SHAを確認できません。Previewを最新化してから再度お試しください。");
      return;
    }
    if (!releaseMatchesPreviewBuild(release)) {
      setError("候補版と現在のPreview Buildが一致しません。最新Previewで新しい管理者テスト版を登録し直してください。");
      return;
    }
    if (!window.confirm(
      "v" + release.version + " の確認済みPreviewを一般公開PWAへ反映しますか？\n\n"
      + "対象: " + AAS_PREVIEW_RELEASE_BRANCH + "\n"
      + "Build: " + PREVIEW_BUILD_SHA.slice(0, 12) + "\n\n"
      + "実行後はTypecheck / Lint / 回帰テスト / Cloudflare事前確認を再実行し、すべて成功した場合だけ一般公開PWAへ反映します。",
    )) return;

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const client = getSupabaseClient();
      const request = await requestPublicPwaDeployment(client, release.id, PREVIEW_BUILD_SHA);
      const deployments = await loadPublicPwaDeployments(client, request.requestId);
      setDeploymentSnapshot(deployments);
      setMessage("一般公開PWAへの反映を開始しました。アップデート管理を開いたままにすると進捗が自動更新されます。");
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "一般公開PWAへの反映を開始できませんでした。");
    } finally {
      setBusy(false);
    }
  };

  const rollback = async (release: AdminAppRelease) => {
    if (busy || release.id === snapshot?.channel.current_release_id) return;
    if (!window.confirm("公開版を v" + release.version + " へ戻しますか？\n現在版へ更新済みのユーザーも安全のためこの版へ戻します。")) return;

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const next = await adminRollbackAppRelease(getSupabaseClient(), release.id);
      setSnapshot(next);
      setMessage("公開版をロールバックしました。");
    } catch {
      setError("ロールバックできませんでした。公開済みの過去版だけを選択できます。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="release-admin-page">
      <header className="release-admin-head">
        <div>
          <p className="eyebrow">RELEASE CONTROL</p>
          <h1>アップデート管理</h1>
          <p>コード配布は①管理者確認 → ②指定テスター確認 → ③全体公開で進め、機能単位の公開・メンテナンスは全機能管理センターで制御します。</p>
        </div>
        <nav>
          <Link href="/admin/features">全機能管理センター</Link>
          <Link href="/admin">管理ダッシュボード</Link>
          <Link href="/">ホーム</Link>
        </nav>
      </header>

      {message && <p className="route-notice">{message}</p>}
      {error && <p className="route-notice error">{error}</p>}

      <section className="admin-panel release-feature-control-link">
        <div className="admin-panel-heading">
          <div>
            <p className="eyebrow">FEATURE AVAILABILITY</p>
            <h2>機能単位の公開・メンテナンス</h2>
          </div>
          <Link className="primary-action" href="/admin/features">全機能管理センターを開く</Link>
        </div>
        <p className="trial-admin-note">この画面はアプリコードのリリースを管理します。実装済み機能を管理者のみ・指定テスター・全一般ユーザーのどこまで使用可能にするか、また一時停止するかは機能管理センターで個別に変更できます。</p>
      </section>

      <section className="release-admin-summary">
        <article>
          <span>現在の公開版</span>
          <strong>{current ? "v" + current.version : "-"}</strong>
          <small>{current?.title ?? "未設定"}</small>
        </article>
        <article>
          <span>候補版の確認段階</span>
          <strong>{candidate ? "v" + candidate.version : "なし"}</strong>
          <small>{candidate ? (snapshot?.channel.candidate_stage === "tester" ? "第2段階：指定テスター確認中" : "第1段階：管理者確認中") : "候補版を登録すると管理者だけで確認できます。"}</small>
        </article>
        <article>
          <span>更新方式</span>
          <strong>{candidate?.update_kind === "required" ? "必須" : candidate ? "任意" : "-"}</strong>
          <small>通常は任意、互換性・安全性に関わる場合のみ必須を使用します。</small>
        </article>
      </section>

      <section className="release-admin-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="eyebrow">CANDIDATE</p>
            <h2>管理者テスト版を登録</h2>
          </div>
        </div>
        <p className="trial-admin-note">
          登録した時点では一般ユーザーへは反映されません。まず管理者だけで確認し、問題がなければ第2段階として指定テスターへ反映します。第2段階を通過するまで全体公開はDB側でも禁止します。
        </p>
        <div className="admin-safety-confirm">入力順：①バージョン → ②更新名を選択 → ③ユーザー向け変更内容 → ④任意/必須を選択。登録後も、テスター確認と全体公開は別操作です。</div>

        <div className="release-admin-form">
          <label className="editor-field">
            <span>バージョン</span>
            <input
              value={form.version}
              onChange={(event) => setForm((value) => ({ ...value, version: event.target.value }))}
              placeholder="例: 0.1.1"
              autoComplete="off"
            />
          </label>
          <AdminSelectWithCustom
            label="アップデート名"
            value={form.title}
            onChange={(title) => setForm((value) => ({ ...value, title: title.slice(0, 120) }))}
            options={RELEASE_TITLE_OPTIONS}
            description="よく使う更新名から選択できます。固有の内容は「その他・自由入力」を使ってください。"
            customPlaceholder="例: 記事ライブラリ検索改善"
          />
          <label className="editor-field release-admin-notes">
            <span>ユーザーへ表示する更新内容</span>
            <textarea
              value={form.notes}
              onChange={(event) => setForm((value) => ({ ...value, notes: event.target.value }))}
              placeholder="変更点を分かりやすく入力してください。"
              maxLength={4000}
            />
          </label>
          <label className="editor-field">
            <span>更新方式</span>
            <select
              value={form.updateKind}
              onChange={(event) => setForm((value) => ({ ...value, updateKind: event.target.value as FormState["updateKind"] }))}
            >
              <option value="optional">任意アップデート</option>
              <option value="required">必須アップデート</option>
            </select>
          </label>
        </div>

        <button className="primary-action" type="button" disabled={busy} onClick={() => void createCandidate()}>
          {busy ? "処理中…" : "管理者テスト版として登録"}
        </button>
      </section>

      <section className="release-admin-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="eyebrow">TEST USERS</p>
            <h2>一般ユーザーテスター</h2>
          </div>
        </div>
        <p className="trial-admin-note">管理者権限へ変更せず、一般ユーザーのまま候補版を確認するアカウントです。現在の既定テスターは AAS-000002 です。</p>
        <div className="release-admin-form">
          <label className="editor-field">
            <span>AASユーザーID</span>
            <input value={testerAasId} onChange={(event) => setTesterAasId(event.target.value)} placeholder="AAS-000002" />
          </label>
        </div>
        <button type="button" disabled={busy || !testerAasId.trim()} onClick={() => void setTester(testerAasId.trim(), true)}>テスターに追加</button>
        <div className="release-history-list">
          {(snapshot?.testers ?? []).filter((tester) => tester.enabled).map((tester) => (
            <article key={tester.aas_user_id}>
              <div className="release-history-version"><strong>{tester.aas_user_id}</strong><span>一般ユーザー</span></div>
              <div><strong>候補版テスター</strong><small>指定更新: {formatDate(tester.updated_at)}</small></div>
              <div className="release-history-actions"><button type="button" disabled={busy} onClick={() => void setTester(tester.aas_user_id, false)}>指定解除</button></div>
            </article>
          ))}
        </div>
      </section>

      {candidate && (
        <section className="release-admin-panel candidate">
          <div>
            <p className="eyebrow">{snapshot?.channel.candidate_stage === "tester" ? "USER TEST PREVIEW" : "ADMIN PREVIEW"}</p>
            <h2>
              {snapshot?.channel.candidate_stage === "tester"
                ? `v${candidate.version} を指定テスター確認中`
                : `v${candidate.version} を管理者確認中`}
            </h2>
            <p>{candidate.title}</p>
            {candidate.notes && <pre>{candidate.notes}</pre>}
          </div>
          <div className="release-admin-publish">
            <span className={candidate.update_kind === "required" ? "required" : ""}>
              {candidate.update_kind === "required" ? "必須アップデート" : "任意アップデート"}
            </span>
            {snapshot?.channel.candidate_stage === "tester" ? (
              <button
                className="primary-action"
                type="button"
                disabled={busy || deploymentInProgress || !publishVerificationReady || currentSessionAal !== "aal2" || !IS_PREVIEW_DEPLOYMENT || !candidateMatchesPreview}
                onClick={() => void publish(candidate)}
              >
                {deploymentInProgress ? "一般公開PWAへ反映中…" : "第3段階：一般公開PWAへ反映"}
              </button>
            ) : (
              <button className="primary-action" type="button" disabled={busy || !(snapshot?.testers ?? []).some((tester) => tester.enabled)} onClick={() => void promoteToTesters(candidate)}>
                第2段階：指定テスターへ反映
              </button>
            )}
          </div>
        </section>
      )}

      {IS_PREVIEW_DEPLOYMENT && (
        <section className="release-admin-panel release-github-diagnostic">
          <div className="admin-panel-heading">
            <div>
              <p className="eyebrow">GITHUB RELEASE CONNECTION</p>
              <h2>GitHub公開連携の読み取り診断</h2>
              <p>管理者確認中・指定テスター確認中のどちらでも実行できます。公開処理やDB変更は開始しません。</p>
            </div>
          </div>
          <div className="admin-safety-confirm">
            <p>対象リポジトリと公開ワークフローへ、サーバー側の設定済みトークンでGET要求するだけの安全な診断です。</p>
            {deploymentSnapshot && !deploymentSnapshot.supportsGithubReadiness && (
              <p className="route-notice error">
                Workerの互換情報を確認できませんでした。現在のPreviewから読み取り診断を直接試せます。
              </p>
            )}
            <button type="button" disabled={busy} onClick={() => void diagnoseGithub()}>
              {busy ? "確認中…" : "GitHub公開連携を安全に確認"}
            </button>
            {githubReadiness && (
              <p role="status" className="release-github-readiness-result">
                トークン設定: {githubReadiness.configured ? "あり" : "なし"}<br />
                新リポジトリ読み取り: {githubReadiness.repositoryReadable ? "成功" : "未確認・失敗"}<br />
                公開ワークフロー読み取り: {githubReadiness.workflowReadable ? "成功" : "未確認・失敗"}<br />
                公開実行権限: 未検証（この診断ではdispatchしません）
              </p>
            )}
          </div>
        </section>
      )}

      {candidate && snapshot?.channel.candidate_stage === "tester" && (
        <section className="release-admin-panel release-publish-verification">
          <div className="admin-panel-heading">
            <div>
              <p className="eyebrow">PUBLIC RELEASE VERIFICATION</p>
              <h2>全体公開前チェック</h2>
              <p>v{candidate.version} を全一般ユーザーへ公開する前に、現在の候補版そのものを確認してください。</p>
            </div>
            <strong>{publishVerification.length} / {PUBLISH_VERIFICATION_ITEMS.length}</strong>
          </div>
          <p className="trial-admin-note">
            候補版登録: {formatDate(candidate.created_at)} / build: {candidate.build_key}。候補版が長期間残っている場合は、現在のPreview・最新HEADと同一内容か必ず再確認してください。
          </p>
          <div className="release-publish-checklist">
            {PUBLISH_VERIFICATION_ITEMS.map((item) => (
              <label key={item.key} className={publishVerification.includes(item.key) ? "checked" : ""}>
                <input
                  type="checkbox"
                  checked={publishVerification.includes(item.key)}
                  onChange={() => togglePublishVerification(item.key)}
                />
                <span><strong>{item.label}</strong><small>{item.detail}</small></span>
              </label>
            ))}
          </div>
          <p className={publishVerificationReady ? "route-notice" : "route-notice error"}>
            {publishVerificationReady
              ? "全項目を確認しました。候補版の内容を再確認してから全体公開承認へ進めます。"
              : "未確認項目があります。全項目を確認するまで全体公開ボタンは有効になりません。"}
          </p>
          <div className="admin-safety-confirm">
            <strong>一般公開PWAへの反映</strong><br />
            Preview branch: {AAS_PREVIEW_RELEASE_BRANCH}<br />
            Preview Build: {/^[0-9a-f]{40}$/.test(PREVIEW_BUILD_SHA) ? PREVIEW_BUILD_SHA.slice(0, 12) : "取得できません"}
            {candidateDeployment && (
              <>
                <br />状態: {deploymentStatusLabel(candidateDeployment.status)}
                {candidateDeployment.github_run_url && (
                  <> ・ <a href={candidateDeployment.github_run_url} target="_blank" rel="noopener noreferrer">GitHub Actionsを確認 ↗</a></>
                )}
                {candidateDeployment.error_message && <><br />エラー: {candidateDeployment.error_message}</>}
              </>
            )}
          </div>
          {!candidateMatchesPreview && (
            <p className="route-notice error">
              候補版のBuildと現在のPreview Buildが一致していません。最新Previewで新しい管理者テスト版を登録し直すと公開ボタンが有効になります。
            </p>
          )}
          {deploymentSnapshot && !deploymentSnapshot.configured && (
            <p className="route-notice error">
              管理画面からの一般公開連携は初回設定待ちです。Supabase Edge Function secret「AAS_GITHUB_RELEASE_TOKEN」を設定すると有効になります。
            </p>
          )}
          {!IS_PREVIEW_DEPLOYMENT && (
            <p className="route-notice error">一般公開PWAへの反映操作はPreview PWAでのみ有効です。</p>
          )}
          {currentSessionAal !== "aal2" && (
            <p className="route-notice error">
              {aalCheckFailed
                ? "現在の管理者セッションのMFA認証レベルを確認できません。"
                : "現在の管理者セッションはAAL2未認証です。"}
              {" "}<Link href="/admin/security">管理者MFAで再認証 →</Link>
            </p>
          )}
        </section>
      )}

      <section className="release-admin-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="eyebrow">HISTORY</p>
            <h2>リリース履歴</h2>
          </div>
        </div>

        <div className="release-history-list">
          {(snapshot?.releases ?? []).map((release) => {
            const isCurrent = release.id === snapshot?.channel.current_release_id;
            return (
              <article key={release.id} className={isCurrent ? "current" : ""}>
                <div className="release-history-version">
                  <strong>v{release.version}</strong>
                  <span>{isCurrent ? "現在の公開版" : statusLabel(release.status)}</span>
                </div>
                <div>
                  <strong>{release.title}</strong>
                  <small>{formatDate(release.published_at ?? release.created_at)} ・ 利用中 {release.adopted_users}人</small>
                  {release.notes && <p>{release.notes}</p>}
                </div>
                <div className="release-history-actions">
                  {release.status === "published" && !isCurrent && (
                    <button type="button" disabled={busy} onClick={() => void rollback(release)}>この版へ戻す</button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
