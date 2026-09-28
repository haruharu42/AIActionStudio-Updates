import { markdownToNoteHtml, markdownToPlainText } from "@/lib/note-rich-text";
import { publicationBodyForCopy, type PublicationBodyOptions } from "@/lib/phase11-create";

export type NotePostSequenceItem =
  | { kind: "body"; id: string; markdown: string; paid: boolean }
  | { kind: "inline-image"; id: string; order: number; paid: boolean }
  | { kind: "paid-boundary"; id: string };

const POSTING_MARKER = /^(?:[ \t]*(?:\*\*)?【挿絵(\d+)をここに挿入】(?:\*\*)?[ \t]*|(?:[ \t]*---[ \t]*\n)?[ \t]*(?:\*\*)?【ここから有料エリア】(?:\*\*)?[ \t]*(?:\n[ \t]*---[ \t]*)?)$/gim;

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
  let paid = false;

  for (const match of publicationBody.matchAll(POSTING_MARKER)) {
    const index = match.index ?? 0;
    const before = publicationBody.slice(cursor, index).trim();
    if (before) {
      sequence.push({ kind: "body", id: `body-${bodyIndex}`, markdown: before, paid });
      bodyIndex += 1;
    }

    if (match[1]) {
      const order = Number(match[1]);
      sequence.push({
        kind: "inline-image",
        id: `inline-${order}`,
        order,
        paid,
      });
    } else {
      sequence.push({ kind: "paid-boundary", id: "paid-boundary" });
      paid = true;
    }
    cursor = index + match[0].length;
  }

  const rest = publicationBody.slice(cursor).trim();
  if (rest) {
    sequence.push({ kind: "body", id: `body-${bodyIndex}`, markdown: rest, paid });
  }

  if (sequence.length === 0) {
    sequence.push({ kind: "body", id: "body-1", markdown: publicationBody, paid: false });
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

export type NotePostClipboardPayload = {
  html: string;
  plain: string;
};

export function buildNotePostClipboardPayload(
  sequence: readonly NotePostSequenceItem[],
  inlineImageDataUrls: ReadonlyMap<number, string>,
): NotePostClipboardPayload {
  const html: string[] = [];
  const plain: string[] = [];

  for (const item of sequence) {
    if (item.kind === "body") {
      const rich = markdownToNoteHtml(item.markdown);
      const text = markdownToPlainText(item.markdown);
      if (rich) html.push(rich);
      if (text) plain.push(text);
      continue;
    }

    if (item.kind === "paid-boundary") {
      html.push("<p><br></p><p><strong>【ここから有料エリア】</strong></p><p><br></p>");
      plain.push("【ここから有料エリア】");
      continue;
    }

    const dataUrl = inlineImageDataUrls.get(item.order);
    if (!dataUrl) throw new Error(`挿絵${item.order}がまだ選択されていません。`);
    html.push(`<p><img src="${dataUrl}" alt="挿絵${item.order}" /></p>`);
    plain.push(`【挿絵${item.order}】`);
  }

  return {
    html: html.join("\n"),
    plain: plain.join("\n\n").trim(),
  };
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  if (typeof FileReader === "undefined") {
    throw new Error("このブラウザーでは画像込み一括コピーを利用できません。");
  }
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string"
      ? resolve(reader.result)
      : reject(new Error("画像をコピー用データへ変換できませんでした。"));
    reader.onerror = () => reject(new Error("画像をコピー用データへ変換できませんでした。"));
    reader.readAsDataURL(blob);
  });
}

function fallbackRichClipboardCopy(html: string): boolean {
  if (typeof document === "undefined" || typeof window === "undefined") return false;
  const container = document.createElement("div");
  container.contentEditable = "true";
  container.setAttribute("aria-hidden", "true");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.innerHTML = html;
  document.body.append(container);

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(container);
  selection?.removeAllRanges();
  selection?.addRange(range);
  const copied = document.execCommand("copy");
  selection?.removeAllRanges();
  container.remove();
  return copied;
}

export async function copyNotePostSequenceWithImages(
  sequence: readonly NotePostSequenceItem[],
  imageForOrder: (order: number) => Blob | undefined,
): Promise<"rich" | "fallback"> {
  const imageDataUrls = new Map<number, string>();
  for (const item of sequence) {
    if (item.kind !== "inline-image" || imageDataUrls.has(item.order)) continue;
    const source = imageForOrder(item.order);
    if (!source) throw new Error(`挿絵${item.order}がまだ選択されていません。`);
    const png = await imageToPngBlob(source);
    imageDataUrls.set(item.order, await blobToDataUrl(png));
  }

  const payload = buildNotePostClipboardPayload(sequence, imageDataUrls);
  if (!payload.html) throw new Error("一括コピーする本文がありません。");

  if (typeof navigator !== "undefined" && navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
    try {
      const item = new ClipboardItem({
        "text/html": new Blob([payload.html], { type: "text/html" }),
        "text/plain": new Blob([payload.plain], { type: "text/plain" }),
      });
      await navigator.clipboard.write([item]);
      return "rich";
    } catch {
      // Browser/editor differences can reject HTML that contains embedded images.
    }
  }

  if (fallbackRichClipboardCopy(payload.html)) return "fallback";
  throw new Error("画像込み一括コピーに対応していない環境です。上の順番から個別にコピーしてください。");
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
