export type ActionPromptField = {
  key: string;
  label: string;
  placeholder: string;
  multiline?: boolean;
  options?: readonly string[];
};

export type ActionPromptTemplate = {
  id: string;
  title: string;
  category: string;
  sideHustle: string;
  description: string;
  recommendedAi: "ChatGPT" | "Claude" | "Gemini";
  fields: readonly ActionPromptField[];
  prompt: string;
};

const AUDIENCE_OPTIONS = [
  "完全初心者",
  "初心者",
  "経験者",
  "会社員・働く人",
  "副業を始めたい人",
  "クリエイター・発信者",
  "個人事業主・経営者",
  "既存フォロワー",
  "購入を検討している人",
  "幅広い読者",
] as const;

const GOAL_OPTIONS = [
  "認知を広げる",
  "保存・ブックマークにつなげる",
  "プロフィール閲覧・フォローにつなげる",
  "購入判断を助ける",
  "商品・サービス購入につなげる",
  "問い合わせ・相談につなげる",
  "応募・案件獲得につなげる",
  "理解・学習を助ける",
  "継続して読んでもらう",
  "作業を効率化する",
] as const;

const commonFields = (
  topicLabel = "テーマ・対象",
  goalLabel = "目的",
): readonly ActionPromptField[] => [
  { key: "topic", label: topicLabel, placeholder: "例：AI初心者向けの副業、ゲーム配信、家計管理など" },
  { key: "audience", label: "想定する相手", placeholder: "一覧から選ぶか、その他を自由入力", options: AUDIENCE_OPTIONS },
  { key: "goal", label: goalLabel, placeholder: "一覧から選ぶか、その他を自由入力", options: GOAL_OPTIONS },
  { key: "notes", label: "追加条件・素材", placeholder: "事実として使ってよい情報、避けたい表現、文字数など", multiline: true },
];

