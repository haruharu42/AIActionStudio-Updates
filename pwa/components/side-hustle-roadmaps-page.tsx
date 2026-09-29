"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useSharedAccessState } from "@/components/access-state-provider";
import {
  ROADMAP_REFERENCE_LINKS,
  SIDE_HUSTLE_ROADMAP_CATEGORIES,
  SIDE_HUSTLE_ROADMAPS,
  getSideHustleRoadmap,
  roadmapTaskKey,
} from "@/features/side-hustle-roadmaps/catalog";

type RoadmapProgress = Record<string, string[]>;

const STORAGE_PREFIX = "aas-side-hustle-roadmaps-v1";

function storageKey(userId: string): string {
  return STORAGE_PREFIX + ":" + (userId || "guest");
}

function readProgress(userId: string): RoadmapProgress {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const safe: RoadmapProgress = {};
    for (const [slug, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(value)) continue;
      safe[slug] = value.filter((item): item is string => typeof item === "string").slice(0, 500);
    }
    return safe;
  } catch {
    return {};
  }
}

function writeProgress(userId: string, progress: RoadmapProgress): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

function roadmapText(slug: string): string {
  const roadmap = getSideHustleRoadmap(slug);
  if (!roadmap) return "";
  const lines = [
    "# " + roadmap.title + " ロードマップ",
    "",
    roadmap.summary,
    "",
    "※期間は目安です。収益・案件獲得・成果を保証するものではありません。",
    "",
  ];
  for (const phase of roadmap.phases) {
    lines.push("## " + phase.window + "｜" + phase.title);
    lines.push("完了状態: " + phase.outcome);
    lines.push("");
    lines.push("行動");
    phase.tasks.forEach((task) => lines.push("- [ ] " + task));
    lines.push("");
    lines.push("確認");
    phase.checks.forEach((check) => lines.push("- " + check));
    lines.push("");
    lines.push("見る指標");
    phase.metrics.forEach((metric) => lines.push("- " + metric));
    lines.push("");
  }
  lines.push("## 公式確認先");
  roadmap.refs.forEach((key) => {
    const ref = ROADMAP_REFERENCE_LINKS[key];
    lines.push("- " + ref.label + ": " + ref.url);
  });
  return lines.join("\n");
}

