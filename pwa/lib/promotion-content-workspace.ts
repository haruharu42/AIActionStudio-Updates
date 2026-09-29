import type { SupabaseClient } from "@supabase/supabase-js";

export type PromotionContentChannel = "note" | "brain" | "tips" | "x" | "threads" | "instagram";

export type PromotionContentAsset = {
  id: string;
  draftId: string;
  status: "ready";
  storageBucket: "promotion-assets";
  storagePath: string;
  originalFilename: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  sizeBytes: number;
  sortOrder: number;
  caption: string;
  createdAt: string;
  updatedAt: string;
  uploadedAt: string;
};

export type PromotionContentWorkspace = {
  draft: null | {
    id: string;
    channel: PromotionContentChannel;
    bodyMarkdown: string;
    createdAt: string;
    updatedAt: string;
  };
  assets: PromotionContentAsset[];
};

const PROMOTION_ASSET_BUCKET = "promotion-assets";
const MAX_ASSET_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

function fail(message: string): Error {
  return new Error(message);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw fail(label + "の応答形式が不正です。");
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value) throw fail(label + "の応答形式が不正です。");
  return value;
}

function integer(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw fail(label + "の応答形式が不正です。");
  return value;
}

function uuid(value: unknown, label: string): string {
  const parsed = text(value, label);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed)) {
    throw fail(label + "の応答形式が不正です。");
  }
  return parsed;
}

function timestamp(value: unknown, label: string): string {
  const parsed = text(value, label);
  if (!Number.isFinite(Date.parse(parsed))) throw fail(label + "の応答形式が不正です。");
  return parsed;
}

function parseAsset(value: unknown): PromotionContentAsset {
  const row = record(value, "プロモーション画像");
  const id = uuid(row.id, "asset.id");
  const draftId = uuid(row.draft_id, "asset.draft_id");
  const storageBucket = text(row.storage_bucket, "asset.storage_bucket");
  const storagePath = text(row.storage_path, "asset.storage_path");
  const mimeType = text(row.mime_type, "asset.mime_type");
  if (row.status !== "ready") throw fail("利用可能ではないプロモーション画像が返されました。");
  if (storageBucket !== PROMOTION_ASSET_BUCKET) throw fail("プロモーション画像の保存先が一致しません。");
  if (!ALLOWED_MIME.has(mimeType)) throw fail("プロモーション画像の形式が不正です。");
  const extension = mimeType === "image/png" ? "png" : mimeType === "image/jpeg" ? "jpg" : "webp";
  const segments = storagePath.split("/");
  if (
    segments.length !== 3 ||
    !/^[0-9a-f-]{36}$/i.test(segments[0] ?? "") ||
    segments[1] !== draftId ||
    segments[2] !== id + "." + extension
  ) {
    throw fail("プロモーション画像の保存パスが一致しません。");
  }
  const sizeBytes = integer(row.size_bytes, "asset.size_bytes");
  if (sizeBytes < 1 || sizeBytes > MAX_ASSET_BYTES) throw fail("プロモーション画像のサイズが不正です。");

  return {
    id,
    draftId,
    status: "ready",
    storageBucket: PROMOTION_ASSET_BUCKET,
    storagePath,
    originalFilename: text(row.original_filename, "asset.original_filename"),
    mimeType: mimeType as PromotionContentAsset["mimeType"],
    sizeBytes,
    sortOrder: integer(row.sort_order, "asset.sort_order"),
    caption: typeof row.caption === "string" ? row.caption : "",
    createdAt: timestamp(row.created_at, "asset.created_at"),
    updatedAt: timestamp(row.updated_at, "asset.updated_at"),
    uploadedAt: timestamp(row.uploaded_at, "asset.uploaded_at"),
  };
}

function rpcError(error: unknown, fallback: string): Error {
  const row = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const message = typeof row.message === "string" ? row.message : "";
  if (message === "storage_object_missing") return fail("画像の送信完了を確認できませんでした。通信状態を確認してもう一度お試しください。");
  if (message === "storage_object_metadata_invalid" || message === "storage_object_size_invalid" || message === "storage_object_mime_mismatch") {
    return fail("保存された画像の検証に失敗しました。画像を選び直してください。");
  }
  return fail(message || fallback);
}

function firstRow(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) {
    if (value.length !== 1) throw fail("プロモーション画像の準備応答が不正です。");
    return record(value[0], "プロモーション画像の準備");
  }
  return record(value, "プロモーション画像の準備");
}

