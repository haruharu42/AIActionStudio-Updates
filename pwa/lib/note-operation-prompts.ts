import { buildPlatformAccountPromptContext } from "@/features/account-design";
import { buildWorkspacePresetPromptContext } from "@/features/presets/workspace-presets";
import type { AiProvider } from "@/lib/user-personalization";
import {
  noteMonthBounds,
  previousJstMonth,
  todayJstDateKey,
} from "@/lib/note-schedule-core";
import type {
  NoteArticleOutputSnapshot,
  NoteSchedulePerformanceSnapshot,
} from "@/lib/note-schedule-types";
import { formatSchedulePerformanceForPrompt } from "@/lib/note-schedule-performance";
import {
  NOTE_OPERATION_GOALS,
  noteProfileSelectionLabels,
  type NoteOperationProfile,
} from "@/lib/note-operation-profile";

function aiProviderName(provider: AiProvider): string {
  return provider === "gemini" ? "Gemini" : provider === "claude" ? "Claude" : "ChatGPT";
}

function providerSearchInstruction(provider: AiProvider): string {
  if (provider === "gemini") return "Google検索/グラウンディング等、現在利用できるWeb検索機能を必ず使う";
  return "Web検索機能が利用できる場合は必ず使う";
}

function formatArticleOutputForPrompt(output: NoteArticleOutputSnapshot | null, expectedMonth: string): string {
  if (!output || output.targetMonth !== expectedMonth) {
    return `- ${expectedMonth}にAASで作成したnote記事は確認できません。作成本数を推測しない。`;
  }
  const statuses = Object.entries(output.statusCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([status, count]) => `${status}=${count}`)
    .join("、");
  return [
    `- 対象月: ${output.targetMonth}`,
    `- AASで作成したnote記事: ${output.createdPosts}本（無料 ${output.freeCreated} / 有料 ${output.paidCreated}）`,
    `- 公開済み: ${output.published}本 / 公開準備段階を含むready系: ${output.readyLike}本 / draft・writing等: ${output.draftLike}本`,
    `- status内訳: ${statuses || "データなし"}`,
  ].join("\n");
}

export function buildNoteProfileDraft(profile: NoteOperationProfile): string {
  const name = profile.noteDisplayName.trim();
  const readerExtra = profile.targetReader.trim();
  const topics = profile.mainTopics.map((item) => item.trim()).filter(Boolean);
  const selected = noteProfileSelectionLabels(profile);
  const lines: string[] = [];
  if (name) lines.push(`${name}です。`);
  lines.push(`${topics.length ? topics.join("・") : selected.genre}を中心に、${selected.style}の発信をしています。`);
  lines.push(`${readerExtra || selected.audience}に向けて、${selected.tone}な文章で分かりやすくまとめます。`);
  if (profile.experienceNote.trim()) lines.push(profile.experienceNote.trim());
  return lines.join("\n");
}


