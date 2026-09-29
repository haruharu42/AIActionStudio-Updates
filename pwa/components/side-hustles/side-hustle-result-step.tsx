import Link from "next/link";

import type { SideHustleDefinition, SideHustleDraft } from "@/features/side-hustles/types";

export function SideHustleResultStep({
  definition,
  draft,
  onChangeResult,
  onPasteResult,
  onCopyResult,
  onClearResult,
}: {
  definition: SideHustleDefinition;
  draft: SideHustleDraft;
  onChangeResult: (value: string) => void;
  onPasteResult: () => Promise<void>;
  onCopyResult: () => Promise<void>;
  onClearResult: () => void;
}) {
  return (
    <section className="side-hustle-wizard-card">
      <div className="side-hustle-step-copy">
        <p className="eyebrow">STEP 5</p>
        <h2>AIの完成結果をAASへ戻す</h2>
        <p>
          外部AIで生成した結果をここへ貼り付けて保存できます。
          入力内容と同じく端末内へ自動保存されるため、別画面へ移動しても続きから確認できます。
        </p>
      </div>

      <label className="side-hustle-prompt-output side-hustle-result-output">
        <span>AIの完成結果</span>
        <textarea
          value={draft.resultText}
          rows={24}
          onChange={(event) => onChangeResult(event.target.value.slice(0, 120000))}
          placeholder="ChatGPT / Claude / Gemini の完成結果をここへ貼り付けてください。"
        />
      </label>

      <div className="side-hustle-result-actions">
        <button className="primary-action" type="button" onClick={() => void onPasteResult()}>
          クリップボードから貼り付け
        </button>
        <button
          className="secondary-action"
          type="button"
          disabled={!draft.resultText.trim()}
          onClick={() => void onCopyResult()}
        >
          完成結果をコピー
        </button>
        <button
          className="secondary-action"
          type="button"
          disabled={!draft.resultText.trim()}
          onClick={onClearResult}
        >
          結果だけクリア
        </button>
      </div>

      <div className="side-hustle-result-summary">
        <strong>{definition.title} の作業結果</strong>
        <span>{draft.resultText.length.toLocaleString()}文字</span>
        <small>
          この結果はAAS内の副業ウィザード進捗として端末へ保存します。
          パスワード・認証コード・決済情報などの機密情報は貼り付けないでください。
        </small>
      </div>

      <div className="side-hustle-result-next">
        <div>
          <strong>次の行動へ進む</strong>
          <small>対応するロードマップへ戻り、完了したタスクをチェックして次の3つを確認できます。</small>
        </div>
        <Link
          className="primary-action"
          href={"/side-hustle-roadmaps?roadmap=" + encodeURIComponent(definition.slug)}
        >
          この副業のロードマップへ戻る
        </Link>
      </div>
    </section>
  );
}