export async function loadAdminPromotionContentWorkspace(
  client: SupabaseClient,
  channel: PromotionContentChannel,
): Promise<PromotionContentWorkspace> {
  const { data, error } = await client.rpc("admin_get_promotion_content_workspace", { p_channel: channel });
  if (error) throw rpcError(error, "AAS本体のプロモーション素材を読み込めませんでした。");
  const root = record(data, "プロモーションWorkspace");
  const rawDraft = root.draft;
  const draft = rawDraft === null || rawDraft === undefined ? null : (() => {
    const row = record(rawDraft, "プロモーション下書き");
    const storedChannel = text(row.channel, "draft.channel");
    if (storedChannel !== channel) throw fail("プロモーション下書きの媒体が一致しません。");
    return {
      id: uuid(row.id, "draft.id"),
      channel,
      bodyMarkdown: typeof row.body_markdown === "string" ? row.body_markdown : "",
      createdAt: timestamp(row.created_at, "draft.created_at"),
      updatedAt: timestamp(row.updated_at, "draft.updated_at"),
    };
  })();
  const rawAssets = root.assets;
  if (!Array.isArray(rawAssets)) throw fail("プロモーション画像一覧の応答形式が不正です。");
  const assets = rawAssets.map(parseAsset);
  if (new Set(assets.map((asset) => asset.id)).size !== assets.length) throw fail("プロモーション画像一覧に重複があります。");
  return { draft, assets };
}

export async function saveAdminPromotionContentDraft(
  client: SupabaseClient,
  channel: PromotionContentChannel,
  bodyMarkdown: string,
): Promise<string> {
  if (bodyMarkdown.length > 200000) throw fail("完成文は200,000文字以内にしてください。");
  const { data, error } = await client.rpc("admin_save_promotion_content_draft", {
    p_channel: channel,
    p_body_markdown: bodyMarkdown,
  });
  if (error) throw rpcError(error, "完成文をAAS本体へ保存できませんでした。");
  return uuid(data, "draft.id");
}

export async function uploadAdminPromotionContentAsset(
  client: SupabaseClient,
  channel: PromotionContentChannel,
  file: File,
  caption = "",
): Promise<PromotionContentAsset> {
  if (!file.name.trim() || file.name.length > 255) throw fail("画像ファイル名は255文字以内にしてください。");
  if (!ALLOWED_MIME.has(file.type)) throw fail("PNG・JPEG・WebP画像を選択してください。");
  if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > MAX_ASSET_BYTES) throw fail("画像は10MB以下にしてください。");
  if (caption.length > 1000) throw fail("画像メモは1,000文字以内にしてください。");

  const { data: preparedData, error: prepareError } = await client.rpc("admin_prepare_promotion_content_asset", {
    p_channel: channel,
    p_original_filename: file.name,
    p_mime_type: file.type,
    p_size_bytes: file.size,
    p_caption: caption,
  });
  if (prepareError) throw rpcError(prepareError, "画像保存の準備に失敗しました。");

  const prepared = firstRow(preparedData);
  const assetId = uuid(prepared.asset_id, "asset_id");
  const bucket = text(prepared.storage_bucket, "storage_bucket");
  const path = text(prepared.storage_path, "storage_path");
  if (bucket !== PROMOTION_ASSET_BUCKET) throw fail("画像保存先が一致しません。");

  let uploadError: unknown = null;
  try {
    const result = await client.storage.from(PROMOTION_ASSET_BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
      cacheControl: "3600",
    });
    uploadError = result.error;
  } catch (caught) {
    uploadError = caught;
  }

  // Even when the upload response is lost, finalize verifies the immutable
  // prepared path in Storage. Never cancel here before that verification.
  let lastFinalizeError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data, error } = await client.rpc("admin_finalize_promotion_content_asset", { p_asset_id: assetId });
    if (!error) return parseAsset(data);
    lastFinalizeError = error;
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 150));
  }

  if (uploadError) {
    throw rpcError(uploadError, "画像の送信状態を確認できませんでした。再読み込みせず管理者へ確認してください。");
  }
  throw rpcError(lastFinalizeError, "画像は送信されましたが保存確定に失敗しました。再読み込みせず管理者へ確認してください。");
}

export async function downloadAdminPromotionContentAsset(
  client: SupabaseClient,
  asset: PromotionContentAsset,
): Promise<File> {
  const { data, error } = await client.storage.from(PROMOTION_ASSET_BUCKET).download(asset.storagePath);
  if (error || !data) throw rpcError(error, "AAS本体の画像を読み込めませんでした。");
  return new File([data], asset.originalFilename, { type: asset.mimeType, lastModified: Date.now() });
}

export async function deleteAdminPromotionContentAsset(
  client: SupabaseClient,
  asset: PromotionContentAsset,
): Promise<void> {
  const { data, error: beginError } = await client.rpc("admin_begin_delete_promotion_content_asset", { p_asset_id: asset.id });
  if (beginError) throw rpcError(beginError, "画像削除の準備に失敗しました。");
  const row = record(data, "画像削除準備");
  const bucket = text(row.storage_bucket, "storage_bucket");
  const path = text(row.storage_path, "storage_path");
  if (bucket !== PROMOTION_ASSET_BUCKET || path !== asset.storagePath) throw fail("削除対象の保存先が一致しません。");

  const { error: removeError } = await client.storage.from(PROMOTION_ASSET_BUCKET).remove([path]);
  if (removeError) throw rpcError(removeError, "画像を削除できませんでした。削除待ち状態から再実行できます。");

  const { error: finalizeError } = await client.rpc("admin_finalize_delete_promotion_content_asset", { p_asset_id: asset.id });
  if (finalizeError) throw rpcError(finalizeError, "画像削除の確定に失敗しました。");
}