export function buildNoteAccountResearchPrompt(profile: NoteOperationProfile, aiProvider: AiProvider, currentDate = todayJstDateKey()): string {
  const selected = noteProfileSelectionLabels(profile);
  const providerName = aiProvider === "gemini" ? "Gemini" : aiProvider === "claude" ? "Claude" : "ChatGPT";
  const providerSearch = aiProvider === "gemini"
    ? "Google検索/グラウンディング等、現在利用できるWeb検索機能を使う"
    : aiProvider === "claude"
      ? "Web検索機能が利用できる場合は必ず使う"
      : "Web検索機能が利用できる場合は必ず使う";
  const topics = profile.mainTopics.length ? profile.mainTopics.join(" / ") : "未指定（調査結果から候補を出す）";
  const factualBackground = profile.experienceNote.trim() || "未入力。経歴・実績・資格を推測して追加しない";
  const readerExtra = profile.targetReader.trim() || "なし";
  const displayName = profile.noteDisplayName.trim() || "未定";
  const workspacePresetContext = buildWorkspacePresetPromptContext("note");
  const accountPresetContext = buildPlatformAccountPromptContext("note");

  return `あなたは日本のnote運営に詳しい編集者・コンテンツ戦略担当です。
目的は、初心者でも継続しやすい「noteアカウント構成案」を、最新情報と直近トレンドを調査したうえで3案作ることです。

【重要：最新情報の確認】
- 基準日: ${currentDate}（日本時間）
- ${providerName}の${providerSearch}。
- 回答を作る前に必ずWeb検索を行う。検索できない場合は「最新情報を確認できないため、トレンド部分は確定できません」と明記し、未確認情報を最新事実として作らない。
- note公式（note.com/info、公式ヘルプ等）を最優先し、現在の機能・カテゴリ・おすすめの仕組み・創作カレンダー・開催中/直近の企画やお題・プロフィール関連の変更を確認する。
- 選択ジャンルについて、直近90日と直近12か月の両方を調べる。検索需要、季節性、話題、継続して読まれやすい悩みを分ける。
- SNSの一時的なバズだけで決めず、note内の文脈、公式企画、検索需要、長期的な読者課題を分けて評価する。
- 根拠として使った情報は、出典名・URL・公開/更新日を最後に一覧化する。
- 推測や分析は「分析」と明記し、公式事実と混同しない。

【ユーザーが選んだ条件】
- 主ジャンル: ${selected.genre}
- 運営スタイル: ${selected.style}
- 想定読者: ${selected.audience}
- 読者の補足: ${readerExtra}
- 文章の雰囲気: ${selected.tone}
- 収益化方針: ${selected.monetization}
- 運営目的: ${NOTE_OPERATION_GOALS.find((item) => item.value === profile.operationGoal)?.label ?? profile.operationGoal}
- 補足テーマ: ${topics}
- 希望表示名: ${displayName}
- ユーザーが事実として入力した経験・資格・背景: ${factualBackground}

${workspacePresetContext ? `${workspacePresetContext}

` : ""}${accountPresetContext ? `${accountPresetContext}

` : ""}【絶対ルール】
- ユーザーが入力していない経歴、年齢、職業、収入、実績、資格、利用経験、成功体験を作らない。
- 「稼げる」「伸びる」「この時間が正解」など成果を保証しない。
- 有料noteを提案する場合も、無料部分で十分な価値を提供し、誇張や不安煽りを使わない。
- 現在のnote仕様やトレンドは検索結果で確認できた範囲だけを事実として扱う。
- アカウントID/ユーザー名候補は「空き状況未確認」と明記する。
- 競合クリエイターの文章・プロフィールをコピーまたは近似模倣しない。

【出力してほしい内容】
最初に「今回確認した最新動向」を5〜10項目で要約し、そのあとアカウント構成を3案出してください。

各案は次の順番で出力:
1. アカウントのコンセプト（1文）
2. この案が向く理由（最新動向との関係を含む）
3. 表示名候補 5個
4. アカウントID候補 5個（空き状況未確認と明記）
5. プロフィール文候補 3個
6. 自己紹介noteのタイトル候補と構成
7. 発信の柱 3〜5本
8. 無料noteで扱う内容
9. 有料noteで扱う内容（収益化しない設定なら省略）
10. 最初の10記事のタイトル案
11. 「今のトレンドを狙う記事」と「半年後も読める記事」を分ける
12. 初月4週間の運営案（投稿回数・曜日・時間はテスト案として提示）
13. 使うハッシュタグ/キーワード候補と、その根拠
14. 注意点・避けるべきこと
15. この案を選ぶ判断基準

最後に:
- 3案の比較表
- 初心者が選びやすい判断フロー
- 参照した情報源一覧（URL・日付）
- 「今後1か月で再確認したいトレンド項目」

日本語で、初心者がそのまま実行できる具体性で出力してください。`;
}

