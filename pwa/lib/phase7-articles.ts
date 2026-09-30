import type { SupabaseClient } from "@supabase/supabase-js";

import { PWA_PRODUCT_CODE } from "@/lib/phase6-access";

export const ARTICLE_ASSET_BUCKET = "article-assets";
export const ARTICLE_LIST_COLUMNS =
  "id,user_id,title,publication_target,article_type,genre,subgenre,status,price,tags,revision,created_at,updated_at";
export const ARTICLE_DETAIL_COLUMNS =
  "id,user_id,title,publication_target,article_type,genre,subgenre,body,status,price,tags,scheduled_at,published_at,published_url,revision,created_at,updated_at";
const ARTICLE_ASSET_COLUMNS =
  "id,article_id,user_id,asset_type,status,storage_bucket,storage_path,mime_type,width,height,checksum_sha256,sort_order,created_at";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLICATION_TARGET_PATTERN = /^[a-z][a-z0-9_-]{0,49}$/;

export type ArticleStatus =
  | "draft"
  | "writing"
  | "ready"
  | "waiting_publish"
  | "published"
  | "on_hold"
  | "archived";

export type ArticleType = "free" | "paid";

export type ArticleSummary = {
  id: string;
  userId: string;
  title: string;
  publicationTarget: string;
  articleType: ArticleType;
  genre: string | null;
  subgenre: string | null;
  status: ArticleStatus;
  price: number | null;
  tags: string[];
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type ArticleWorkspace = {
  articleId: string;
  userId: string;
  requestJson: Record<string, unknown>;
  workspaceJson: Record<string, unknown>;
  imagePlanJson: Record<string, unknown>;
  sourceBody: string | null;
  publishBody: string | null;
  workspaceVersion: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ArticleDetail = ArticleSummary & {
  body: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  publishedUrl: string | null;
  workspace: ArticleWorkspace;
};

export type ArticlePatch = {
  title: string;
  publication_target: string;
  article_type: ArticleType;
  genre: string | null;
  subgenre: string | null;
  body: string;
  status: ArticleStatus;
  price: number | null;
  tags: string[];
};

export type WorkspacePatch = {
  request_json: Record<string, unknown>;
  workspace_json: Record<string, unknown>;
  source_body: string | null;
  publish_body: string | null;
};

export type ArticleLibraryErrorCategory =
  | "access"
  | "conflict"
  | "not_found"
  | "validation"
  | "invalid_response"
  | "network"
  | "server";

export class ArticleLibraryError extends Error {
  readonly category: ArticleLibraryErrorCategory;
  readonly code: string;
  readonly status: number | null;

  constructor(
    message: string,
    options: {
      category: ArticleLibraryErrorCategory;
      code?: string;
      status?: number | null;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options.cause });
    this.name = "ArticleLibraryError";
    this.category = options.category;
    this.code = options.code ?? "article_library_error";
    this.status = options.status ?? null;
  }
}

type ApiError = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  status?: unknown;
};

type ArticleAsset = {
  id: string;
  articleId: string;
  userId: string;
  status: "pending_upload" | "ready" | "delete_pending";
  storageBucket: typeof ARTICLE_ASSET_BUCKET;
  storagePath: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  width: number | null;
  height: number | null;
  checksumSha256: string | null;
};

const ARTICLE_STATUSES = new Set<ArticleStatus>([
  "draft",
  "writing",
  "ready",
  "waiting_publish",
  "published",
  "on_hold",
  "archived",
]);

function record(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalidResponse(`${context}の応答形式が不正です。`);
  }
  return value as Record<string, unknown>;
}

function singleton(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  if (value.length !== 1) {
    throw invalidResponse("クラウドAPIの応答件数が不正です。");
  }
  return value[0];
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw invalidResponse(`${field}の形式が不正です。`);
  }
  return value;
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null) return null;
  return stringValue(value, field);
}

function positiveInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw invalidResponse(`${field}の形式が不正です。`);
  }
  return value;
}

function nullableNonNegativeInteger(value: unknown, field: string): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw invalidResponse(`${field}の形式が不正です。`);
  }
  return value;
}

function jsonObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalidResponse(`${field}の形式が不正です。`);
  }
  return value as Record<string, unknown>;
}

function uuid(value: unknown, field: string): string {
  const parsed = stringValue(value, field).toLowerCase();
  if (!UUID_PATTERN.test(parsed)) {
    throw invalidResponse(`${field}の形式が不正です。`);
  }
  return parsed;
}

function inputUuid(value: string, field: string): string {
  const parsed = value.trim().toLowerCase();
  if (!UUID_PATTERN.test(parsed)) {
    throw validationError(`${field}が不正です。`);
  }
  return parsed;
}

function parseStatus(value: unknown): ArticleStatus {
  const parsed = stringValue(value, "status") as ArticleStatus;
  if (!ARTICLE_STATUSES.has(parsed)) {
    throw invalidResponse("記事状態の形式が不正です。");
  }
  return parsed;
}

function parseType(value: unknown): ArticleType {
  if (value !== "free" && value !== "paid") {
    throw invalidResponse("記事種別の形式が不正です。");
  }
  return value;
}

function parseTags(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw invalidResponse("タグの形式が不正です。");
  }
  return [...value] as string[];
}

function parseSummary(value: unknown, ownerId: string): ArticleSummary {
  const row = record(value, "記事");
  const userId = uuid(row.user_id, "user_id");
  if (userId !== ownerId) {
    throw new ArticleLibraryError("記事所有者の照合に失敗しました。", {
      category: "access",
      code: "article_owner_mismatch",
    });
  }

  return {
    id: uuid(row.id, "id"),
    userId,
    title: stringValue(row.title, "title"),
    publicationTarget: stringValue(row.publication_target, "publication_target"),
    articleType: parseType(row.article_type),
    genre: nullableString(row.genre, "genre"),
    subgenre: nullableString(row.subgenre, "subgenre"),
    status: parseStatus(row.status),
    price: nullableNonNegativeInteger(row.price, "price"),
    tags: parseTags(row.tags),
    revision: positiveInteger(row.revision, "revision"),
    createdAt: stringValue(row.created_at, "created_at"),
    updatedAt: stringValue(row.updated_at, "updated_at"),
  };
}

function emptyWorkspace(articleId: string, ownerId: string): ArticleWorkspace {
  return {
    articleId,
    userId: ownerId,
    requestJson: {},
    workspaceJson: {},
    imagePlanJson: {},
    sourceBody: null,
    publishBody: null,
    workspaceVersion: 0,
    createdAt: null,
    updatedAt: null,
  };
}

function parseWorkspace(
  value: unknown,
  articleId: string,
  ownerId: string,
): ArticleWorkspace {
  const row = record(singleton(value), "Workspace");
  const parsedArticleId = uuid(row.article_id, "workspace.article_id");
  const parsedOwnerId = uuid(row.user_id, "workspace.user_id");
  if (parsedArticleId !== articleId || parsedOwnerId !== ownerId) {
    throw new ArticleLibraryError("Workspace所有者の照合に失敗しました。", {
      category: "access",
      code: "workspace_owner_mismatch",
    });
  }
  return {
    articleId: parsedArticleId,
    userId: parsedOwnerId,
    requestJson: jsonObject(row.request_json, "request_json"),
    workspaceJson: jsonObject(row.workspace_json, "workspace_json"),
    imagePlanJson: jsonObject(row.image_plan_json, "image_plan_json"),
    sourceBody: nullableString(row.source_body, "source_body"),
    publishBody: nullableString(row.publish_body, "publish_body"),
    workspaceVersion: positiveInteger(row.workspace_version, "workspace_version"),
    createdAt: nullableString(row.created_at, "workspace.created_at"),
    updatedAt: nullableString(row.updated_at, "workspace.updated_at"),
  };
}

function parseDetail(
  articleValue: unknown,
  workspaceValue: unknown | null,
  ownerId: string,
): ArticleDetail {
  const row = record(articleValue, "記事詳細");
  const summary = parseSummary(row, ownerId);
  return {
    ...summary,
    body: stringValue(row.body, "body"),
    scheduledAt: nullableString(row.scheduled_at, "scheduled_at"),
    publishedAt: nullableString(row.published_at, "published_at"),
    publishedUrl: nullableString(row.published_url, "published_url"),
    workspace:
      workspaceValue === null
        ? emptyWorkspace(summary.id, ownerId)
        : parseWorkspace(workspaceValue, summary.id, ownerId),
  };
}

