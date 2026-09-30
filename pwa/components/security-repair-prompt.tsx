"use client";

import { useMemo, useState } from "react";

export type SecurityRepairPromptDetail = {
  label: string;
  value: string | number | null | undefined;
};

function sanitizeDiagnosticText(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_JWT]")
    .replace(/\b(?:sk_(?:live|test)_[A-Za-z0-9]+|sb_secret_[A-Za-z0-9_-]+)\b/gi, "[REDACTED_SECRET]")
    .replace(/([?&](?:access_token|refresh_token|token|secret|api_key|key|code)=)[^&\s]+/gi, "$1[REDACTED]");
}

export function buildSecurityRepairPrompt(input: {
  context: string;
  summary: string;
  details?: SecurityRepairPromptDetail[];
}): string {
  const details = (input.details ?? [])
    .filter((item) => item.value !== null && item.value !== undefined && String(item.value).trim())
    .map((item) => `- ${sanitizeDiagnosticText(item.label)}: ${sanitizeDiagnosticText(String(item.value))}`)
    .join("\n");

  return [
    "AI Action Studio のセキュリティ問題を調査して、安全に修正してください。",
    "",
    "【対象】",
    sanitizeDiagnosticText(input.context),
    "",
    "【発生している問題】",
    sanitizeDiagnosticText(input.summary),
    ...(details ? ["", "【診断情報】", details] : []),
    "",
    "【必須の進め方】",
    "1. 推測だけで変更せず、現在の main・Supabase・Preview の状態と関連ログ/実装を確認して原因を特定する。",
    "2. 再現条件と影響範囲を整理し、既存の正常機能を壊さない最小修正を行う。",
    "3. RLS、所有者境界、active admin 判定など既存の認可を弱めない。",
    "4. service_role、APIキー、Access/Refresh Token、Cookie、認証コード等の秘密情報をクライアントやログへ追加しない。",
    "5. Windows Updater/Release/latest.json、Stripe LIVE、Cloudflare production routing/custom domain/DNS は明示的な許可なしに変更しない。",
    "6. 意図的な開発中ポリシーを勝手に変更せず、現在の仕様を確認してから修正する。",
    "7. 修正後に typecheck・lint・回帰テスト・関連セキュリティテストを実行し、失敗があれば解消する。",
    "8. DB変更が必要なら migration と実DBの履歴を一致させ、Previewで確認してから完了とする。",
    "",
    "【完了報告に含める内容】",
    "- 原因",
    "- 変更したファイル/DB",
    "- セキュリティ上の影響",
    "- 実行したテストと結果",
    "- 残っている問題があればその内容",
    "",
    "秘密情報や個人情報が診断情報に含まれる可能性がある場合は、保存・転載せず必要最小限にマスクして扱ってください。",
  ].join("\n");
}

async function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!copied) throw new Error("copy_failed");
}

export function SecurityRepairPrompt({
  context,
  summary,
  details,
}: {
  context: string;
  summary: string;
  details?: SecurityRepairPromptDetail[];
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const prompt = useMemo(() => buildSecurityRepairPrompt({ context, summary, details }), [context, summary, details]);

  const copyPrompt = async () => {
    try {
      await writeClipboard(prompt);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2500);
    } catch {
      setCopyState("error");
    }
  };

  return (
    <section className="admin-panel" aria-label="セキュリティ修正用プロンプト">
      <div className="admin-panel-heading">
        <div>
          <p className="eyebrow">REPAIR PROMPT</p>
          <h2>修正用プロンプト</h2>
        </div>
        <button className="primary-action" type="button" onClick={() => void copyPrompt()}>
          {copyState === "copied" ? "コピーしました" : "修正用プロンプトをコピー"}
        </button>
      </div>
      <p className="trial-admin-note">現在のエラー・監査情報から修正依頼文を作成します。代表的なToken・秘密鍵パターンはコピー前にマスクします。</p>
      <textarea
        readOnly
        value={prompt}
        rows={14}
        aria-label="生成された修正用プロンプト"
        style={{ width: "100%", resize: "vertical", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: 12, lineHeight: 1.55 }}
      />
      {copyState === "error" && <p className="route-notice error">コピーできませんでした。プロンプト欄を長押しして手動でコピーしてください。</p>}
    </section>
  );
}
