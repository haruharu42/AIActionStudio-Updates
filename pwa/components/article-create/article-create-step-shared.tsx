import { useState } from "react";

import type { ArticleCreationDraft } from "@/lib/phase11-create";
import { launchAiApp, type AiAppKey } from "@/lib/ai-app-links";
import { getRuntimeWritingProfile } from "@/lib/user-personalization";

export type ArticleDraftPatch = <K extends keyof ArticleCreationDraft>(
  key: K,
  value: ArticleCreationDraft[K],
) => void;

export type MessageSetter = (value: string) => void;

export const AI_LAUNCH_OPTIONS = [
  { key: "chatgpt", label: "ChatGPT" },
  { key: "claude", label: "Claude" },
  { key: "gemini", label: "Gemini" },
] as const;

export function currentAiLaunchOptions() {
  const selected = getRuntimeWritingProfile()?.preferredAi;
  return selected ? AI_LAUNCH_OPTIONS.filter((option) => option.key === selected) : AI_LAUNCH_OPTIONS;
}

async function copyText(value: string, setMessage: MessageSetter): Promise<boolean> {
  if (!navigator.clipboard?.writeText) {
    setMessage("このブラウザーでは自動コピーできません。テキストを選択してコピーしてください。");
    return false;
  }
  try {
    await navigator.clipboard.writeText(value);
    setMessage("クリップボードへコピーしました。");
    return true;
  } catch {
    setMessage("コピーできませんでした。テキストを選択してコピーしてください。");
    return false;
  }
}

export async function readClipboardText(setMessage: MessageSetter): Promise<string | null> {
  if (!navigator.clipboard?.readText) {
    setMessage("このブラウザーでは貼り付けボタンを利用できません。入力欄を長押しして貼り付けてください。");
    return null;
  }
  try {
    const value = await navigator.clipboard.readText();
    if (!value) {
      setMessage("クリップボードに貼り付けられる文章がありません。");
      return null;
    }
    setMessage("クリップボードから貼り付けました。");
    return value;
  } catch {
    setMessage("クリップボードを読み取れませんでした。ブラウザーの許可を確認するか、入力欄を長押しして貼り付けてください。");
    return null;
  }
}

export function CopyButton({
  value,
  label,
  setMessage,
  className = "secondary-action",
}: {
  value: string;
  label: string;
  setMessage: MessageSetter;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyText(value, setMessage);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  };

  return (
    <button className={className} type="button" disabled={!value} onClick={() => void handleCopy()}>
      {copied ? "コピーしました ✓" : label}
    </button>
  );
}


export function CopyAndOpenAiButton({
  value,
  appKey,
  appLabel,
  onBeforeExternalLaunch,
  setMessage,
  className = "openai-launch-action",
}: {
  value: string;
  appKey: AiAppKey;
  appLabel: string;
  onBeforeExternalLaunch: () => void;
  setMessage: MessageSetter;
  className?: string;
}) {
  const handleCopyAndOpen = async () => {
    onBeforeExternalLaunch();
    const ok = await copyText(value, setMessage);
    if (!ok) {
      setMessage(`プロンプトをコピーできなかったため${appLabel}は開いていません。手動でコピーしてから開いてください。`);
      return;
    }
    setMessage(`プロンプトをコピーして${appLabel}を開きます。`);
    launchAiApp(appKey);
  };

  return (
    <button
      className={className}
      type="button"
      disabled={!value}
      onClick={() => void handleCopyAndOpen()}
    >
      コピーして{appLabel}を開く ↗
    </button>
  );
}