export const ACTION_PROMPT_TEMPLATES: readonly ActionPromptTemplate[] = [
  {
    id: "note-article-plan",
    title: "note記事の企画・構成",
    category: "記事・コンテンツ",
    sideHustle: "note副業",
    description: "テーマから読者ニーズ、タイトル案、見出し構成、執筆方針をまとめます。",
    recommendedAi: "ChatGPT",
    fields: commonFields("記事テーマ", "この記事で読者にしてほしいこと"),
    prompt: `あなたは日本語の編集者兼コンテンツ企画者です。
以下の条件から、note向け記事の企画を作成してください。

テーマ: {{topic}}
想定読者: {{audience}}
目的: {{goal}}
追加条件・素材: {{notes}}

【出力】
- 読者の悩み・知りたいこと
- タイトル候補5案
- 記事の結論
- 見出し構成
- 各見出しで扱う内容
- 読後に取れる具体的な行動

【ルール】
ユーザーが入力していない実体験・実績・レビューを事実として作らない。
価格、統計、ランキング、最新仕様など変動する情報を未確認のまま断定しない。
不足情報があっても架空の事実で補完せず、一般論または「例」と明示する。`,
  },
  {
    id: "paid-content-value",
    title: "有料コンテンツの価値設計",
    category: "記事・コンテンツ",
    sideHustle: "デジタル商品",
    description: "無料部分と有料部分の役割を分け、購入後に得られる具体的な価値を整理します。",
    recommendedAi: "Claude",
    fields: commonFields("販売したいテーマ", "購入者が到達したい状態"),
    prompt: `あなたはデジタルコンテンツ設計者です。
以下の情報だけを根拠に、有料コンテンツの価値設計をしてください。

テーマ: {{topic}}
想定購入者: {{audience}}
到達してほしい状態: {{goal}}
追加条件・素材: {{notes}}

無料で伝える範囲、有料で深掘りする範囲、購入判断に必要な説明、章構成、実行チェックリストを提案してください。
成果保証、架空の実績、存在しない購入者レビュー、根拠のない希少性は使わないでください。`,
  },
  {
    id: "x-post-series",
    title: "X投稿シリーズ作成",
    category: "SNS",
    sideHustle: "SNS運用",
    description: "発信テーマから単発投稿ではなく、継続しやすい投稿シリーズを作ります。",
    recommendedAi: "ChatGPT",
    fields: commonFields("発信テーマ", "投稿で達成したいこと"),
    prompt: `あなたはSNS編集者です。
X向けに、以下の条件で継続投稿できる企画を作成してください。

発信テーマ: {{topic}}
想定読者: {{audience}}
目的: {{goal}}
追加条件・素材: {{notes}}

【出力】
1. 投稿の柱を3〜5個
2. 各柱の投稿ネタ
3. すぐ投稿できる本文案を5本
4. 過度な煽りを避けたCTA
5. 次に検証するポイント

入力されていない実績・収益・体験談は作らないでください。`,
  },
  {
    id: "instagram-caption",
    title: "Instagram投稿文",
    category: "SNS",
    sideHustle: "SNS運用",
    description: "画像やリールの内容に合わせた読みやすいキャプションを作ります。",
    recommendedAi: "ChatGPT",
    fields: commonFields("投稿内容", "保存・コメント・プロフィール遷移などの目的"),
    prompt: `Instagram投稿のキャプションを作成してください。

投稿内容: {{topic}}
想定読者: {{audience}}
目的: {{goal}}
追加条件・素材: {{notes}}

冒頭で内容が分かり、本文は読みやすく区切り、最後に自然なCTAを入れてください。
ハッシュタグは内容に必要な場合だけ候補を出してください。
存在しない体験談や実績は追加しないでください。`,
  },
  {
    id: "youtube-plan",
    title: "YouTube動画企画",
    category: "動画・YouTube",
    sideHustle: "動画副業",
    description: "動画テーマからタイトル、冒頭、構成、サムネイル訴求まで整理します。",
    recommendedAi: "Gemini",
    fields: commonFields("動画テーマ・扱うゲーム/題材", "視聴後にしてほしいこと"),
    prompt: `YouTube動画の企画を作成してください。

動画テーマ: {{topic}}
想定視聴者: {{audience}}
目的: {{goal}}
追加条件・素材: {{notes}}

タイトル案5個、冒頭30秒の設計、全体構成、離脱を防ぐ工夫、サムネイルで伝える一言、概要欄に入れる要素を出してください。
確認できないゲーム仕様・数値・最新情報は断定しないでください。`,
  },
  {
    id: "youtube-script",
    title: "YouTube台本",
    category: "動画・YouTube",
    sideHustle: "動画副業",
    description: "話す内容を導入・本編・まとめへ整理し、自然な口語台本にします。",
    recommendedAi: "Claude",
    fields: commonFields("動画テーマと必ず話す内容", "視聴者に残したい結論"),
    prompt: `YouTube用の話し言葉の台本を作成してください。

テーマ・必須内容: {{topic}}
想定視聴者: {{audience}}
最終的に伝えたい結論: {{goal}}
追加条件・素材: {{notes}}

導入、本編、まとめの順で構成し、冗長な前置きを避けてください。
入力されていない個人的体験やプレイ実績を一人称の事実として作らないでください。`,
  },
  {
    id: "image-prompt",
    title: "画像生成プロンプト",
    category: "画像・デザイン",
    sideHustle: "クリエイティブ",
    description: "用途・雰囲気・構図を整理し、画像AIへ渡しやすい指示へ変換します。",
    recommendedAi: "ChatGPT",
    fields: commonFields("作りたい画像・用途", "画像で最も伝えたいこと"),
    prompt: `画像生成AIへ渡す、明確で再現しやすい画像生成プロンプトを作ってください。

作りたい画像・用途: {{topic}}
想定する見る人: {{audience}}
最も伝えたいこと: {{goal}}
追加条件・素材: {{notes}}

被写体、構図、カメラ距離、表情/ポーズ、背景、光、色調、質感、避ける要素の順に整理してください。
実在ブランドのロゴや第三者の特徴的な商標要素は勝手に追加しないでください。`,
  },
  {
    id: "affiliate-research",
    title: "アフィリエイト企画・比較軸",
    category: "アフィリエイト",
    sideHustle: "アフィリエイト",
    description: "紹介候補を選ぶ前に、読者の判断基準と比較に必要な情報を整理します。",
    recommendedAi: "Gemini",
    fields: commonFields("扱いたいジャンル・商品カテゴリ", "読者の購入判断をどう助けたいか"),
    prompt: `アフィリエイト向けの企画設計をしてください。

ジャンル・商品カテゴリ: {{topic}}
想定読者: {{audience}}
目的: {{goal}}
確認済み情報・制約: {{notes}}

読者の悩み、比較軸、確認すべき一次情報、記事/投稿の構成、誤認を避ける注意点を整理してください。
価格、在庫、評価、キャンペーン、ランキングは最新確認なしに断定しないでください。
実際に使っていない商品を使用経験があるように書かないでください。`,
  },
  {
    id: "product-listing",
    title: "商品・サービス説明文",
    category: "物販・販売",
    sideHustle: "物販",
    description: "確認済みの商品情報から、誤解を招きにくい販売文を作ります。",
    recommendedAi: "ChatGPT",
    fields: commonFields("商品・サービスの確認済み情報", "購入者に理解してほしい価値"),
    prompt: `販売ページ用の商品・サービス説明文を作成してください。

確認済みの商品情報: {{topic}}
想定購入者: {{audience}}
伝えたい価値: {{goal}}
追加条件: {{notes}}

特徴、向いている人、使い方、注意点、購入前に確認すべき点の順に分かりやすく整理してください。
入力されていない仕様、効果、実績、レビュー、保証内容は作らないでください。`,
  },
  {
    id: "crowdwork-proposal",
    title: "クラウドソーシング応募文",
    category: "クラウドソーシング",
    sideHustle: "受託副業",
    description: "案件文と自分の事実情報から、簡潔で読みやすい提案文を作ります。",
    recommendedAi: "Claude",
    fields: commonFields("案件内容・募集要件", "応募で伝えたい強み"),
    prompt: `クラウドソーシング案件への応募文を作成してください。

案件内容・募集要件: {{topic}}
依頼者の想定ニーズ: {{audience}}
伝えたい強み・対応方針: {{goal}}
自分について事実として使える情報: {{notes}}

短い挨拶、要件理解、対応できること、進め方、確認事項の順でまとめてください。
入力されていない経験年数、案件実績、資格、売上、成果は絶対に作らないでください。`,
  },
  {
    id: "market-research",
    title: "市場・競合リサーチ設計",
    category: "リサーチ",
    sideHustle: "共通",
    description: "調べるべき項目と情報源を先に整理し、思いつきだけの調査を防ぎます。",
    recommendedAi: "Gemini",
    fields: commonFields("調査したい市場・テーマ", "調査結果で決めたいこと"),
    prompt: `市場・競合リサーチの計画を作成してください。

調査テーマ: {{topic}}
対象顧客: {{audience}}
調査結果で決めたいこと: {{goal}}
既に分かっている情報: {{notes}}

調査項目、優先して確認する一次情報、競合比較表の項目、判断基準、追加で確認すべき未知情報を整理してください。
最新情報が必要な項目は「Webで最新確認が必要」と明示してください。`,
  },
  {
    id: "work-efficiency",
    title: "作業手順・テンプレート化",
    category: "業務効率化",
    sideHustle: "共通",
    description: "繰り返し作業を分解し、チェックリストと再利用テンプレートへ変換します。",
    recommendedAi: "ChatGPT",
    fields: commonFields("効率化したい作業", "理想の完了状態"),
    prompt: `次の作業を、初心者でも再現しやすい手順へ整理してください。

効率化したい作業: {{topic}}
この手順を使う人: {{audience}}
理想の完了状態: {{goal}}
現在のやり方・制約: {{notes}}

作業を準備・実行・確認・保存の段階へ分解し、チェックリスト、コピペ用テンプレート、失敗しやすい点を出してください。
入力されていない社内ルールや事実は作らないでください。`,
  },
  {
    id: "blog-seo-brief",
    title: "ブログ・SEO記事の構成",
    category: "記事・コンテンツ",
    sideHustle: "ブログ運営",
    description: "検索意図を整理し、読み手の疑問に答える記事構成と確認項目を作ります。",
    recommendedAi: "Gemini",
    fields: commonFields("狙いたいテーマ・検索語", "記事で解決したいこと"),
    prompt: `あなたは日本語のSEO編集者です。
以下の条件から、検索意図に沿った記事構成を作成してください。

テーマ・検索語: {{topic}}
想定読者: {{audience}}
解決したいこと: {{goal}}
確認済み情報・追加条件: {{notes}}

【出力】
- 想定される検索意図
- 読者が先に知りたい結論
- タイトル案5個
- H2/H3構成
- 各見出しで答える疑問
- 一次情報で確認すべき項目
- 公開前チェックリスト

検索順位、検索ボリューム、競合状況など最新確認が必要な情報を推測で断定しないでください。`,
  },
  {
    id: "threads-post-series",
    title: "Threads投稿シリーズ",
    category: "SNS",
    sideHustle: "SNS運用",
    description: "会話調で続けやすいThreads投稿を、複数の切り口へ展開します。",
    recommendedAi: "ChatGPT",
    fields: commonFields("発信テーマ", "反応・プロフィール遷移などの目的"),
    prompt: `Threads向けの投稿シリーズを作成してください。

発信テーマ: {{topic}}
想定読者: {{audience}}
目的: {{goal}}
追加条件・素材: {{notes}}

短い導入、本文、自然な問いかけを基本に5投稿作成し、同じ言い回しの連続を避けてください。
入力されていない実績・経験・収益を一人称の事実として作らないでください。`,
  },
  {
    id: "short-video-script",
    title: "ショート動画・TikTok台本",
    category: "動画・YouTube",
    sideHustle: "ショート動画",
    description: "短尺動画向けに、冒頭フックから結論までを短く整理します。",
    recommendedAi: "Claude",
    fields: commonFields("動画テーマ・素材", "視聴後にしてほしいこと"),
    prompt: `ショート動画用の台本を作成してください。

テーマ・素材: {{topic}}
想定視聴者: {{audience}}
目的: {{goal}}
追加条件: {{notes}}

【出力】
- 冒頭1〜2秒のフック3案
- 30〜60秒を想定した話す順番
- テロップ候補
- 最後のCTA
- サムネイル/カバーに使える短い文言

入力されていない実体験や実績は作らず、最新情報が必要なら確認が必要と明記してください。`,
  },
  {
    id: "youtube-thumbnail-copy",
    title: "YouTubeサムネイル文言",
    category: "動画・YouTube",
    sideHustle: "動画副業",
    description: "動画内容を誇張しすぎず、短く伝わるサムネイル文言へ変換します。",
    recommendedAi: "ChatGPT",
    fields: commonFields("動画内容・見どころ", "最も伝えたい価値"),
    prompt: `YouTubeサムネイル用の短い文言を作成してください。

動画内容・見どころ: {{topic}}
想定視聴者: {{audience}}
最も伝えたい価値: {{goal}}
追加条件: {{notes}}

3〜10文字程度を中心に10案出し、必要に応じて補助文も付けてください。
動画内で扱っていない内容、成果保証、過度な煽り、誤解を招く数字は追加しないでください。`,
  },
  {
    id: "affiliate-comparison-outline",
    title: "アフィリエイト比較記事",
    category: "アフィリエイト",
    sideHustle: "アフィリエイト",
    description: "比較対象と判断軸を整理し、読者が自分で選べる記事構成を作ります。",
    recommendedAi: "Gemini",
    fields: commonFields("比較する商品・サービス", "読者の判断をどう助けたいか"),
    prompt: `アフィリエイト向けの比較記事構成を作成してください。

比較対象: {{topic}}
想定読者: {{audience}}
目的: {{goal}}
確認済み情報・制約: {{notes}}

共通の比較軸、向いている人の違い、確認すべき一次情報、記事構成、表にすると分かりやすい項目を整理してください。
価格、在庫、キャンペーン、レビュー評価、ランキングは最新確認なしに断定しないでください。`,
  },
  {
    id: "flea-market-listing",
    title: "フリマ・EC出品文",
    category: "物販・販売",
    sideHustle: "物販",
    description: "確認済みの商品状態から、読みやすいタイトルと説明文を作ります。",
    recommendedAi: "ChatGPT",
    fields: commonFields("商品名・状態・付属品など", "購入者に正しく伝えたいこと"),
    prompt: `フリマアプリやEC向けの出品文を作成してください。

確認済みの商品情報: {{topic}}
想定購入者: {{audience}}
正しく伝えたいこと: {{goal}}
追加条件: {{notes}}

【出力】
- タイトル候補
- 商品説明
- 状態説明
- 付属品
- 発送前に確認する項目
- 誤解を防ぐ注意書き

入力されていない傷、動作状態、購入時期、定価、使用回数、保証などは作らないでください。`,
  },
  {
    id: "skill-market-service-page",
    title: "スキル販売サービスページ",
    category: "スキル販売",
    sideHustle: "スキル販売",
    description: "ココナラ等を想定し、提供範囲・購入前確認・納品内容を整理します。",
    recommendedAi: "Claude",
    fields: commonFields("提供できる作業・スキル", "購入者に得てほしい状態"),
    prompt: `スキル販売サービスの紹介ページを作成してください。

提供できる作業・スキル: {{topic}}
想定購入者: {{audience}}
購入後に得てほしい状態: {{goal}}
事実として使える経験・条件: {{notes}}

サービス概要、提供範囲、納品物、購入前に必要な情報、対応できないこと、よくある質問を整理してください。
入力されていない資格・経験年数・販売実績・評価を作らないでください。`,
  },
  {
    id: "digital-product-outline",
    title: "デジタル商品・教材設計",
    category: "デジタル商品",
    sideHustle: "教材・テンプレート販売",
    description: "テンプレートや教材の中身を、購入後に実行しやすい単位へ分解します。",
    recommendedAi: "Claude",
    fields: commonFields("販売したい知識・テンプレート", "購入者が完成させたいもの"),
    prompt: `デジタル商品または教材の設計をしてください。

扱う内容: {{topic}}
想定購入者: {{audience}}
購入者が完成させたいもの: {{goal}}
追加条件・素材: {{notes}}

章構成、各章の成果物、ワークシート案、テンプレート案、購入前に伝えるべき前提条件を整理してください。
成果保証や架空の購入実績、存在しない利用者の声は作らないでください。`,
  },
  {
    id: "client-outreach-message",
    title: "営業DM・問い合わせ文",
    category: "顧客対応・営業",
    sideHustle: "営業・受託",
    description: "相手の状況と自分が提供できることを分け、押し売りになりにくい連絡文を作ります。",
    recommendedAi: "ChatGPT",
    fields: commonFields("相手・案件・連絡の背景", "今回提案したいこと"),
    prompt: `営業DMまたは問い合わせ文を作成してください。

相手・背景: {{topic}}
想定する相手の状況: {{audience}}
今回提案したいこと: {{goal}}
自分について事実として使える情報: {{notes}}

短い挨拶、連絡理由、相手に関係する価値、提案内容、返信しやすい確認事項の順で作成してください。
一斉送信感の強い煽り、虚偽の実績、存在しない取引実績は追加しないでください。`,
  },
  {
    id: "fact-check-research",
    title: "事実確認・情報整理",
    category: "リサーチ",
    sideHustle: "共通",
    description: "公開前に確認すべき事実・一次情報・更新日を整理します。",
    recommendedAi: "Gemini",
    fields: commonFields("確認したい主張・テーマ", "確認結果を何に使うか"),
    prompt: `公開前の事実確認計画を作成してください。

確認したい主張・テーマ: {{topic}}
想定読者: {{audience}}
確認結果の用途: {{goal}}
既に持っている資料・条件: {{notes}}

主張を検証可能な単位へ分け、優先する一次情報、更新日の確認、複数ソース照合が必要な箇所、断定を避けるべき箇所を整理してください。
未確認の情報を事実として補完しないでください。`,
  },
  {
    id: "repeatable-sop",
    title: "繰り返し作業のSOP化",
    category: "業務効率化",
    sideHustle: "共通",
    description: "毎回迷う作業を、準備・実行・確認・保存の標準手順へ変換します。",
    recommendedAi: "ChatGPT",
    fields: commonFields("標準化したい作業", "完了の判断基準"),
    prompt: `繰り返し作業をSOP（標準作業手順）へ変換してください。

対象作業: {{topic}}
この手順を使う人: {{audience}}
完了の判断基準: {{goal}}
現在のやり方・制約: {{notes}}

準備、実行、確認、保存、次回への引き継ぎの順で、手順・チェック項目・例外時の判断基準・再利用テンプレートを作成してください。
入力されていない社内規定や権限を勝手に作らないでください。`,
  }
] as const;

export const ACTION_PROMPT_CATEGORIES = [
  "すべて",
  ...Array.from(new Set(ACTION_PROMPT_TEMPLATES.map((template) => template.category))),
] as const;

export function buildActionPrompt(
  template: ActionPromptTemplate,
  values: Record<string, string>,
): string {
  return template.prompt.replace(/\{\{([a-zA-Z0-9_-]+)\}\}/g, (_match, key: string) => {
    const value = values[key]?.trim();
    return value || "未指定";
  });
}