export function parseAsset(
  value: unknown,
  articleId: string,
  ownerId: string,
): ArticleAsset {
  const row = record(value, "画像");
  const id = uuid(row.id, "asset.id");
  const parsedArticleId = uuid(row.article_id, "asset.article_id");
  const parsedOwnerId = uuid(row.user_id, "asset.user_id");
  if (parsedArticleId !== articleId || parsedOwnerId !== ownerId) {
    throw new ArticleLibraryError("画像所有者の照合に失敗しました。", {
      category: "access",
      code: "asset_owner_mismatch",
    });
  }
  if (
    row.status !== "pending_upload" &&
    row.status !== "ready" &&
    row.status !== "delete_pending"
  ) {
    throw invalidResponse("画像状態の形式が不正です。");
  }
  if (row.storage_bucket !== ARTICLE_ASSET_BUCKET) {
    throw invalidResponse("画像Storage bucketが不正です。");
  }
  if (
    row.mime_type !== "image/png" &&
    row.mime_type !== "image/jpeg" &&
    row.mime_type !== "image/webp"
  ) {
    throw invalidResponse("画像MIME typeが不正です。");
  }

  const extension = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
  }[row.mime_type];
  const storagePath = stringValue(row.storage_path, "storage_path");
  const expectedPath = `${ownerId}/${articleId}/${id}.${extension}`;
  if (storagePath !== expectedPath) {
    throw invalidResponse("画像Storage pathの照合に失敗しました。");
  }
  const checksum = nullableString(row.checksum_sha256, "checksum_sha256");
  if (checksum !== null && !/^[0-9a-f]{64}$/.test(checksum)) {
    throw invalidResponse("画像checksumの形式が不正です。");
  }

  return {
    id,
    articleId: parsedArticleId,
    userId: parsedOwnerId,
    status: row.status,
    storageBucket: ARTICLE_ASSET_BUCKET,
    storagePath,
    mimeType: row.mime_type,
    width: row.width === null ? null : positiveInteger(row.width, "asset.width"),
    height: row.height === null ? null : positiveInteger(row.height, "asset.height"),
    checksumSha256: checksum,
  };
}

function invalidResponse(message: string): ArticleLibraryError {
  return new ArticleLibraryError(message, {
    category: "invalid_response",
    code: "invalid_response",
  });
}

function validationError(message: string): ArticleLibraryError {
  return new ArticleLibraryError(message, {
    category: "validation",
    code: "invalid_input",
  });
}

function errorParts(error: unknown): {
  code: string;
  message: string;
  details: string;
  status: number | null;
} {
  const source = (error && typeof error === "object" ? error : {}) as ApiError;
  const code = typeof source.code === "string" ? source.code : "api_error";
  const message =
    typeof source.message === "string"
      ? source.message
      : error instanceof Error
        ? error.message
        : String(error ?? "");
  const details = typeof source.details === "string" ? source.details : "";
  const status = typeof source.status === "number" ? source.status : null;
  return { code, message, details, status };
}

function isWorkspaceMissing(error: unknown): boolean {
  const { code, message } = errorParts(error);
  return code === "P0002" || message.toLowerCase().includes("workspace not found");
}

function isStoredPendingObject(error: unknown): boolean {
  const { code, message } = errorParts(error);
  return (
    code === "P0001" &&
    (message === "storage_object_exists" || message === "storage_object_already_exists")
  );
}

