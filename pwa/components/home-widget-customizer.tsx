"use client";

import { useEffect, useMemo, useState } from "react";

import { getSupabaseClient } from "@/lib/supabase";
import {
  HOME_WIDGET_LABELS,
  createDefaultHomeWidgetPreferences,
  loadHomeWidgetPreferences,
  saveHomeWidgetPreferences,
  type HomeWidgetItem,
  type HomeWidgetKey,
  type HomeWidgetPreferences,
} from "@/lib/home-widget-preferences";

type Target = "desktop" | "mobile";

function clonePreferences(value: HomeWidgetPreferences): HomeWidgetPreferences {
  return {
    desktopLayout: value.desktopLayout.map((item) => ({ ...item })),
    mobileLayout: value.mobileLayout.map((item) => ({ ...item })),
  };
}

function moveItem(layout: HomeWidgetItem[], key: HomeWidgetKey, direction: -1 | 1): HomeWidgetItem[] {
  const index = layout.findIndex((item) => item.key === key);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= layout.length) return layout;

  const next = layout.map((item) => ({ ...item }));
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function HomeWidgetCustomizer({ userId }: { userId: string }) {
  const [target, setTarget] = useState<Target>("desktop");
  const [preferences, setPreferences] = useState<HomeWidgetPreferences>(() => createDefaultHomeWidgetPreferences());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setMessage("");
    void loadHomeWidgetPreferences(getSupabaseClient(), userId).then(
      (value) => {
        if (!active) return;
        setPreferences(value);
      },
      () => {
        if (!active) return;
        setPreferences(createDefaultHomeWidgetPreferences());
        setMessage("保存済み配置を読み込めなかったため、標準配置を表示しています。");
      },
    ).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [userId]);

  const currentLayout = useMemo(
    () => target === "desktop" ? preferences.desktopLayout : preferences.mobileLayout,
    [preferences, target],
  );

  const patchCurrent = (next: HomeWidgetItem[]) => {
    setPreferences((current) => target === "desktop"
      ? { ...current, desktopLayout: next }
      : { ...current, mobileLayout: next });
  };

  const patchItem = (key: HomeWidgetKey, patch: Partial<HomeWidgetItem>) => {
    patchCurrent(currentLayout.map((item) => item.key === key ? { ...item, ...patch, key } : item));
  };

  const resetTarget = () => {
    const defaults = createDefaultHomeWidgetPreferences();
    patchCurrent(target === "desktop" ? defaults.desktopLayout : defaults.mobileLayout);
    setMessage("標準配置へ戻しました。保存すると反映されます。");
  };

  const save = async () => {
    setBusy(true);
    setMessage("");
    try {
      const saved = await saveHomeWidgetPreferences(getSupabaseClient(), userId, clonePreferences(preferences));
      setPreferences(saved);
      setMessage("ホーム画面のウィジェット配置を保存しました。");
      window.dispatchEvent(new CustomEvent("aas:home-widgets-updated", { detail: saved }));
    } catch {
      setMessage("ウィジェット配置を保存できませんでした。通信状態を確認して再度お試しください。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="home-widget-customizer" aria-labelledby="home-widget-customizer-title">
      <div className="home-widget-customizer-head">
        <div>
          <p className="eyebrow">HOME WIDGETS</p>
          <h2 id="home-widget-customizer-title">ホーム画面の配置</h2>
          <p>PCとスマホを別々に、順番・表示/非表示・横幅を変更できます。</p>
        </div>
        <div className="home-widget-target-tabs" role="tablist" aria-label="ホーム画面の対象">
          <button type="button" className={target === "desktop" ? "active" : ""} onClick={() => setTarget("desktop")}>PC</button>
          <button type="button" className={target === "mobile" ? "active" : ""} onClick={() => setTarget("mobile")}>スマホ</button>
        </div>
      </div>

      {loading ? (
        <p className="persistent-settings-status">ホーム配置を読み込んでいます…</p>
      ) : (
        <>
          <div className="home-widget-list">
            {currentLayout.map((item, index) => (
              <article className={"home-widget-row " + (item.visible ? "" : "hidden-widget")} key={item.key}>
                <span className="home-widget-drag-mark" aria-hidden="true">⋮⋮</span>
                <div className="home-widget-row-main">
                  <strong>{HOME_WIDGET_LABELS[item.key]}</strong>
                  <small>{item.visible ? "ホームに表示" : "非表示"}</small>
                </div>
                <div className="home-widget-row-actions">
                  <button type="button" aria-label={HOME_WIDGET_LABELS[item.key] + "を上へ"} disabled={index === 0} onClick={() => patchCurrent(moveItem(currentLayout, item.key, -1))}>↑</button>
                  <button type="button" aria-label={HOME_WIDGET_LABELS[item.key] + "を下へ"} disabled={index === currentLayout.length - 1} onClick={() => patchCurrent(moveItem(currentLayout, item.key, 1))}>↓</button>
                  <button
                    type="button"
                    className={"home-widget-visibility " + (item.visible ? "on" : "")}
                    role="switch"
                    aria-checked={item.visible}
                    onClick={() => patchItem(item.key, { visible: !item.visible })}
                  >
                    {item.visible ? "表示" : "非表示"}
                  </button>
                  <label>
                    <span>幅</span>
                    <select value={item.size} onChange={(event) => patchItem(item.key, { size: event.target.value === "half" ? "half" : "wide" })}>
                      <option value="wide">横幅いっぱい</option>
                      <option value="half">1/2幅</option>
                    </select>
                  </label>
                </div>
              </article>
            ))}
          </div>

          <p className="home-widget-mobile-note">
            スマホでは画面幅を優先して1列表示になります。「1/2幅」はPCや横幅に余裕がある画面で反映されます。
          </p>

          {message ? <p className="home-widget-message" role="status">{message}</p> : null}

          <div className="home-widget-customizer-actions">
            <button type="button" className="secondary-action" disabled={busy} onClick={resetTarget}>この画面を標準配置に戻す</button>
            <button type="button" className="primary-action" disabled={busy} onClick={() => void save()}>{busy ? "保存中…" : "配置を保存"}</button>
          </div>

          <small className="home-widget-cloud-note">
            配置はAASアカウントごとにクラウド保存されます。記事本文やAI回答はこの設定には保存しません。
          </small>
        </>
      )}
    </section>
  );
}
