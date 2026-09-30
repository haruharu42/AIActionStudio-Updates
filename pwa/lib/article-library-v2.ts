import type { SupabaseClient } from "@supabase/supabase-js";

import {
  fromApiError,
  requireArticleAccess,
  type ArticleDetail,
  type ArticleStatus,
  type ArticleSummary,
} from "@/lib/phase7-articles";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type NoteMagazineType = "free" | "paid" | "mixed";
export type NoteMagazineRole = "intro" | "standard" | "summary" | "bonus";

export type NoteMagazineSettings = {
  enabled: boolean;
  name: string;
  type: NoteMagazineType;
  seriesName: string;
  order: number | null;
  role: NoteMagazineRole;
};

export const EMPTY_NOTE_MAGAZINE: NoteMagazineSettings = {
  enabled: false,
  name: "",
  type: "free",
  seriesName: "",
  order: null,
  role: "standard",
};

export type ArticleLibrarySort =
  | "updated_desc"
  | "updated_asc"
  | "created_desc"
  | "created_asc"
  | "title_asc"
  | "status_asc"
  | "genre_asc"
  | "subgenre_asc"
  | "magazine_asc";

export type ArticleLibraryFilters = {
  query?: string;
  status?: ArticleStatus | "";
  publicationTarget?: string;
  articleType?: "free" | "paid" | "";
  genre?: string;
  subgenre?: string;
  magazineName?: string;
  sort?: ArticleLibrarySort;
  limit?: number;
  offset?: number;
};

export type ArticleLibraryItem = ArticleSummary & {
  magazineEnabled: boolean;
  magazineName: string | null;
  magazineType: NoteMagazineType | null;
  seriesName: string | null;
  seriesOrder: number | null;
  magazineRole: NoteMagazineRole | null;
};

export type ArticleLibraryPage = {
  items: ArticleLibraryItem[];
  totalCount: number;
  nextOffset: number;
  hasMore: boolean;
};