export function buildNoteScheduleResearchPrompt(
  profile: NoteOperationProfile,
  aiProvider: AiProvider,
  targetMonth: string,
  currentDate = todayJstDateKey(),
  referencePerformance?: NoteSchedulePerformanceSnapshot | null,
  articleOutput?: NoteArticleOutputSnapshot | null,
): string {
  const { start, end } = noteMonthBounds(targetMonth);
  const selected = noteProfileSelectionLabels(profile);
  const workspacePresetContext = buildWorkspacePresetPromptContext("note");
  const accountPresetContext = buildPlatformAccountPromptContext("note");
  const providerName = aiProviderName(aiProvider);
  const topics = profile.mainTopics.length ? profile.mainTopics.join(" / ") : "未指定（最新調査から候補を決める）";
  const readerExtra = profile.targetReader.trim() || "なし";
  const factualBackground = profile.experienceNote.trim() || "未入力。経歴・実績・資格を推測して追加しない";
  const currentMonth = currentDate.slice(0, 7);
  const firstAllowedDate = targetMonth === currentMonth ? currentDate : start;
  const previousMonth = previousJstMonth(targetMonth);
  const performanceMonth = referencePerformance?.targetMonth ?? previousMonth;
  const articleOutputMonth = articleOutput?.targetMonth ?? (targetMonth === currentMonth ? targetMonth : previousMonth);
  const performanceSection = referencePerformance === undefined
    ? ""
    : `
【AAS運用スケジュール実績（構造化データのみ）】
${formatSchedulePerformanceForPrompt(referencePerformance, performanceMonth)}
- この実績は「回数を増やす/減らす」の機械的な命令ではない。完了しやすかった曜日・時刻・実際に継続できた頻度を参考に、今後の負荷を調整する。
- 未完了分やスキップ分を「借金」のように残り期間へ詰め込まない。スケジュール通りに運用できなかったこと自体を失敗扱いしない。
- 完了率が低い場合は、まず継続可能な頻度へ落とすことを優先する。
- 完了率が高くても自動的に投稿数を増やさず、最新リサーチと品質維持の余力を合わせて判断する。
- AASから渡していない本文、PV、売上、購入率、フォロワー増減、読者属性、成功要因を推測して実績として扱わない。
- 記事タイトルや本文そのものは実績として渡していない。ここでは予定種別・状態・曜日・時刻の集計だけを使う。
`;
  const articleOutputSection = articleOutput === undefined
    ? ""
    : `
【AASで実際に作成したnote記事数】
${formatArticleOutputForPrompt(articleOutput, articleOutputMonth)}
- これはAAS内のarticlesで対象期間に作成されたnote記事数であり、PV・売上・購入数ではない。
- 無料/有料の実際の制作ペースとして使う。たとえば無料30本・有料20本を作成済みなら、その50本を制作能力の実績として考慮する。
- ただし作成数と公開成果は同義ではない。draft・writing等も含むため、作成本数だけを理由に投稿数を機械的に増やさない。
- 対象月の途中で再計画する場合、ここまでに作った本数を既存実績として扱い、残り期間だけを現実的に再設計する。
`;

  return `あなたは日本のnote運営に詳しい編集者・コンテンツ戦略担当です。
目的は、ユーザーに投稿回数を手入力させるのではなく、${targetMonth}の1か月について、最新情報を調査したうえで「無理なく継続でき、無料noteと有料noteの役割が分かれた運用スケジュール」を設計し、AASが読み込めるMarkdown表で返すことです。

【対象期間】
- 基準日: ${currentDate}（日本時間）
- 対象月: ${targetMonth}
- スケジュール可能期間: ${firstAllowedDate} 〜 ${end}
- 対象月が今月の場合、基準日より前には新しい投稿予定を置かない。
- 対象月が未来の場合、その月全体を使ってよい。

【必須リサーチ】
- ${providerName}の${providerSearchInstruction(aiProvider)}。
- 回答作成前に最新情報を調査する。Web検索できない場合は、research.summaryに「最新情報を確認できない」と明記し、未確認情報を最新事実として作らない。
- note公式（note.com/info、公式ヘルプ等）を最優先し、現在の機能、カテゴリ/おすすめの仕組み、創作カレンダー、開催中・直近の企画/お題、予約投稿や販売関連の現行仕様を確認する。
- 選択ジャンルについて、直近30日、直近90日、直近12か月の3つの時間軸で調べる。
- 季節性、検索需要、note内企画、長期的な読者課題を分けて考える。
- 投稿頻度、1日の投稿回数、無料/有料の比率、曜日、時間帯は固定の常識で決めず、調査内容・アカウントの新しさ・制作負荷・品質維持を踏まえて決める。
- 「毎日投稿すれば伸びる」「20時が正解」などの断定は禁止。時間帯は検証用の仮説として扱う。
- 有料noteは数を増やすことを目的にせず、無料記事で信頼や入口を作れるか、選択ジャンルで深掘り価値を出せるかを考えて頻度を決める。
- 新規/初心者アカウントでは、制作負荷と継続性を特に重視する。
- 根拠にした情報源は内部判断に使うが、最終回答には出典一覧や説明文を出さない。

【アカウント条件】
- 主ジャンル: ${selected.genre}
- 運営スタイル: ${selected.style}
- 想定読者: ${selected.audience}
- 読者補足: ${readerExtra}
- 文章の雰囲気: ${selected.tone}
- 収益化方針: ${selected.monetization}
- 運営目的: ${NOTE_OPERATION_GOALS.find((item) => item.value === profile.operationGoal)?.label ?? profile.operationGoal}
- 補足テーマ: ${topics}
- アカウント作成済み: ${profile.accountReady ? "はい" : "いいえ"}
- プロフィール準備済み: ${profile.profileReady ? "はい" : "いいえ"}
- ユーザーが事実として入力した経験・資格・背景: ${factualBackground}
${performanceSection}
${articleOutputSection}
${workspacePresetContext ? `${workspacePresetContext}
` : ""}${accountPresetContext ? `${accountPresetContext}
` : ""}【スケジュール設計】
- あなた自身が、平均の週投稿数・有料noteの週平均・1日の最大投稿数・無料/有料の本数を決定する。
- scheduleに入れてよいtypeは free_note と paid_note の2種類だけ。review / sns_share / profile_setup は出力しない。
- free_note / paid_note には、実際に記事作成へ進める具体的なテーマとタイトルを入れる。
- カレンダーは「無料note作成」「有料note作成」の制作予定として使う。SNS告知、振り返り、初期設定などの記事制作以外の予定は入れない。
- 同じ日・同じ時間に記事作成予定を重複させない。
- 1日に2回以上投稿する日を作る場合は、投稿回数と同じ数だけ行を分け、各行に異なる投稿時刻を必ず入れる。
- 例：1日2回なら2行・2時刻、1日3回なら3行・3時刻。複数投稿を1行にまとめたり、時刻を省略したりしない。
- 複数投稿の時刻は調査結果と読者像を踏まえて決め、同日の時刻同士は原則3時間以上空ける。
- 休む日も含めて、初心者が現実的に続けられる計画にする。
- トレンド記事だけで埋めず、対象月の旬の記事と半年後も読まれる記事を混ぜる。
- 有料noteを置く場合、その前後に関連する無料noteがあるなど読者導線を考える。
- 投稿時間は検証案として扱い、最終表では各投稿の時刻だけを明示する。
- 投稿頻度・無料/有料比率・投稿時刻の理由は内部判断に使い、最終回答へ説明文として追加しない。
- 対象月が今月の場合、予定表は「今日から月末までに新しく行う分」だけを表す。すでに作成済み・完了済みの記事を本数へ二重計上しない。
- 月途中の再計画では、今日より前の履歴は変更対象にせず、今日以降だけを新しい計画にする。
- ユーザーはスケジュール通りに完璧に運用する必要はない。予定より多く作れた場合も少なかった場合も、その実績から次回再計画できる柔軟な案にする。

【絶対ルール】
- ユーザーが入力していない経歴、職業、年齢、収入、実績、資格、購入経験、利用経験、成功体験を作らない。
- 成果保証、過度な煽り、架空の権威付けをしない。
- 競合クリエイターの文章・プロフィールをコピーまたは近似模倣しない。
- 調査で確認できない数値やトレンドを事実として断定しない。

【出力形式】
最終回答は、AASへそのままコピー＆ペーストする次のMarkdown表だけを返す。
前文、挨拶、説明、要約、理由、注意書き、出典一覧、コードフェンス、表の後の文章は一切出力しない。

| 日付 | 時刻 | 種別 | 記事タイトル | テーマ |
|---|---|---|---|---|
| ${firstAllowedDate} | 20:00 | 無料note作成 | 具体的な記事タイトル | 記事テーマ |

- 種別は「無料note作成」または「有料note作成」の2種類だけ。
- 日付はYYYY-MM-DD形式。
- 時刻はHH:MM形式。
- 対象月が今月の場合、今日より前の日付は入れない。
- 1日2回以上なら投稿回数と同じ行数を作り、各行に異なる時刻を書く。
- 表には記事作成予定だけを入れ、振り返り・SNS告知・初期設定は入れない。
- 表以外の文字は出力しない。`;
}
