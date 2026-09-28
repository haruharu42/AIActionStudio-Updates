import { publicationBodyForCopy, type PublicationBodyOptions } from "@/lib/phase11-create";

export type NotePostSequenceItem =
  | { kind: "body"; id: string; markdown: string }
  | { kind: "inline-image"; id: string; order: number };

const INLINE_MARKER = /^\s*(?:\*\*)?【挿絵(\d+)をここに挿入】(?:\*\*)?\s*$/gim;

export type NotePostImagePlanMetadata = {
  inlineEnabled?: boolean;
  inlineCount?: number;
  suggestedFilenames: Record<string, string>;
};

function metadataRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function readNotePostImagePlanMetadata(value: Record<string, unknown>): NotePostImagePlanMetadata {
  const inline = metadataRecord(value.inline);
  const inlineEnabled = typeof inline?.enabled === "boolean" ? inline.enabled : undefined;
  const inlineCount = typeof inline?.count === "number" && Number.isSafeInteger(inline.count)
    ? Math.max(0, Math.trunc(inline.count))
    : undefined;
  const suggestedFilenames: Record<string, string> = {};

  const promptPlan = Array.isArray(value.prompt_plan) ? value.prompt_plan : [];
  for (const entry of promptPlan) {
    const item = metadataRecord(entry);
    if (!item) continue;
    const kind = item.kind;
    const order = item.order;
    const suggestedFilename = item.suggestedFilename;
    if ((kind !== "cover" && kind !== "inline")
      || typeof order !== "number"
      || !Number.isSafeInteger(order)
      || typeof suggestedFilename !== "string"
      || !suggestedFilename.trim()) {
      continue;
    }
    suggestedFilenames[`${kind}-${order}`] = suggestedFilename.trim();
  }

  return { inlineEnabled, inlineCount, suggestedFilenames };
}

export function buildNotePostSequence(body: string, title: string, options?: PublicationBodyOptions): NotePostSequenceItem[] {
  const publicationBody = publicationBodyForCopy(body, title, options);
  if (!publicationBody) return [];

  const sequence: NotePostSequenceItem[] = [];
  let cursor = 0;
  let bodyIndex = 1;

  for (const match of publicationBody.matchAll(INLINE_MARKER)) {
    const index = match.index ?? 0;
    const before = publicationBody.slice(cursor, index).trim();
    if (before) {
      sequence.push({ kind: "body", id: `body-${bodyIndex}`, markdown: before });
      bodyIndex += 1;
    }
    sequence.push({
      kind: "inline-image",
      id: `inline-${Number(match[1])}`,
      order: Number(match[1]),
    });
    cursor = index + match[0].length;
  }

  const rest = publicationBody.slice(cursor).trim();
  if (rest) {
    sequence.push({ kind: "body", id: `body-${bodyIndex}`, markdown: rest });
  }

  if (sequence.length === 0) {
    sequence.push({ kind: "body", id: "body-1", markdown: publicationBody });
  }

  return sequence;
}

export function inlineImageOrders(sequence: readonly NotePostSequenceItem[]): number[] {
  return [...new Set(
    sequence
      .filter((item): item is Extract<NotePostSequenceItem, { kind: "inline-image" }> => item.kind === "inline-image")
      .map((item) => item.order),
  )].sort((a, b) => a - b);
}

async function imageToPngBlob(blob: Blob): Promise<Blob> {
  if (blob.type === "image/png") return blob;
  if (typeof document === "undefined" || typeof URL === "undefined") {
    throw new Error("画像をクリップボード用に変換できません。");
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = document.createElement("img");
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("この画像形式をブラウザーで読み込めませんでした。PNG・JPEG・WebPをお試しください。"));
      image.src = objectUrl;
    });

    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) throw new Error("画像サイズを取得できませんでした。");

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("画像変換を開始できませんでした。");
    context.drawImage(image, 0, 0);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => result ? resolve(result) : reject(new Error("画像をPNGへ変換できませんでした。")),
        "image/png",
      );
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function copyImageBlobToClipboard(blob: Blob): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("このブラウザーでは画像の直接コピーを利用できません。画像を長押ししてコピーしてください。");
  }

  const pngPromise = imageToPngBlob(blob);
  try {
    const item = new ClipboardItem({ "image/png": pngPromise });
    await navigator.clipboard.write([item]);
  } catch {
    throw new Error("画像をクリップボードへコピーできませんでした。ブラウザーのクリップボード許可を確認するか、画像を長押ししてコピーしてください。");
  }
}
