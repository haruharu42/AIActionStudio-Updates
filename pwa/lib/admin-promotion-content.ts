import type { SupabaseClient } from "@supabase/supabase-js";

import type { AdminPromotionChannel } from "@/lib/admin-promotion-channel";

export type PromotionContentDraft = {
  id: string;
  channel: AdminPromotionChannel;
  bodyMarkdown: string;
  createdAt: string;
  updatedAt: string;
};

export type PromotionContentAsset = {
  id: string;
  draftId: string;
  status: "ready";
  storageBucket: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  sortOrder: number;
  caption: string;
  createdAt: string;
  updatedAt: string;
  uploadedAt: string;
};

export type PromotionContentWorkspace = {
  draft: PromotionContentDraft | null;
  assets: PromotionContentAsset[];
};

type JsonRecord = Record<string, unknown>;

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function object(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("販売プロモーション保存データの形式が不正です。");
  }
  return value as JsonRecord;
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`${field} の形式が不正です。`);
  return value;
}

function integer(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) throw new Error(`${field} の形式が不正です。`);
  return value;
}

function parseAsset(value: unknown): PromotionContentAsset {
  const row = object(value);
  const status = text(row.status, "status");
  if (status !== "ready") throw new Error("画像の保存状態が不正です。");
  return {
    id: text(row.id, "id"),
    draftId: text(row.draft_id, "draft_id"),
    status,
    storageBucket: text(row.storage_bucket, "storage_bucket"),
    storagePath: text(row.storage_path, "storage_path"),
    originalFilename: text(row.original_filename, "original_filename"),
    mimeType: text(row.mime_type, "mime_type"),
    sizeBytes: integer(row.size_bytes, "size_bytes"),
    sortOrder: integer(row.sort_order, "sort_order"),
    caption: text(row.caption ?? "", "caption"),
    createdAt: text(row.created_at, "created_at"),
    updatedAt: text(row.updated_at, "updated_at"),
    uploadedAt: text(row.uploaded_at, "uploaded_at"),
  };
}

function parseWorkspace(value: unknown): PromotionContentWorkspace {
  const root = object(value);
  let draft: PromotionContentDraft | null = null;
  if (root.draft !== null && root.draft !== undefined) {
    const row = object(root.draft);
    draft = {
      id: text(row.id, "id"),
      channel: text(row.channel, "channel") as AdminPromotionChannel,
      bodyMarkdown: text(row.body_markdown ?? "", "body_markdown"),
      createdAt: text(row.created_at, "created_at"),
      updatedAt: text(row.updated_at, "updated_at"),
    };
  }

  const assets = Array.isArray(root.assets) ? root.assets.map(parseAsset) : [];
  return { draft, assets };
}

function friendlyError(error: { message?: string } | null, fallback: string): Error {
  const message = error?.message ?? "";
  if (message.includes("active admin required")) return new Error("active管理者のみ利用できます。");
  if (message.includes("promotion draft too long")) return new Error("完成原稿が長すぎます。20万文字以内にしてください。");
  if (message.includes("invalid promotion image type")) return new Error("PNG・JPEG・WebP画像だけ保存できます。");
  if (message.includes("invalid promotion image size")) return new Error("画像は1枚10MB以内にしてください。");
  return new Error(message || fallback);
}

export function promotionScreenshotMarker(assetId: string): string {
  return `<!-- PROMO_SCREENSHOT:${assetId} -->`;
}

export async function loadPromotionContentWorkspace(
  client: SupabaseClient,
  channel: AdminPromotionChannel,
): Promise<PromotionContentWorkspace> {
  const { data, error } = await client.rpc("admin_get_promotion_content_workspace", { p_channel: channel });
  if (error) throw friendlyError(error, "販売プロモーション原稿を読み込めませんでした。");
  return parseWorkspace(data);
}

export async function savePromotionContentDraft(
  client: SupabaseClient,
  channel: AdminPromotionChannel,
  bodyMarkdown: string,
): Promise<string> {
  const { data, error } = await client.rpc("admin_save_promotion_content_draft", {
    p_channel: channel,
    p_body_markdown: bodyMarkdown,
  });
  if (error) throw friendlyError(error, "販売プロモーション原稿を保存できませんでした。");
  if (typeof data !== "string") throw new Error("販売プロモーション原稿の保存結果が不正です。");
  return data;
}

export async function uploadPromotionScreenshot(
  client: SupabaseClient,
  channel: AdminPromotionChannel,
  file: File,
  caption = "",
): Promise<PromotionContentAsset> {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error("PNG・JPEG・WebP画像だけ保存できます。");
  }
  if (file.size < 1 || file.size > MAX_IMAGE_BYTES) {
    throw new Error("画像は1枚10MB以内にしてください。");
  }

  const prepared = await client.rpc("admin_prepare_promotion_content_asset", {
    p_channel: channel,
    p_original_filename: file.name || "screenshot",
    p_mime_type: file.type,
    p_size_bytes: file.size,
    p_caption: caption,
  });
  if (prepared.error) throw friendlyError(prepared.error, "スクリーンショット保存の準備に失敗しました。");

  const rawPrepared = Array.isArray(prepared.data) ? prepared.data[0] : prepared.data;
  const row = object(rawPrepared);
  const assetId = text(row.asset_id, "asset_id");
  const bucket = text(row.storage_bucket, "storage_bucket");
  const storagePath = text(row.storage_path, "storage_path");

  const uploaded = await client.storage.from(bucket).upload(storagePath, file, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false,
  });

  if (uploaded.error) {
    await client.rpc("admin_cancel_pending_promotion_content_asset", { p_asset_id: assetId });
    throw new Error(uploaded.error.message || "スクリーンショット本体を保存できませんでした。");
  }

  const finalized = await client.rpc("admin_finalize_promotion_content_asset", { p_asset_id: assetId });
  if (finalized.error) {
    throw friendlyError(finalized.error, "スクリーンショット保存の確定に失敗しました。");
  }

  return parseAsset(finalized.data);
}

export async function updatePromotionScreenshot(
  client: SupabaseClient,
  assetId: string,
  caption: string,
  sortOrder: number,
): Promise<void> {
  const { error } = await client.rpc("admin_update_promotion_content_asset", {
    p_asset_id: assetId,
    p_caption: caption,
    p_sort_order: sortOrder,
  });
  if (error) throw friendlyError(error, "スクリーンショット情報を更新できませんでした。");
}

export async function deletePromotionScreenshot(
  client: SupabaseClient,
  asset: PromotionContentAsset,
): Promise<void> {
  const begun = await client.rpc("admin_begin_delete_promotion_content_asset", { p_asset_id: asset.id });
  if (begun.error) throw friendlyError(begun.error, "スクリーンショット削除を開始できませんでした。");

  const removed = await client.storage.from(asset.storageBucket).remove([asset.storagePath]);
  if (removed.error) {
    throw new Error(removed.error.message || "スクリーンショット本体を削除できませんでした。");
  }

  const finalized = await client.rpc("admin_finalize_delete_promotion_content_asset", { p_asset_id: asset.id });
  if (finalized.error) throw friendlyError(finalized.error, "スクリーンショット削除を確定できませんでした。");
}

export async function downloadPromotionScreenshot(
  client: SupabaseClient,
  asset: PromotionContentAsset,
): Promise<Blob> {
  const { data, error } = await client.storage.from(asset.storageBucket).download(asset.storagePath);
  if (error || !data) throw new Error(error?.message || "スクリーンショットを読み込めませんでした。");
  return data;
}