export function fromApiError(error: unknown, fallback: string): ArticleLibraryError {
  if (error instanceof ArticleLibraryError) return error;
  const { code, message, details, status } = errorParts(error);
  const normalized = `${message} ${details}`.toLowerCase();
  if (normalized.includes("article_quota_exceeded")) {
    return new ArticleLibraryError(
      "記事ライブラリの保存上限に達しています。不要な記事を整理するか、利用プランを確認してください。",
      { category: "validation", code: "article_quota_exceeded", status, cause: error },
    );
  }
  if (code === "40001" || status === 409 || normalized.includes("revision conflict")) {
    return new ArticleLibraryError(
      "他の端末で記事が更新されています。入力内容は残したままです。別画面で最新状態を確認してから、もう一度編集してください。",
      { category: "conflict", code, status, cause: error },
    );
  }
  if (code === "42501" || status === 401 || status === 403) {
    return new ArticleLibraryError(
      "アカウント状態またはPWA利用権を確認できません。再ログイン後にお試しください。",
      { category: "access", code, status, cause: error },
    );
  }
  if (code === "P0002" || status === 404 || normalized.includes("not found")) {
    return new ArticleLibraryError("記事が見つかりません。一覧を更新してください。", {
      category: "not_found",
      code,
      status,
      cause: error,
    });
  }
  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("network") ||
    normalized.includes("timeout")
  ) {
    return new ArticleLibraryError(
      "通信できませんでした。接続を確認して、同じ操作をもう一度実行してください。",
      { category: "network", code, status, cause: error },
    );
  }
  return new ArticleLibraryError(fallback, {
    category: "server",
    code,
    status,
    cause: error,
  });
}

export async function requireArticleAccess(
  client: SupabaseClient,
  ownerId: string,
): Promise<void> {
  const expectedOwner = inputUuid(ownerId, "プロフィールID");
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError || !user || user.id.toLowerCase() !== expectedOwner) {
    throw new ArticleLibraryError("ログイン状態を確認できません。", {
      category: "access",
      code: "authenticated_user_mismatch",
      cause: userError,
    });
  }
  const { data, error } = await client.rpc("can_access_product", {
    p_product_code: PWA_PRODUCT_CODE,
  });
  if (error) throw fromApiError(error, "PWA利用権の確認に失敗しました。");
  if (data !== true) {
    throw new ArticleLibraryError("PWA利用権がありません。", {
      category: "access",
      code: "entitlement_denied",
      status: 403,
    });
  }
}

export async function listCloudArticles(
  client: SupabaseClient,
  ownerId: string,
  limit = 200,
): Promise<ArticleSummary[]> {
  const owner = inputUuid(ownerId, "プロフィールID");
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
    throw validationError("一覧取得件数が不正です。");
  }
  await requireArticleAccess(client, owner);
  const { data, error } = await client
    .from("articles")
    .select(ARTICLE_LIST_COLUMNS)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(limit);
  if (error) throw fromApiError(error, "記事一覧の取得に失敗しました。");
  if (!Array.isArray(data)) throw invalidResponse("記事一覧の応答形式が不正です。");
  return data.map((row) => parseSummary(row, owner));
}

export async function getCloudArticleDetail(
  client: SupabaseClient,
  ownerId: string,
  articleId: string,
): Promise<ArticleDetail> {
  const owner = inputUuid(ownerId, "プロフィールID");
  const id = inputUuid(articleId, "記事ID");
  await requireArticleAccess(client, owner);
  const { data: article, error: articleError } = await client
    .from("articles")
    .select(ARTICLE_DETAIL_COLUMNS)
    .eq("id", id)
    .single();
  if (articleError) throw fromApiError(articleError, "記事の取得に失敗しました。");

  const { data: workspace, error: workspaceError } = await client.rpc(
    "get_article_workspace",
    { p_article_id: id },
  );
  if (workspaceError && !isWorkspaceMissing(workspaceError)) {
    throw fromApiError(workspaceError, "記事Workspaceの取得に失敗しました。");
  }
  return parseDetail(article, workspaceError ? null : workspace, owner);
}

