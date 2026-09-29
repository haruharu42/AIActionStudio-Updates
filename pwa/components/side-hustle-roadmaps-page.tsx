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
  type SideHustleRoadmapDefinition,
} from "@/features/side-hustle-roadmaps/catalog";

const STORAGE_PREFIX = "aas-side-hustle-roadmaps-v1";

type SavedRoadmapProgress = {
  selectedSlug?: string;
  completed?: string[];
};

function roadmapTaskCount(roadmap: SideHustleRoadmapDefinition): number {
  return roadmap.phases.reduce((total, phase) => total + phase.tasks.length, 0);
}

function roadmapCompletedCount(roadmap: SideHustleRoadmapDefinition, completed: ReadonlySet<string>): number {
  return roadmap.phases.reduce(
    (total, phase) => total + phase.tasks.filter((_, taskIndex) =>
      completed.has(roadmapTaskKey(roadmap.slug, phase.id, taskIndex)),
    ).length,
    0,
  );
}

function percent(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

export function SideHustleRoadmapsPage() {
  const { state } = useSharedAccessState();
  const userId = state.kind === "ready" ? state.profile.id : "guest";
  const storageKey = STORAGE_PREFIX + ":" + userId;

  const [category, setCategory] = useState<string>("すべて");
  const [query, setQuery] = useState("");
  const [selectedSlug, setSelectedSlug] = useState(SIDE_HUSTLE_ROADMAPS[0]?.slug ?? "");
  const [completed, setCompleted] = useState<Set<string>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let nextSelected = SIDE_HUSTLE_ROADMAPS[0]?.slug ?? "";
    let nextCompleted = new Set<string>();
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedRoadmapProgress;
        if (parsed.selectedSlug && getSideHustleRoadmap(parsed.selectedSlug)) {
          nextSelected = parsed.selectedSlug;
        }
        if (Array.isArray(parsed.completed)) {
          nextCompleted = new Set(parsed.completed.filter((value): value is string => typeof value === "string"));
        }
      }
    } catch {
      // Keep safe defaults when stored progress is unavailable or corrupted.
    }
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setSelectedSlug(nextSelected);
      setCompleted(nextCompleted);
      setHydrated(true);
    });
    return () => { active = false; };
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const payload: SavedRoadmapProgress = {
        selectedSlug,
        completed: Array.from(completed),
      };
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // Progress remains usable in memory when storage is unavailable.
    }
  }, [completed, hydrated, selectedSlug, storageKey]);

  const filteredRoadmaps = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ja-JP");
    return SIDE_HUSTLE_ROADMAPS.filter((roadmap) => {
      const categoryMatch = category === "すべて" || roadmap.category === category;
      const queryMatch = !needle || [roadmap.title, roadmap.category, roadmap.summary]
        .some((value) => value.toLocaleLowerCase("ja-JP").includes(needle));
      return categoryMatch && queryMatch;
    });
  }, [category, query]);

  const selected = getSideHustleRoadmap(selectedSlug) ?? SIDE_HUSTLE_ROADMAPS[0];
  if (!selected) return null;

  const selectedTotal = roadmapTaskCount(selected);
  const selectedDone = roadmapCompletedCount(selected, completed);
  const selectedPercent = percent(selectedDone, selectedTotal);
  const nextTasks = selected.phases
    .flatMap((phase) => phase.tasks.map((task, taskIndex) => ({
      key: roadmapTaskKey(selected.slug, phase.id, taskIndex),
      phaseTitle: phase.title,
      window: phase.window,
      task,
    })))
    .filter((item) => !completed.has(item.key))
    .slice(0, 3);

  const allTotal = SIDE_HUSTLE_ROADMAPS.reduce((total, roadmap) => total + roadmapTaskCount(roadmap), 0);
  const allDone = SIDE_HUSTLE_ROADMAPS.reduce(
    (total, roadmap) => total + roadmapCompletedCount(roadmap, completed),
    0,
  );

  const toggleTask = (key: string) => {
    setCompleted((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const resetSelected = () => {
    if (!window.confirm("この副業ロードマップのチェックだけをリセットしますか？")) return;
    setCompleted((current) => {
      const next = new Set(current);
      for (const phase of selected.phases) {
        phase.tasks.forEach((_, taskIndex) => next.delete(roadmapTaskKey(selected.slug, phase.id, taskIndex)));
      }
      return next;
    });
    setMessage(selected.title + " の進捗をリセットしました。");
  };

  const copyNextActions = async () => {
    if (!nextTasks.length) {
      setMessage("この副業のロードマップはすべて完了しています。");
      return;
    }
    const lines = [
      "【AAS 次にやる3つ】",
      "副業: " + selected.title,
      "",
      ...nextTasks.map((item, index) =>
        (index + 1) + ". [" + item.window + "｜" + item.phaseTitle + "] " + item.task,
      ),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setMessage("次にやることをコピーしました。");
    } catch {
      setMessage("次にやることをコピーできませんでした。");
    }
  };

  const copyProgress = async () => {
    const lines = [
      "【AAS 副業ロードマップ進捗】",
      "副業: " + selected.title,
      "進捗: " + selectedDone + "/" + selectedTotal + " (" + selectedPercent + "%)",
      "",
      ...selected.phases.flatMap((phase) => {
        const phaseDone = phase.tasks.filter((_, taskIndex) =>
          completed.has(roadmapTaskKey(selected.slug, phase.id, taskIndex)),
        ).length;
        return [
          "■ " + phase.window + "｜" + phase.title + " " + phaseDone + "/" + phase.tasks.length,
          ...phase.tasks.map((task, taskIndex) =>
            (completed.has(roadmapTaskKey(selected.slug, phase.id, taskIndex)) ? "☑ " : "☐ ") + task,
          ),
        ];
      }),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setMessage("現在のロードマップ進捗をコピーしました。");
    } catch {
      setMessage("進捗をコピーできませんでした。");
    }
  };

  return (
    <main className="creator-page side-hustle-roadmaps-page">
      <header className="creator-head side-hustle-roadmaps-head">
        <div>
          <p className="eyebrow">SIDE-HUSTLE ROADMAPS</p>
          <h1>副業ロードマップ</h1>
          <p>
            AASの副業を、準備から最初の公開・受注・販売、改善、継続運用まで5フェーズで進めます。
            収益保証ではなく、実際に確認できる行動・完了条件・指標を基準にしています。
          </p>
        </div>
        <div className="side-hustle-roadmaps-head-actions">
          <Link className="route-back" href="/tools">← 機能一覧</Link>
          <Link className="secondary-action" href="/side-hustles/sidejob-planner">AI副業プランナー</Link>
        </div>
      </header>

      <section className="side-hustle-roadmap-notice" aria-label="ロードマップ利用上の注意">
        <strong>14副業・70フェーズ・210タスクを収録</strong>
        <p>
          期間は目安です。売上・案件獲得・再生数などを保証するものではありません。
          税務、契約、広告表示、媒体規約、価格・手数料など更新される情報は、各ロードマップの公式ページを確認してください。
          全体進捗: {allDone}/{allTotal}（{percent(allDone, allTotal)}%）
        </p>
      </section>

      <section className="side-hustle-roadmap-browser" aria-label="副業ロードマップを選ぶ">
        <div className="side-hustle-roadmap-filters">
          <label>
            <span>カテゴリ</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {SIDE_HUSTLE_ROADMAP_CATEGORIES.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            <span>検索</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="例：アフィリエイト、動画、受託、note"
              type="search"
            />
          </label>
        </div>

        <div className="side-hustle-roadmap-card-grid">
          {filteredRoadmaps.map((roadmap) => {
            const total = roadmapTaskCount(roadmap);
            const done = roadmapCompletedCount(roadmap, completed);
            const progress = percent(done, total);
            return (
              <button
                key={roadmap.slug}
                type="button"
                className={"side-hustle-roadmap-card " + (roadmap.slug === selected.slug ? "active" : "")}
                onClick={() => {
                  setSelectedSlug(roadmap.slug);
                  setMessage("");
                }}
              >
                <span>{roadmap.category}</span>
                <strong>{roadmap.title}</strong>
                <small>{roadmap.summary}</small>
                <div className="side-hustle-roadmap-mini-progress" aria-label={roadmap.title + " 進捗 " + progress + "%"}>
                  <i style={{ width: progress + "%" }} />
                </div>
                <b>{done}/{total} · {progress}%</b>
              </button>
            );
          })}
        </div>
      </section>

      <section className="side-hustle-roadmap-selected" aria-labelledby="selected-roadmap-title">
        <div className="side-hustle-roadmap-selected-head">
          <div>
            <span>{selected.category}</span>
            <h2 id="selected-roadmap-title">{selected.title}</h2>
            <p>{selected.summary}</p>
          </div>
          <div className="side-hustle-roadmap-progress-card">
            <small>現在の進捗</small>
            <strong>{selectedPercent}%</strong>
            <span>{selectedDone}/{selectedTotal} タスク完了</span>
            <div><i style={{ width: selectedPercent + "%" }} /></div>
          </div>
        </div>

        <div className="side-hustle-roadmap-actions">
          <Link className="primary-action" href={selected.actionHref}>この副業の専用機能を開く →</Link>
          <button className="secondary-action" type="button" onClick={() => void copyProgress()}>進捗をコピー</button>
          <button className="secondary-action" type="button" onClick={resetSelected}>この副業だけリセット</button>
        </div>

        <section className="side-hustle-roadmap-focus" aria-labelledby="roadmap-next-actions-title">
          <div className="side-hustle-roadmap-focus-head">
            <div>
              <p className="eyebrow">NEXT ACTIONS</p>
              <h3 id="roadmap-next-actions-title">{nextTasks.length ? "次にやる3つ" : "このロードマップは完了です"}</h3>
              <p>{nextTasks.length ? "未完了タスクの中から、前のフェーズを優先して自動表示します。" : "必要に応じて進捗を見直すか、次の副業ロードマップへ進めます。"}</p>
            </div>
            {nextTasks.length > 0 && (
              <button className="secondary-action" type="button" onClick={() => void copyNextActions()}>
                次にやる3つをコピー
              </button>
            )}
          </div>
          {nextTasks.length > 0 && (
            <div className="side-hustle-roadmap-focus-list">
              {nextTasks.map((item, index) => (
                <label key={item.key}>
                  <input type="checkbox" checked={false} onChange={() => toggleTask(item.key)} />
                  <span>
                    <small>{index + 1} · {item.window}｜{item.phaseTitle}</small>
                    <strong>{item.task}</strong>
                  </span>
                </label>
              ))}
            </div>
          )}
        </section>

        <div className="side-hustle-roadmap-phases">
          {selected.phases.map((phase, phaseIndex) => {
            const phaseDone = phase.tasks.filter((_, taskIndex) =>
              completed.has(roadmapTaskKey(selected.slug, phase.id, taskIndex)),
            ).length;
            return (
              <details className="side-hustle-roadmap-phase" key={phase.id} open={phaseIndex === 0 && phaseDone < phase.tasks.length}>
                <summary>
                  <span>{phase.window}</span>
                  <div>
                    <strong>{phase.title}</strong>
                    <small>{phase.outcome}</small>
                  </div>
                  <b>{phaseDone}/{phase.tasks.length}</b>
                </summary>
                <div className="side-hustle-roadmap-phase-body">
                  <div>
                    <h3>実行タスク</h3>
                    <div className="side-hustle-roadmap-task-list">
                      {phase.tasks.map((task, taskIndex) => {
                        const key = roadmapTaskKey(selected.slug, phase.id, taskIndex);
                        const done = completed.has(key);
                        return (
                          <label key={key} className={done ? "done" : ""}>
                            <input type="checkbox" checked={done} onChange={() => toggleTask(key)} />
                            <span>{task}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="side-hustle-roadmap-phase-columns">
                    <div>
                      <h3>完了前チェック</h3>
                      <ul>{phase.checks.map((check) => <li key={check}>{check}</li>)}</ul>
                    </div>
                    <div>
                      <h3>見る指標</h3>
                      <ul>{phase.metrics.map((metric) => <li key={metric}>{metric}</li>)}</ul>
                    </div>
                  </div>
                </div>
              </details>
            );
          })}
        </div>

        {message && <div className="route-notice" role="status">{message}</div>}
      </section>

      <section className="side-hustle-roadmap-official" aria-labelledby="roadmap-official-title">
        <div>
          <p className="eyebrow">OFFICIAL CHECK</p>
          <h2 id="roadmap-official-title">公式ページを確認</h2>
          <p>この副業で変わりやすい条件・規約・法律・媒体仕様は、公開・契約・販売前に公式情報で再確認してください。</p>
        </div>
        <div className="side-hustle-roadmap-reference-grid">
          {selected.refs.map((referenceKey) => {
            const reference = ROADMAP_REFERENCE_LINKS[referenceKey];
            return (
              <a key={referenceKey} href={reference.url} target="_blank" rel="noreferrer">
                <strong>{reference.label}</strong>
                <span>{reference.note}</span>
                <b>公式ページを確認 ↗</b>
              </a>
            );
          })}
        </div>
      </section>

      <section className="side-hustle-roadmap-global-checks" aria-labelledby="roadmap-global-title">
        <p className="eyebrow">COMMON OPERATIONS</p>
        <h2 id="roadmap-global-title">全副業共通の運用チェック</h2>
        <div>
          <article><strong>最新情報</strong><p>価格、手数料、規約、アルゴリズム、法令を固定値として扱わず、重要な実行前に公式確認します。</p></article>
          <article><strong>記録</strong><p>売上だけでなく、経費、作業時間、公開日、契約条件、確認日、変更履歴も残します。</p></article>
          <article><strong>事実と実績</strong><p>未確認の体験、売上、レビュー、案件数、成功率を作らず、例や仮定は明確に分けます。</p></article>
          <article><strong>継続判断</strong><p>短期結果だけでなく、再現性、負荷、学び、資産化、安全性を月次で確認します。</p></article>
        </div>
      </section>
    </main>
  );
}
