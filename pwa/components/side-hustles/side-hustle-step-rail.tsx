const STEPS = ["基本設定", "詳細設定", "AI設定", "完成プロンプト", "AI出力"] as const;

export function SideHustleStepRail({
  step,
  onStepChange,
}: {
  step: number;
  onStepChange?: (step: number) => void;
}) {
  return (
    <ol className="side-hustle-step-rail" aria-label="副業機能の進行状況">
      {STEPS.map((label, index) => {
        const canReturn = index < step && Boolean(onStepChange);
        return (
          <li
            key={label}
            className={index === step ? "active" : index < step ? "done" : ""}
            aria-current={index === step ? "step" : undefined}
          >
            <button
              type="button"
              disabled={!canReturn}
              onClick={() => canReturn && onStepChange?.(index)}
              aria-label={canReturn ? `STEP ${index + 1}「${label}」へ戻る` : `STEP ${index + 1}「${label}」`}
              title={canReturn ? "このSTEPへ戻って修正" : undefined}
            >
              <span>{index < step ? "✓" : index + 1}</span>
              <b>{label}</b>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