function validateArticlePatch(patch: ArticlePatch): ArticlePatch {
  const title = patch.title.trim();
  if (!title || title.length > 500) {
    throw validationError("タイトルは1〜500文字で入力してください。");
  }
  if (!PUBLICATION_TARGET_PATTERN.test(patch.publication_target)) {
    throw validationError("掲載先は英小文字から始まる英数字・_・-で入力してください。");
  }
  if (patch.article_type !== "free" && patch.article_type !== "paid") {
    throw validationError("記事種別が不正です。");
  }
  if (!ARTICLE_STATUSES.has(patch.status)) throw validationError("記事状態が不正です。");
  for (const [label, value] of [
    ["ジャンル", patch.genre],
    ["サブジャンル", patch.subgenre],
  ] as const) {
    if (value !== null && (value.trim().length < 1 || value.trim().length > 200)) {
      throw validationError(`${label}は200文字以内です。`);
    }
  }
  if (
    patch.price !== null &&
    (!Number.isSafeInteger(patch.price) || patch.price < 0)
  ) {
    throw validationError("価格は0以上の整数で入力してください。");
  }
  if (patch.article_type === "free" && patch.price !== null) {
    throw validationError("無料記事には価格を設定できません。");
  }
  if (!Array.isArray(patch.tags) || patch.tags.length > 50) {
    throw validationError("タグは50件以内です。");
  }
  if (patch.tags.some((tag) => typeof tag !== "string" || !tag.trim())) {
    throw validationError("空のタグは保存できません。");
  }
  return {
    ...patch,
    title,
    genre: patch.genre?.trim() || null,
    subgenre: patch.subgenre?.trim() || null,
    tags: [...new Set(patch.tags.map((tag) => tag.trim()))],
    price: patch.article_type === "free" ? null : patch.price,
  };
}

function validateWorkspacePatch(patch: WorkspacePatch): WorkspacePatch {
  if (
    (patch.source_body !== null && typeof patch.source_body !== "string") ||
    (patch.publish_body !== null && typeof patch.publish_body !== "string")
  ) {
    throw validationError("Workspace本文の形式が不正です。");
  }
  return {
    request_json: { ...jsonObject(patch.request_json, "request_json") },
    workspace_json: { ...jsonObject(patch.workspace_json, "workspace_json") },
    source_body: patch.source_body,
    publish_body: patch.publish_body,
  };
}

function windowsPlatform(value: string): string {
  return {
    note: "note",
    tips: "Tips",
    brain: "Brain",
    blog: "ブログ",
  }[value] ?? value;
}

function windowsStatus(value: ArticleStatus): string {
  return value === "ready" ? "完成" : value;
}

export function buildCompatibleWorkspacePatch(
  detail: ArticleDetail,
  article: ArticlePatch,
  sourceBody: string | null,
  publishBody: string | null,
): WorkspacePatch {
  return {
    request_json: {
      ...detail.workspace.requestJson,
      platform: windowsPlatform(article.publication_target),
      article_type: article.article_type === "paid" ? "有料" : "無料",
      genre: article.genre ?? "",
      subgenre: article.subgenre ?? "",
      price_jpy: article.price,
      tags: [...article.tags],
    },
    workspace_json: {
      ...detail.workspace.workspaceJson,
      local_status: windowsStatus(article.status),
      // A null value makes the Windows deserializer use articles.updated_at,
      // whose exact database timestamp is not known until this RPC returns.
      local_updated_at: null,
    },
    source_body: sourceBody,
    publish_body: publishBody,
  };
}

export async function updateCloudArticle(
  client: SupabaseClient,
  ownerId: string,
  articleId: string,
  expectedRevision: number,
  articlePatch: ArticlePatch,
  workspacePatch: WorkspacePatch,
): Promise<ArticleDetail> {
  const owner = inputUuid(ownerId, "プロフィールID");
  const id = inputUuid(articleId, "記事ID");
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
    throw validationError("記事revisionが不正です。");
  }
  const article = validateArticlePatch(articlePatch);
  const workspace = validateWorkspacePatch(workspacePatch);
  await requireArticleAccess(client, owner);
  const { data, error } = await client.rpc("update_article_with_workspace", {
    p_article_id: id,
    p_expected_revision: expectedRevision,
    p_patch: article,
    p_workspace_patch: workspace,
  });
  if (error) throw fromApiError(error, "記事の保存に失敗しました。");
  const result = record(singleton(data), "記事更新");
  return parseDetail(result.article, result.workspace, owner);
}