export type ArticleStockSummary = {
  currentArticles: number;
  maxArticles: number | null;
  remainingArticles: number | null;
  isUnlimited: boolean;
};

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label}の応答形式が不正です。`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function parseMagazineType(value: unknown): NoteMagazineType | null {
  return value === "free" || value === "paid" || value === "mixed" ? value : null;
}

function parseMagazineRole(value: unknown): NoteMagazineRole | null {
  return value === "intro" || value === "standard" || value === "summary" || value === "bonus" ? value : null;
}

function parseArticleType(value: unknown): "free" | "paid" {
  if (value === "free" || value === "paid") return value;
  throw new Error("記事種別の応答形式が不正です。");
}

function parseStatus(value: unknown): ArticleStatus {
  const statuses = new Set<ArticleStatus>([
    "draft", "writing", "ready", "waiting_publish", "published", "on_hold", "archived",
  ]);
  if (typeof value === "string" && statuses.has(value as ArticleStatus)) return value as ArticleStatus;
  throw new Error("記事状態の応答形式が不正です。");
}

function parseLibraryItem(value: unknown, ownerId: string): ArticleLibraryItem {
  const row = record(value, "記事一覧");
  const id = text(row.id).toLowerCase();
  const userId = text(row.user_id).toLowerCase();
  if (!UUID_PATTERN.test(id) || userId !== ownerId.toLowerCase()) {
    throw new Error("記事所有者の照合に失敗しました。");
  }
  if (!Array.isArray(row.tags) || row.tags.some((tag) => typeof tag !== "string")) {
    throw new Error("タグの応答形式が不正です。");
  }
  if (typeof row.revision !== "number" || !Number.isSafeInteger(row.revision) || row.revision < 1) {
    throw new Error("revisionの応答形式が不正です。");
  }
  const price = row.price === null ? null : Number(row.price);
  if (price !== null && (!Number.isSafeInteger(price) || price < 0)) {
    throw new Error("価格の応答形式が不正です。");
  }
  const order = row.series_order === null ? null : Number(row.series_order);
  if (order !== null && (!Number.isSafeInteger(order) || order < 0)) {
    throw new Error("マガジン順序の応答形式が不正です。");
  }
  return {
    id,
    userId,
    title: text(row.title),
    publicationTarget: text(row.publication_target),
    articleType: parseArticleType(row.article_type),
    genre: nullableText(row.genre),
    subgenre: nullableText(row.subgenre),
    status: parseStatus(row.status),
    price,
    tags: [...row.tags] as string[],
    revision: row.revision,
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
    magazineEnabled: row.magazine_enabled === true,
    magazineName: nullableText(row.magazine_name),
    magazineType: parseMagazineType(row.magazine_type),
    seriesName: nullableText(row.series_name),
    seriesOrder: order,
    magazineRole: parseMagazineRole(row.magazine_role),
  };
}

function cleanOptional(value: string | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function nonNegativeInteger(value: unknown, label: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`${label}の応答形式が不正です。`);
  }
  return number;
}

export async function getArticleStockSummary(
  client: SupabaseClient,
): Promise<ArticleStockSummary> {
  const { data, error } = await client.rpc("get_my_article_stock_summary");
  if (error) throw fromApiError(error, "記事ライブラリの保存上限を取得できませんでした。");
  const value = Array.isArray(data) ? data[0] : data;
  const row = record(value, "記事ライブラリ保存上限");
  const currentArticles = nonNegativeInteger(row.current_articles, "現在の記事数");
  const isUnlimited = row.is_unlimited === true;

  if (isUnlimited) {
    if (row.max_articles !== null || row.remaining_articles !== null) {
      throw new Error("無制限保存上限の応答形式が不正です。");
    }
    return {
      currentArticles,
      maxArticles: null,
      remainingArticles: null,
      isUnlimited: true,
    };
  }

  const maxArticles = nonNegativeInteger(row.max_articles, "記事保存上限");
  const remainingArticles = nonNegativeInteger(row.remaining_articles, "記事残り保存数");
  if (maxArticles < 1 || currentArticles + remainingArticles < maxArticles) {
    throw new Error("記事ライブラリ保存上限の整合性を確認できませんでした。");
  }

  return {
    currentArticles,
    maxArticles,
    remainingArticles,
    isUnlimited: false,
  };
}

export async function listArticleLibraryPage(
  client: SupabaseClient,
  ownerId: string,
  filters: ArticleLibraryFilters = {},
): Promise<ArticleLibraryPage> {
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error("一覧取得件数が不正です。");
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("一覧取得位置が不正です。");
  await requireArticleAccess(client, ownerId);
  const { data, error } = await client.rpc("list_article_library_v2", {
    p_limit: limit,
    p_offset: offset,
    p_query: cleanOptional(filters.query),
    p_status: cleanOptional(filters.status),
    p_publication_target: cleanOptional(filters.publicationTarget),
    p_article_type: cleanOptional(filters.articleType),
    p_genre: cleanOptional(filters.genre),
    p_subgenre: cleanOptional(filters.subgenre),
    p_magazine_name: cleanOptional(filters.magazineName),
    p_sort: filters.sort ?? "updated_desc",
  });
  if (error) throw fromApiError(error, "記事ライブラリの取得に失敗しました。");
  if (!Array.isArray(data)) throw new Error("記事ライブラリの応答形式が不正です。");
  const items = data.map((row) => parseLibraryItem(row, ownerId));
  const first = data[0] && record(data[0], "記事一覧");
  const totalCount = first ? Number(first.total_count) : 0;
  if (!Number.isSafeInteger(totalCount) || totalCount < 0) throw new Error("記事件数の応答形式が不正です。");
  const nextOffset = offset + items.length;
  return { items, totalCount, nextOffset, hasMore: nextOffset < totalCount };
}

export function noteMagazineFromWorkspace(workspaceJson: Record<string, unknown>): NoteMagazineSettings {
  const rawValue = workspaceJson.pwa_note_magazine;
  const raw = rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)
    ? rawValue as Record<string, unknown>
    : {};
  const type = parseMagazineType(raw.type) ?? "free";
  const role = parseMagazineRole(raw.role) ?? "standard";
  const orderValue = typeof raw.order === "number" && Number.isSafeInteger(raw.order) && raw.order >= 0 ? raw.order : null;
  return {
    enabled: raw.enabled === true,
    name: text(raw.name),
    type,
    seriesName: text(raw.series_name),
    order: orderValue,
    role,
  };
}

export function withNoteMagazineWorkspace(
  workspaceJson: Record<string, unknown>,
  settings: NoteMagazineSettings,
): Record<string, unknown> {
  const name = settings.name.trim();
  const seriesName = settings.seriesName.trim();
  if (settings.enabled && !name) throw new Error("マガジンをONにする場合はマガジン名を入力してください。");
  if (name.length > 200 || seriesName.length > 200) throw new Error("マガジン名・シリーズ名は200文字以内です。");
  if (settings.order !== null && (!Number.isSafeInteger(settings.order) || settings.order < 0 || settings.order > 9999)) {
    throw new Error("マガジン内の順番は0〜9999で入力してください。");
  }
  return {
    ...workspaceJson,
    pwa_note_magazine: {
      enabled: settings.enabled,
      name,
      type: settings.type,
      series_name: seriesName,
      order: settings.order,
      role: settings.role,
    },
  };
}

export async function duplicateCloudArticle(
  client: SupabaseClient,
  ownerId: string,
  detail: ArticleDetail,
): Promise<string> {
  await requireArticleAccess(client, ownerId);
  const magazine = noteMagazineFromWorkspace(detail.workspace.workspaceJson);
  const duplicatedMagazine = { ...magazine, order: null };
  const workspaceJson = withNoteMagazineWorkspace(
    { ...detail.workspace.workspaceJson, local_status: "draft", local_updated_at: null },
    duplicatedMagazine,
  );
  const { data, error } = await client.rpc("create_article_with_workspace", {
    p_article: {
      title: `${detail.title || "無題の記事"}（コピー）`.slice(0, 500),
      publication_target: detail.publicationTarget,
      article_type: detail.articleType,
      genre: detail.genre,
      subgenre: detail.subgenre,
      body: detail.body,
      status: "draft",
      price: detail.price,
      tags: detail.tags,
    },
    p_workspace: {
      request_json: { ...detail.workspace.requestJson },
      workspace_json: workspaceJson,
      image_plan_json: { ...detail.workspace.imagePlanJson },
      source_body: detail.workspace.sourceBody,
      publish_body: detail.workspace.publishBody,
    },
  });
  if (error) throw fromApiError(error, "記事の複製に失敗しました。");
  const result = record(Array.isArray(data) ? data[0] : data, "記事複製");
  const article = record(result.article, "複製記事");
  const id = text(article.id).toLowerCase();
  if (!UUID_PATTERN.test(id) || text(article.user_id).toLowerCase() !== ownerId.toLowerCase()) {
    throw new Error("複製記事の所有者確認に失敗しました。");
  }
  return id;
}