export function SideHustleRoadmapsPage() {
  const { state } = useSharedAccessState();
  const userId = state.kind === "ready" ? state.profile.id : "";
  const [selectedSlug, setSelectedSlug] = useState("sidejob-planner");
  const [category, setCategory] = useState("すべて");
  const [query, setQuery] = useState("");
  const [progress, setProgress] = useState<RoadmapProgress>({});
  const [hydrated, setHydrated] = useState(false);
  const [message, setMessage] = useState("");
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    setProgress(readProgress(userId));
    setHydrated(true);
  }, [userId]);

  useEffect(() => {
    if (!hydrated) return;
    setStorageError(!writeProgress(userId, progress));
  }, [hydrated, progress, userId]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return SIDE_HUSTLE_ROADMAPS.filter((roadmap) => {
      if (category !== "すべて" && roadmap.category !== category) return false;
      if (!normalized) return true;
      return [roadmap.title, roadmap.category, roadmap.summary]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [category, query]);

  const selected = getSideHustleRoadmap(selectedSlug) ?? SIDE_HUSTLE_ROADMAPS[0];
  const completed = new Set(progress[selected.slug] ?? []);
  const taskKeys = selected.phases.flatMap((phase) =>
    phase.tasks.map((_task, index) => roadmapTaskKey(selected.slug, phase.id, index)),
  );
  const completedCount = taskKeys.filter((key) => completed.has(key)).length;
  const percent = taskKeys.length ? Math.round((completedCount / taskKeys.length) * 100) : 0;

  const toggleTask = (key: string) => {
    setProgress((current) => {
      const nextSet = new Set(current[selected.slug] ?? []);
      if (nextSet.has(key)) nextSet.delete(key);
      else nextSet.add(key);
      return { ...current, [selected.slug]: [...nextSet] };
    });
  };

  const resetSelected = () => {
    setProgress((current) => ({ ...current, [selected.slug]: [] }));
    setMessage(selected.title + " の進捗をリセットしました。");
  };

  const copyCurrent = async () => {
    try {
      await navigator.clipboard.writeText(roadmapText(selected.slug));
      setMessage(selected.title + " のロードマップをコピーしました。");
    } catch {
      setMessage("自動コピーできませんでした。");
    }
  };

  return (
    <main className="creator-page side-hustle-roadmaps-page">
      <header className="creator-head side-hustle-roadmaps-head">
        <div>
          <p className="eyebrow">SIDE-HUSTLE ROADMAPS</p>
          <h1>副業ロードマップ</h1>
          <p>
            AAS内の副業を、準備 → 最初の成果物 → 公開・受注 → 改善 → 継続運用まで、
            公式情報を確認しながら段階的に進めます。
          </p>
        </div>
        <div className="side-hustle-roadmaps-head-actions">
          <Link className="route-back" href="/tools">← 機能一覧</Link>
          <button className="secondary-action" type="button" onClick={() => void copyCurrent()}>
            ロードマップをコピー
          </button>
        </div>
      </header>

      <section className="side-hustle-roadmap-notice">
        <strong>ロードマップの使い方</strong>
        <p>
          期間は固定期限ではなく目安です。収益・案件獲得・販売数を保証せず、
          実測データと最新の公式ルールを確認して次フェーズへ進みます。
        </p>
      </section>

      <section className="side-hustle-roadmap-browser" aria-label="副業ロードマップを選ぶ">
        <div className="side-hustle-roadmap-filters">
          <label>
            <span>カテゴリ</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {SIDE_HUSTLE_ROADMAP_CATEGORIES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            <span>検索</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="例：YouTube、物販、営業"
            />
          </label>
        </div>

        <div className="side-hustle-roadmap-card-grid">
          {filtered.map((roadmap) => {
            const done = new Set(progress[roadmap.slug] ?? []);
            const total = roadmap.phases.reduce((sum, phase) => sum + phase.tasks.length, 0);
            const pct = total ? Math.round((done.size / total) * 100) : 0;
            return (
              <button
                key={roadmap.slug}
                type="button"
                className={"side-hustle-roadmap-card" + (selected.slug === roadmap.slug ? " active" : "")}
                onClick={() => {
                  setSelectedSlug(roadmap.slug);
                  setMessage("");
                }}
              >
                <span>{roadmap.category}</span>
                <strong>{roadmap.title}</strong>
                <small>{roadmap.summary}</small>
                <div className="side-hustle-roadmap-mini-progress" aria-label={"進捗 " + pct + "%"}>
                  <i style={{ width: pct + "%" }} />
                </div>
                <b>{pct}%</b>
              </button>
            );
          })}
          {!filtered.length ? <p className="route-notice">該当するロードマップがありません。</p> : null}
        </div>
      </section>

      <section className="side-hustle-roadmap-selected">
        <div className="side-hustle-roadmap-selected-head">
          <div>
            <span>{selected.category}</span>
            <h2>{selected.title}</h2>
            <p>{selected.summary}</p>
          </div>
          <div className="side-hustle-roadmap-progress-card">
            <small>進捗</small>
            <strong>{percent}%</strong>
            <span>{completedCount} / {taskKeys.length} タスク</span>
            <div><i style={{ width: percent + "%" }} /></div>
          </div>
        </div>

        <div className="side-hustle-roadmap-actions">
          <Link className="primary-action" href={selected.actionHref}>この副業の専用機能を開く →</Link>
          <button className="secondary-action" type="button" onClick={() => void copyCurrent()}>コピー</button>
          <button className="secondary-action" type="button" onClick={resetSelected}>進捗をリセット</button>
        </div>

        <div className="side-hustle-roadmap-phases">
          {selected.phases.map((phase, phaseIndex) => {
            const phaseKeys = phase.tasks.map((_task, index) => roadmapTaskKey(selected.slug, phase.id, index));
            const phaseDone = phaseKeys.filter((key) => completed.has(key)).length;
            return (
              <details key={selected.slug + ":" + phase.id} className="side-hustle-roadmap-phase" open={phaseIndex === 0}>
                <summary>
                  <span>{phase.window}</span>
                  <div>
                    <strong>{phase.title}</strong>
                    <small>{phase.outcome}</small>
                  </div>
                  <b>{phaseDone}/{phase.tasks.length}</b>
                </summary>

                <div className="side-hustle-roadmap-phase-body">
                  <section>
                    <h3>行動</h3>
                    <div className="side-hustle-roadmap-task-list">
                      {phase.tasks.map((task, index) => {
                        const key = roadmapTaskKey(selected.slug, phase.id, index);
                        return (
                          <label key={key} className={completed.has(key) ? "done" : ""}>
                            <input
                              type="checkbox"
                              checked={completed.has(key)}
                              onChange={() => toggleTask(key)}
                            />
                            <span>{task}</span>
                          </label>
                        );
                      })}
                    </div>
                  </section>

                  <section className="side-hustle-roadmap-phase-columns">
                    <div>
                      <h3>確認</h3>
                      <ul>{phase.checks.map((item) => <li key={item}>{item}</li>)}</ul>
                    </div>
                    <div>
                      <h3>見る指標</h3>
                      <ul>{phase.metrics.map((item) => <li key={item}>{item}</li>)}</ul>
                    </div>
                  </section>
                </div>
              </details>
            );
          })}
        </div>
      </section>

      <section className="side-hustle-roadmap-official">
        <div>
          <p className="eyebrow">OFFICIAL CHECKS</p>
          <h2>このロードマップで確認する公式情報</h2>
          <p>仕様・規約・税務・広告表示は変更されるため、公開・契約・申告前に最新版を確認してください。</p>
        </div>
        <div className="side-hustle-roadmap-reference-grid">
          {selected.refs.map((key) => {
            const reference = ROADMAP_REFERENCE_LINKS[key];
            return (
              <a key={key} href={reference.url} target="_blank" rel="noreferrer">
                <strong>{reference.label}</strong>
                <span>{reference.note}</span>
                <b>公式ページを確認 ↗</b>
              </a>
            );
          })}
        </div>
      </section>

      <section className="side-hustle-roadmap-global-checks">
        <h2>全副業共通の運用チェック</h2>
        <div>
          <article>
            <strong>記録</strong>
            <p>収入・必要経費・領収書・契約・確認日を後から追える形で残します。</p>
          </article>
          <article>
            <strong>契約</strong>
            <p>受託では成果物、納期、報酬、支払期日、修正、権利、検収条件を曖昧にしません。</p>
          </article>
          <article>
            <strong>表示</strong>
            <p>広告・PR・アフィリエイトでは、一般消費者に広告であることが明瞭に伝わる表示を確認します。</p>
          </article>
          <article>
            <strong>更新</strong>
            <p>価格・規約・アルゴリズム・税務・法令は固定情報として扱わず、必要な時点で公式情報を再確認します。</p>
          </article>
        </div>
      </section>

      {message ? <div className="route-notice" role="status">{message}</div> : null}
      {storageError ? (
        <div className="route-notice" role="alert">
          進捗を端末へ保存できません。必要に応じてロードマップをコピーして保管してください。
        </div>
      ) : null}
    </main>
  );
}