async function confirmRevision(
  client: SupabaseClient,
  ownerId: string,
  articleId: string,
  expectedRevision: number,
): Promise<void> {
  const { data, error } = await client
    .from("articles")
    .select("id,user_id,revision")
    .eq("id", articleId)
    .single();
  if (error) throw fromApiError(error, "削除対象の記事確認に失敗しました。");
  const row = record(data, "削除対象記事");
  if (uuid(row.id, "id") !== articleId || uuid(row.user_id, "user_id") !== ownerId) {
    throw new ArticleLibraryError("削除対象の記事所有者が一致しません。", {
      category: "access",
      code: "article_owner_mismatch",
    });
  }
  if (positiveInteger(row.revision, "revision") !== expectedRevision) {
    throw new ArticleLibraryError(
      "他の端末で記事が更新されています。一覧を更新してから削除してください。",
      { category: "conflict", code: "40001", status: 409 },
    );
  }
}

async function rpcAsset(
  client: SupabaseClient,
  functionName: string,
  assetId: string,
  fallback: string,
): Promise<unknown> {
  const { data, error } = await client.rpc(functionName, { p_asset_id: assetId });
  if (error) throw fromApiError(error, fallback);
  return data;
}

async function removeAsset(
  client: SupabaseClient,
  ownerId: string,
  articleId: string,
  original: ArticleAsset,
): Promise<void> {
  let asset = original;
  if (asset.status === "pending_upload") {
    const { error: cancelError } = await client.rpc("cancel_pending_article_asset", {
      p_asset_id: asset.id,
    });
    if (!cancelError) return;
    if (!isStoredPendingObject(cancelError)) {
      throw fromApiError(cancelError, "準備中画像の取り消しに失敗しました。");
    }
    const { data: finalized, error: finalizeError } = await client.rpc(
      "finalize_article_asset",
      {
        p_asset_id: asset.id,
        p_width: asset.width,
        p_height: asset.height,
        p_checksum_sha256: asset.checksumSha256,
      },
    );
    if (finalizeError) {
      throw fromApiError(finalizeError, "準備中画像の状態復旧に失敗しました。");
    }
    asset = parseAsset(singleton(finalized), articleId, ownerId);
  }

  if (asset.status === "ready") {
    const changed = await rpcAsset(
      client,
      "begin_delete_article_asset",
      asset.id,
      "画像の削除準備に失敗しました。",
    );
    asset = parseAsset(singleton(changed), articleId, ownerId);
  }
  if (asset.status !== "delete_pending") {
    throw invalidResponse("画像を安全な削除状態へ移行できませんでした。");
  }

  const { error: storageError } = await client.storage
    .from(asset.storageBucket)
    .remove([asset.storagePath]);
  if (storageError) {
    throw fromApiError(storageError, "Storage画像の削除に失敗しました。再実行できます。");
  }
  await rpcAsset(
    client,
    "finalize_delete_article_asset",
    asset.id,
    "画像削除の確定に失敗しました。再実行できます。",
  );
}

export async function deleteCloudArticle(
  client: SupabaseClient,
  ownerId: string,
  articleId: string,
  expectedRevision: number,
): Promise<void> {
  const owner = inputUuid(ownerId, "プロフィールID");
  const id = inputUuid(articleId, "記事ID");
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
    throw validationError("記事revisionが不正です。");
  }
  await requireArticleAccess(client, owner);
  await confirmRevision(client, owner, id, expectedRevision);

  const { data: assetRows, error: assetError } = await client
    .from("article_assets")
    .select(ARTICLE_ASSET_COLUMNS)
    .eq("article_id", id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (assetError) throw fromApiError(assetError, "記事画像の確認に失敗しました。");
  if (!Array.isArray(assetRows)) throw invalidResponse("記事画像一覧の応答形式が不正です。");

  for (const row of assetRows) {
    await removeAsset(client, owner, id, parseAsset(row, id, owner));
  }

  const { data, error } = await client.rpc("delete_article", {
    p_article_id: id,
    p_expected_revision: expectedRevision,
  });
  if (error) throw fromApiError(error, "記事の削除に失敗しました。");
  if (typeof data !== "string" || data.toLowerCase() !== id) {
    throw invalidResponse("記事削除の応答形式が不正です。");
  }
}

export function articleLibraryMessage(error: unknown): string {
  if (error instanceof ArticleLibraryError) return error.message;
  return fromApiError(error, "記事ライブラリの処理に失敗しました。").message;
}