"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useSharedAccessState } from "@/components/access-state-provider";
import {
  acceptAppRelease,
  appDeploymentAudience,
  loadMyAppReleaseState,
  type AppReleaseState,
} from "@/lib/app-release";

const HIDDEN_PREFIXES = ["/auth", "/invite", "/terms", "/privacy", "/ai-terms", "/commercial-transactions", "/support", "/plans"];

const PREVIEW_PWA_URL = process.env.NEXT_PUBLIC_AAS_PREVIEW_URL?.trim()
  || "https://aas-preview-ai-article-studio-pwa-preview.ai-article-studio.workers.dev/";

function hiddenRoute(pathname: string): boolean {
  return HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}

function TesterPreviewBanner() {
  return (
    <aside className="release-update-banner tester-preview-banner" aria-live="polite">
      <div>
        <span className="release-update-badge">TESTER</span>
        <strong>テスト版があります</strong>
        <small>指定テスター向けPreviewで最新候補版を確認できます。</small>
      </div>
      <div className="release-update-actions">
        <button
          type="button"
          className="primary-action"
          onClick={() => { window.location.href = PREVIEW_PWA_URL; }}
        >
          テスト版を確認
        </button>
      </div>
    </aside>
  );
}

async function activateWaitingWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;

  const registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration) return;

  try {
    await registration.update();
  } catch {
    // Release state still changes safely even when the browser cannot check SW updates.
  }

  const waiting = registration.waiting;
  if (!waiting) return;

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", finish);
      resolve();
    };
    navigator.serviceWorker.addEventListener("controllerchange", finish);
    window.setTimeout(finish, 1600);
    waiting.postMessage({ type: "AAS_ACTIVATE_RELEASE" });
  });
}

