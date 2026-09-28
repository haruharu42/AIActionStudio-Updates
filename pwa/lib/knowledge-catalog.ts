import type { SupabaseClient } from "@supabase/supabase-js";

import { isKnowledgeTask, type KnowledgeKind, type KnowledgeRule, type KnowledgeTask } from "@/lib/knowledge-engine";

export type KnowledgeCandidateKind = "genre" | "subgenre";

export type KnowledgeCandidate = {
  kind: KnowledgeCandidateKind;
  parentValue: string;
  value: string;
  totalUses: number;
  distinctUsers: number;
  firstSeenAt: string;
  lastSeenAt: string;
  decisionStatus: "pending" | "approved" | "rejected";
  canonicalLabel: string;
  notes: string;
};

export type KnowledgeReviewInput = {
  kind: KnowledgeCandidateKind;
  parentValue: string;
  value: string;
  decision: "approved" | "rejected" | "pending";
  canonicalLabel?: string;
  guidance?: string[];
  deliverables?: string[];
  cautions?: string[];
  tasks?: KnowledgeTask[];
  priority?: number;
  notes?: string;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 40);
}

function asKind(value: unknown): KnowledgeKind | null {
  return value === "age" || value === "genre" || value === "subgenre" || value === "publication" || value === "task" || value === "combination" ? value : null;
}

function parseCatalogRow(row: Record<string, unknown>): KnowledgeRule | null {
  const kind = asKind(row.kind);
  const key = typeof row.key === "string" ? row.key : "";
  const label = typeof row.label === "string" ? row.label.trim() : "";
  if (!kind || !key || !label) return null;
  return {
    key,
    kind,
    label,
    parentLabel: typeof row.parent_label === "string" ? row.parent_label : null,
    aliases: asStringArray(row.aliases),
    guidance: asStringArray(row.guidance),
    deliverables: asStringArray(row.deliverables),
    cautions: asStringArray(row.cautions),
    tasks: asStringArray(row.tasks).filter((task): task is KnowledgeTask => isKnowledgeTask(task)),
    priority: typeof row.priority === "number" && Number.isFinite(row.priority) ? Math.max(0, Math.min(100, Math.trunc(row.priority))) : 50,
    source: "cloud",
    catalogVersion: typeof row.catalog_version === "number" ? Math.max(1, Math.trunc(row.catalog_version)) : Number(row.catalog_version ?? 1) || 1,
    sourceUrls: asStringArray(row.source_urls),
    sourceSummary: typeof row.source_summary === "string" ? row.source_summary : "",
    sourceCheckedAt: typeof row.source_checked_at === "string" ? row.source_checked_at : null,
  };
}

export async function loadActiveKnowledgeCatalog(client: SupabaseClient): Promise<KnowledgeRule[]> {
  // Prefer the versioned catalog, but keep a fallback so the UI remains usable
  // while an additive migration is rolling out.
  const current = await client.rpc("list_my_active_knowledge_catalog_v2");
  const response = current.error
    ? await client.rpc("list_my_active_knowledge_catalog")
    : current;
  if (response.error) throw new Error("ナレッジを読み込めませんでした。");
  return (response.data ?? [])
    .map((row: Record<string, unknown>) => parseCatalogRow(row))
    .filter((rule: KnowledgeRule | null): rule is KnowledgeRule => Boolean(rule));
}

export async function recordKnowledgeCandidate(
  client: SupabaseClient,
  input: { kind: KnowledgeCandidateKind; parentValue?: string; value: string },
): Promise<void> {
  const value = input.value.normalize("NFKC").trim().replace(/\s+/g, " ").slice(0, 120);
  const parentValue = (input.parentValue ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").slice(0, 120);
  if (!value || value === "その他" || value === "AIおまかせ") return;
  const { error } = await client.rpc("record_knowledge_candidate", {
    p_kind: input.kind,
    p_parent_value: parentValue,
    p_value: value,
  });
  if (error) throw new Error("自由入力ナレッジ候補を記録できませんでした。");
}

export async function adminListKnowledgeCandidates(
  client: SupabaseClient,
  status: "pending" | "approved" | "rejected" | null = null,
): Promise<KnowledgeCandidate[]> {
  const { data, error } = await client.rpc("admin_list_knowledge_candidates", { p_status: status });
  if (error) throw new Error("ナレッジ候補を取得できませんでした。");
  return (data ?? []).map((raw: Record<string, unknown>) => ({
    kind: raw.kind === "subgenre" ? "subgenre" : "genre",
    parentValue: typeof raw.parent_value === "string" ? raw.parent_value : "",
    value: typeof raw.value === "string" ? raw.value : "",
    totalUses: typeof raw.total_uses === "number" ? raw.total_uses : Number(raw.total_uses ?? 0),
    distinctUsers: typeof raw.distinct_users === "number" ? raw.distinct_users : Number(raw.distinct_users ?? 0),
    firstSeenAt: typeof raw.first_seen_at === "string" ? raw.first_seen_at : "",
    lastSeenAt: typeof raw.last_seen_at === "string" ? raw.last_seen_at : "",
    decisionStatus: raw.decision_status === "approved" || raw.decision_status === "rejected" ? raw.decision_status : "pending",
    canonicalLabel: typeof raw.canonical_label === "string" ? raw.canonical_label : "",
    notes: typeof raw.notes === "string" ? raw.notes : "",
  }));
}

export async function adminReviewKnowledgeCandidate(client: SupabaseClient, input: KnowledgeReviewInput): Promise<void> {
  const { error } = await client.rpc("admin_review_knowledge_candidate", {
    p_kind: input.kind,
    p_parent_value: input.parentValue,
    p_value: input.value,
    p_decision: input.decision,
    p_canonical_label: input.canonicalLabel ?? "",
    p_guidance: input.guidance ?? [],
    p_deliverables: input.deliverables ?? [],
    p_cautions: input.cautions ?? [],
    p_tasks: input.tasks ?? [],
    p_priority: Math.max(0, Math.min(100, Math.trunc(input.priority ?? 70))),
    p_notes: input.notes ?? "",
  });
  if (error) throw new Error("ナレッジ候補の審査結果を保存できませんでした。");
}