export function ReleaseUpdateManager() {
  const pathname = usePathname();
  const { state: accessState, client } = useSharedAccessState();
  const accessUserId = accessState.kind === "ready" ? accessState.profile.id : "";
  const [state, setState] = useState<AppReleaseState | null>(null);
  const [dismissedReleaseId, setDismissedReleaseId] = useState("");
  const [confirmingReleaseId, setConfirmingReleaseId] = useState("");
  const [successVersion, setSuccessVersion] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const mounted = useRef(true);

  useEffect(() => {
    try {
      const success = window.sessionStorage.getItem("aas.release.update-success");
      if (success) {
        queueMicrotask(() => setSuccessVersion(success));
        window.sessionStorage.removeItem("aas.release.update-success");
      }
    } catch {
      // Completion feedback is best-effort only.
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (hiddenRoute(pathname) || !accessUserId || !client) {
      queueMicrotask(() => {
        if (mounted.current) setState(null);
      });
      return () => { mounted.current = false; };
    }

    let refreshing = false;
    let lastRefreshAt = 0;
    const refresh = async (force = false) => {
      if (refreshing) return;
      const now = Date.now();
      if (!force && now - lastRefreshAt < 30_000) return;
      refreshing = true;
      lastRefreshAt = now;
      try {
        const next = await loadMyAppReleaseState(client);
        if (mounted.current) {
          setState(next);
          setMessage("");
        }
      } catch {
        if (mounted.current) setState(null);
      } finally {
        refreshing = false;
      }
    };

    const registerWorker = () => {
      if (!("serviceWorker" in navigator)) return;
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    };

    if (document.readyState === "complete") registerWorker();
    else window.addEventListener("load", registerWorker, { once: true });

    const refreshWhenVisible = () => {
      if (document.visibilityState === "hidden") return;
      void refresh();
    };
    const interval = window.setInterval(refreshWhenVisible, 5 * 60_000);

    void refresh(true);
    window.addEventListener("focus", refreshWhenVisible);
    window.addEventListener("online", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      mounted.current = false;
      window.clearInterval(interval);
      window.removeEventListener("load", registerWorker);
      window.removeEventListener("focus", refreshWhenVisible);
      window.removeEventListener("online", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [accessUserId, client, pathname]);

  useEffect(() => {
    const available = state?.available_release;
    if (!available) return;
    const params = new URLSearchParams(window.location.search);
    const requestedReleaseId = params.get("update");
    if (requestedReleaseId !== available.id) return;
    queueMicrotask(() => setConfirmingReleaseId(available.id));
    params.delete("update");
    const query = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (query ? "?" + query : "") + window.location.hash);
  }, [state?.available_release]);

  const applyUpdate = async () => {
    const release = state?.available_release;
    if (!release || busy || !client) return;

    setBusy(true);
    setMessage("");
    try {
      const next = await acceptAppRelease(client, release.id);
      if (mounted.current) setState(next);
      await activateWaitingWorker();
      try {
        window.sessionStorage.setItem("aas.release.update-success", release.version);
      } catch {
        // Reload still applies the release when completion feedback cannot be stored.
      }
      window.location.reload();
    } catch {
      if (mounted.current) {
        setMessage("アップデートを反映できませんでした。通信状態を確認して、もう一度お試しください。");
        setBusy(false);
      }
    }
  };

  if (hiddenRoute(pathname) || !state?.signed_in || state.active === false) {
    return successVersion ? (
      <aside className="release-update-success" role="status" aria-live="polite">
        <span aria-hidden="true">✓</span>
        <strong>v{successVersion} へアップデートしました</strong>
        <button type="button" onClick={() => setSuccessVersion("")} aria-label="閉じる">×</button>
      </aside>
    ) : null;
  }

  if ((state.is_admin_preview || state.is_tester_preview) && state.effective_release) {
    // Preview identity is shown only inside the home screen so it never covers feature pages.
    return null;
  }

  const testerPreviewAvailable =
    appDeploymentAudience() === "public"
    && state.is_release_tester === true
    && state.candidate_stage === "tester";

  const available = state.available_release;
  if (!available || dismissedReleaseId === available.id) {
    return (
      <>
        {successVersion && (
          <aside className="release-update-success" role="status" aria-live="polite">
            <span aria-hidden="true">✓</span>
            <strong>v{successVersion} へアップデートしました</strong>
            <button type="button" onClick={() => setSuccessVersion("")} aria-label="閉じる">×</button>
          </aside>
        )}
        {testerPreviewAvailable && <TesterPreviewBanner />}
      </>
    );
  }

  if (state.update_required) {
    return (
      <div className="release-required-backdrop" role="dialog" aria-modal="true" aria-labelledby="release-required-title">
        <section className="release-update-card required">
          <p className="eyebrow">REQUIRED UPDATE</p>
          <h2 id="release-required-title">重要なアップデートがあります</h2>
          <div className="release-version-row">
            <span>現在 v{state.current_release?.version ?? "-"}</span>
            <b>→</b>
            <strong>v{available.version}</strong>
          </div>
          <h3>{available.title}</h3>
          {available.notes && <p className="release-notes">{available.notes}</p>}
          <p className="release-required-note">安全性や互換性のため、この更新は適用してから利用を続けてください。</p>
          {message && <p className="route-notice error">{message}</p>}
          <button className="primary-action" type="button" disabled={busy} onClick={() => void applyUpdate()}>
            {busy ? "アップデートしています…" : "アップデートする"}
          </button>
        </section>
      </div>
    );
  }

  const confirmationOpen = confirmingReleaseId === available.id;

  return (
    <>
      {successVersion && (
        <aside className="release-update-success" role="status" aria-live="polite">
          <span aria-hidden="true">✓</span>
          <strong>v{successVersion} へアップデートしました</strong>
          <button type="button" onClick={() => setSuccessVersion("")} aria-label="閉じる">×</button>
        </aside>
      )}

      {confirmationOpen && (
        <div className="release-required-backdrop" role="dialog" aria-modal="true" aria-labelledby="release-confirm-title">
          <section className="release-update-card">
            <p className="eyebrow">UPDATE CONFIRMATION</p>
            <h2 id="release-confirm-title">アップデートしますか？</h2>
            <div className="release-version-row">
              <span>現在 v{state.current_release?.version ?? "-"}</span>
              <b>→</b>
              <strong>v{available.version}</strong>
            </div>
            <h3>{available.title}</h3>
            {available.notes && <p className="release-notes">{available.notes}</p>}
            <p className="release-confirm-note">更新後に画面を再読み込みし、最新のPWAへ切り替えます。</p>
            {message && <p className="route-notice error">{message}</p>}
            <div className="release-confirm-actions">
              <button className="primary-action" type="button" disabled={busy} onClick={() => void applyUpdate()}>
                {busy ? "アップデートしています…" : "アップデートする"}
              </button>
              <button type="button" disabled={busy} onClick={() => setConfirmingReleaseId("")}>あとで</button>
            </div>
          </section>
        </div>
      )}

      <aside className="release-update-banner" aria-live="polite">
        <div>
          <span className="release-update-badge">UPDATE</span>
          <strong>v{available.version} が利用できます</strong>
          <small>{available.title}</small>
        </div>
        <div className="release-update-actions">
          <button type="button" className="primary-action" disabled={busy} onClick={() => setConfirmingReleaseId(available.id)}>
            {busy ? "更新中…" : "アップデートする"}
          </button>
          <button type="button" disabled={busy} onClick={() => setDismissedReleaseId(available.id)}>あとで</button>
        </div>
        {message && <p className="route-notice error">{message}</p>}
      </aside>
    </>
  );
}
