import { actionPromptCategoryGuidance } from "@/lib/action-prompt-category-guidance";
import { actionPromptResearchGuidance } from "@/lib/action-prompt-research-guidance";
import { actionPromptTemplateGuidance } from "@/lib/action-prompt-template-guidance";

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


const ACTION_PROMPT_ACCURACY_LAYER = `【全体精度ルール】
- ユーザーが入力した事実・条件・禁止事項を最優先し、勝手に変更しない。
- 「未指定」の項目は未知として扱い、実績・経験・数値・価格・仕様・人物設定などを事実として補完しない。
- 不足情報があっても作業を止めず、一般論・提案・仮定で補える箇所は「提案」「例」「仮定」と分かる形で示す。
- 最新性が重要な価格、法律、規約、仕様、ランキング、在庫、統計、キャンペーン等は、確認できる環境なら一次情報を優先して確認し、確認できない場合は「要確認」と明示する。
- 事実、推測、提案、例を混同しない。根拠のない断定、成果保証、架空のレビュー・実績・体験談を作らない。
- 想定読者と目的に合わない一般論を増やさず、最終的にそのまま使える具体的な完成物を優先する。
- 指定された出力形式・文字数・媒体・トーン・禁止事項がある場合は必ず守る。指示が競合する場合はユーザーの具体的な条件を優先する。
- 重複、矛盾、抜け、前後不一致、不自然な固有名詞や数値がないか回答前に確認する。
- 日本語は自然で簡潔にし、冗長な前置きや同じ内容の言い換えを減らす。
- 内部の思考過程は出力せず、完成物・判断に必要な注記・確認事項だけを提示する。

【完成前チェック】
1. 入力条件をすべて反映したか
2. 未確認情報を事実として作っていないか
3. 読者・目的・媒体に最適化されているか
4. 出力項目に抜けや重複がないか
5. そのまま使用または次工程へ渡せる具体性があるか`;

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
    id: "comic-4koma-creator",
    title: "四コマ漫画作成",
    category: "漫画・コミック",
    sideHustle: "漫画制作",
    description: "テーマ・登場人物・オチから、4コマの構成、セリフ、演出、作画指示までまとめます。",
    recommendedAi: "ChatGPT",
    fields: [
      { key: "theme", label: "テーマ", placeholder: "例：副業あるある、学校生活、恋愛のすれ違い" },
      { key: "genre", label: "ジャンル", placeholder: "一覧から選ぶか、その他を自由入力", options: ["ギャグ", "日常", "恋愛", "ビジネス", "学習", "感動", "シュール"] },
      { key: "characters", label: "登場人物", placeholder: "例：主人公、同僚、友人。性格や関係性も入力" },
      { key: "setting", label: "舞台・状況", placeholder: "例：会社、自宅、学校、カフェ" },
      { key: "ending", label: "オチの方向性", placeholder: "一覧から選ぶか、その他を自由入力", options: ["笑い", "共感", "驚き", "ほっこり", "皮肉", "学び"] },
      { key: "style", label: "作画の雰囲気", placeholder: "例：親しみやすい2D漫画風、シンプルな線画" },
      { key: "color", label: "色", placeholder: "一覧から選ぶか、その他を自由入力", options: ["カラー", "モノクロ", "どちらでも可"] },
      { key: "notes", label: "追加条件", placeholder: "対象読者、セリフ量、避けたい表現、用途など", multiline: true },
    ],
    prompt: `あなたは漫画編集者兼シナリオライターです。
以下の条件をもとに、読みやすくオチが伝わる四コマ漫画案を作成してください。

テーマ: {{theme}}
ジャンル: {{genre}}
登場人物: {{characters}}
舞台・状況: {{setting}}
オチの方向性: {{ending}}
作画の雰囲気: {{style}}
色: {{color}}
追加条件: {{notes}}

【出力】
1. タイトル案3つ
2. 四コマ全体の狙い
3. 1コマ目〜4コマ目それぞれの役割
4. 各コマの画面構成・人物の表情・ポーズ・背景
5. 各コマのセリフ・吹き出し
6. 4コマを1枚にまとめて画像生成AIへ渡す場合の作画プロンプト
7. コマごとに個別生成する場合の4本の作画プロンプト
8. キャラクターの見た目を全コマで統一するための固定設定

【ルール】
- 入力されていない固有の実績・体験・事実は作らない。
- 既存作品・実在作家・既存キャラクターの固有デザインを模倣する指示は作らない。
- 各コマで人物の髪型、服装、色、年齢感、特徴が変わらないよう明示する。
- セリフは読みやすく、1コマに情報を詰め込みすぎない。`,
  },
  {
    id: "comic-name-creator",
    title: "漫画ネーム作成",
    category: "漫画・コミック",
    sideHustle: "漫画制作",
    description: "物語をページ単位・コマ単位へ分解し、ネーム、セリフ、演出、見せ場を設計します。",
    recommendedAi: "Claude",
    fields: [
      { key: "theme", label: "作品テーマ", placeholder: "例：挑戦、友情、失敗からの成長" },
      { key: "genre", label: "ジャンル", placeholder: "一覧から選ぶか、その他を自由入力", options: ["日常", "ギャグ", "恋愛", "学園", "ビジネス", "ファンタジー", "エッセイ漫画"] },
      { key: "characters", label: "登場人物", placeholder: "主人公、相手役など。性格・目的・関係性も入力", multiline: true },
      { key: "story", label: "ストーリー概要", placeholder: "開始時点、起きる出来事、結末までの概要", multiline: true },
      { key: "pages", label: "ページ数", placeholder: "一覧から選ぶか、その他を自由入力", options: ["4ページ", "8ページ", "16ページ", "24ページ", "32ページ"] },
      { key: "tone", label: "雰囲気", placeholder: "一覧から選ぶか、その他を自由入力", options: ["テンポ重視", "感情重視", "読みやすさ重視", "ギャグ強め", "シリアス"] },
      { key: "notes", label: "追加条件", placeholder: "対象読者、入れたい場面、避けたい展開など", multiline: true },
    ],
    prompt: `あなたは漫画編集者兼ネーム構成担当です。
以下の条件をもとに、漫画のネーム案を作成してください。

作品テーマ: {{theme}}
ジャンル: {{genre}}
登場人物: {{characters}}
ストーリー概要: {{story}}
ページ数: {{pages}}
雰囲気: {{tone}}
追加条件: {{notes}}

【出力】
1. 作品の核となる一文
2. 起承転結または最適なストーリー構造
3. ページごとの役割
4. 各ページのコマ数
5. 各コマの構図・人物配置・視線誘導
6. 各コマのセリフ・ナレーション
7. 見開きや大コマにするべき見せ場
8. ページをめくりたくなる引き
9. 作画時の注意点

【ルール】
- ページ数の範囲内で無理なく読める情報量にする。
- 入力されていない事実や実体験を勝手に追加しない。
- 既存漫画の具体的なコマ割りや固有演出の模倣を前提にしない。
- 同じキャラクターの口調・性格・外見設定が途中で変わらないようにする。`,
  },
  {
    id: "comic-one-page-creator",
    title: "1ページ漫画作成",
    category: "漫画・コミック",
    sideHustle: "漫画制作",
    description: "SNSや記事挿絵にも使いやすい、1ページ完結漫画の構成と作画指示を作ります。",
    recommendedAi: "ChatGPT",
    fields: [
      { key: "theme", label: "テーマ", placeholder: "例：仕事あるある、失敗談、学び、商品説明" },
      { key: "purpose", label: "用途", placeholder: "一覧から選ぶか、その他を自由入力", options: ["SNS投稿", "note挿絵", "ブログ", "教育・解説", "商品・サービス説明", "共感獲得"] },
      { key: "characters", label: "登場人物", placeholder: "登場人物と関係性、性格、見た目の特徴" },
      { key: "setting", label: "舞台", placeholder: "例：自宅、職場、学校、店内" },
      { key: "frames", label: "コマ数", placeholder: "一覧から選ぶか、その他を自由入力", options: ["4コマ", "6コマ", "8コマ", "AIに最適数を提案させる"] },
      { key: "style", label: "作画の雰囲気", placeholder: "例：柔らかい2D漫画風、シンプル、コミカル" },
      { key: "notes", label: "追加条件", placeholder: "伝えたい結論、セリフ量、縦横比、対象読者など", multiline: true },
    ],
    prompt: `あなたは1ページ漫画の構成作家です。
以下の条件から、1ページで内容が完結する漫画案を作成してください。

テーマ: {{theme}}
用途: {{purpose}}
登場人物: {{characters}}
舞台: {{setting}}
コマ数: {{frames}}
作画の雰囲気: {{style}}
追加条件: {{notes}}

【出力】
1. タイトル案3つ
2. 1ページ全体の流れ
3. 各コマの役割
4. 各コマの構図・人物・背景・表情
5. セリフ・吹き出し・ナレーション
6. 読む順番が迷わない配置案
7. 1ページ全体を生成する画像AI向けプロンプト
8. 必要ならコマ別の画像AI向けプロンプト

【ルール】
- 最後のコマでテーマまたは結論が伝わる構成にする。
- セリフを詰め込みすぎず、絵で伝えられる情報は絵へ回す。
- キャラクターの外見・衣装・色を全コマで統一する。
- 実在ブランドのロゴや既存キャラクターの固有意匠を勝手に追加しない。`,
  },
  {
    id: "comic-dialogue-creator",
    title: "漫画セリフ作成",
    category: "漫画・コミック",
    sideHustle: "漫画制作",
    description: "キャラクター設定と場面に合わせ、漫画で読みやすい会話・吹き出し・短縮版を作ります。",
    recommendedAi: "Claude",
    fields: [
      { key: "scene", label: "場面", placeholder: "例：初対面、告白前、失敗直後、会議中、ボケとツッコミ" },
      { key: "characters", label: "登場人物と口調", placeholder: "人物名、性格、関係性、口調を入力", multiline: true },
      { key: "emotion", label: "中心となる感情", placeholder: "一覧から選ぶか、その他を自由入力", options: ["喜び", "怒り", "悲しみ", "驚き", "不安", "照れ", "緊張", "冷静"] },
      { key: "goal", label: "会話の目的", placeholder: "例：笑わせたい、誤解を解きたい、気持ちを伝えたい" },
      { key: "tone", label: "会話のトーン", placeholder: "一覧から選ぶか、その他を自由入力", options: ["自然", "コミカル", "シリアス", "テンポ重視", "感情重視"] },
      { key: "length", label: "セリフ量", placeholder: "一覧から選ぶか、その他を自由入力", options: ["短め", "標準", "多め"] },
      { key: "notes", label: "追加条件", placeholder: "コマ数、避けたい言葉、対象年齢、語尾の特徴など", multiline: true },
    ],
    prompt: `あなたは漫画脚本家です。
以下の条件をもとに、漫画の吹き出しへ入れやすい自然なセリフを作成してください。

場面: {{scene}}
登場人物と口調: {{characters}}
中心となる感情: {{emotion}}
会話の目的: {{goal}}
会話のトーン: {{tone}}
セリフ量: {{length}}
追加条件: {{notes}}

【出力】
1. 場面の意図
2. 登場人物ごとの話し方のルール
3. 完成会話案
4. 各セリフに合う表情・間・リアクション
5. 吹き出しへ収めやすい短縮版
6. 別ニュアンスの言い換え案

【ルール】
- キャラクターごとの口調を混同しない。
- 説明台詞を増やしすぎず、自然な会話を優先する。
- 入力されていない事実・実績・人物設定は勝手に断定しない。
- 年齢や用途に合わない過度な表現を自動追加しない。`,
  },
{
  "id": "adult-affiliate-offer-research",
  "title": "アダアフィ案件・ASP比較",
  "category": "アダアフィ",
  "sideHustle": "成人向けアフィリエイト",
  "description": "成人向けアフィリエイト案件を、報酬だけでなく対象者・訴求条件・規約・導線・確認事項まで共通軸で比較します。",
  "recommendedAi": "Gemini",
  "fields": [
    {
      "key": "offers",
      "label": "比較する案件・ASP情報",
      "placeholder": "案件名、カテゴリ、確認済み条件、報酬条件など",
      "multiline": true
    },
    {
      "key": "audience",
      "label": "想定読者",
      "placeholder": "18歳以上の想定読者像。年齢層・悩み・利用目的など"
    },
    {
      "key": "channel",
      "label": "主な集客媒体",
      "placeholder": "一覧から選ぶか自由入力",
      "options": [
        "SEOブログ",
        "X",
        "SNS複合",
        "メール/既存読者",
        "その他"
      ]
    },
    {
      "key": "goal",
      "label": "比較の目的",
      "placeholder": "収益性、成約しやすさ、運用安全性、初心者向け等"
    },
    {
      "key": "notes",
      "label": "追加条件",
      "placeholder": "公式情報、避けたい案件、確認日、広告表記条件など",
      "multiline": true
    }
  ],
  "prompt": "あなたは成人向けアフィリエイト案件の比較編集者兼コンプライアンス確認担当です。\n以下の確認済み情報を使い、案件・ASPを同じ基準で比較してください。\n\n比較対象: {{offers}}\n想定読者: {{audience}}\n主な集客媒体: {{channel}}\n比較の目的: {{goal}}\n追加条件: {{notes}}\n\n【出力】\n1. 比較前提と不足情報\n2. 共通比較軸\n3. 案件ごとの特徴・制約・確認事項\n4. 向いている運用パターン\n5. 規約・年齢制限・広告表記の要確認項目\n6. 収益性を判断するために追加確認すべき数値\n7. 最終判断用チェックリスト\n\n【安全・規約ルール】\n- 対象は18歳以上の成人向けアフィリエイト運用に限定する。\n- 未成年、年齢不明の人物、非同意、搾取、違法行為、性的サービスの勧誘・売買を扱わない。\n- 露骨な性的描写や性的興奮を目的とする文章・画像生成指示は作らず、商品・作品・サービスの説明は非露骨で業務的な表現にする。\n- 媒体規約の回避、年齢制限の回避、審査・BAN回避の手順は提案しない。\n- 広告・PR・アフィリエイトであることが一般消費者に分かる明瞭な表示を前提とする。\n- 媒体仕様・法令・広告ポリシーは変更されうるため、最新の公式情報を確認できない場合は要確認と明示する。"
},
{
  "id": "adult-affiliate-seo-brief",
  "title": "アダアフィSEO記事構成",
  "category": "アダアフィ",
  "sideHustle": "成人向けアフィリエイト",
  "description": "成人向け案件の比較・選び方・紹介記事を、非露骨な表現と広告表示を前提にSEO向けに構成します。",
  "recommendedAi": "Gemini",
  "fields": [
    {
      "key": "keyword",
      "label": "テーマ・検索語",
      "placeholder": "例：成人向けサービスの比較、選び方、料金の確認方法"
    },
    {
      "key": "audience",
      "label": "想定読者",
      "placeholder": "18歳以上の読者像と検索意図"
    },
    {
      "key": "offer",
      "label": "紹介対象・確認済み情報",
      "placeholder": "紹介対象、公式仕様、料金、条件など",
      "multiline": true
    },
    {
      "key": "goal",
      "label": "記事の目的",
      "placeholder": "比較、選び方支援、公式情報への導線など"
    },
    {
      "key": "notes",
      "label": "追加条件",
      "placeholder": "避けたい表現、広告表記、最新確認が必要な項目など",
      "multiline": true
    }
  ],
  "prompt": "あなたは成人向けアフィリエイト領域のSEO編集者です。\n露骨な性的描写を避け、18歳以上の読者がサービス・作品・商品を比較検討できる記事構成を作成してください。\n\nテーマ・検索語: {{keyword}}\n想定読者: {{audience}}\n紹介対象・確認済み情報: {{offer}}\n記事の目的: {{goal}}\n追加条件: {{notes}}\n\n【出力】\n1. 検索意図\n2. 読者が最初に知りたい結論\n3. タイトル候補5案\n4. H2/H3構成\n5. 各見出しで扱う確認済み情報・要確認情報\n6. 比較表に入れる共通項目\n7. 広告/PR表示を置くべき位置\n8. 公開前の規約・年齢・最新情報チェック\n\n【安全・規約ルール】\n- 対象は18歳以上の成人向けアフィリエイト運用に限定する。\n- 未成年、年齢不明の人物、非同意、搾取、違法行為、性的サービスの勧誘・売買を扱わない。\n- 露骨な性的描写や性的興奮を目的とする文章・画像生成指示は作らず、商品・作品・サービスの説明は非露骨で業務的な表現にする。\n- 媒体規約の回避、年齢制限の回避、審査・BAN回避の手順は提案しない。\n- 広告・PR・アフィリエイトであることが一般消費者に分かる明瞭な表示を前提とする。\n- 媒体仕様・法令・広告ポリシーは変更されうるため、最新の公式情報を確認できない場合は要確認と明示する。"
},
{
  "id": "adult-affiliate-x-plan",
  "title": "アダアフィX投稿企画",
  "category": "アダアフィ",
  "sideHustle": "成人向けアフィリエイト",
  "description": "Xの成人向けコンテンツ規則を前提に、非露骨な投稿テーマ・導線・運用チェックを設計します。",
  "recommendedAi": "ChatGPT",
  "fields": [
    {
      "key": "topic",
      "label": "発信テーマ",
      "placeholder": "成人向け作品・サービスの比較、更新情報、選び方など"
    },
    {
      "key": "audience",
      "label": "想定読者",
      "placeholder": "18歳以上のフォロワー像"
    },
    {
      "key": "offer",
      "label": "紹介対象・確認済み情報",
      "placeholder": "紹介対象と事実として使える情報",
      "multiline": true
    },
    {
      "key": "goal",
      "label": "投稿目的",
      "placeholder": "プロフィール遷移、記事閲覧、比較記事への導線など"
    },
    {
      "key": "notes",
      "label": "追加条件",
      "placeholder": "アカウント方針、メディア有無、広告表記、避けたい表現など",
      "multiline": true
    }
  ],
  "prompt": "あなたは成人向けアフィリエイトのX運用編集者です。\nXの最新成人向けコンテンツポリシー、センシティブメディア設定、年齢制限、広告表示を前提に、非露骨な投稿企画を作成してください。\n\n発信テーマ: {{topic}}\n想定読者: {{audience}}\n紹介対象・確認済み情報: {{offer}}\n投稿目的: {{goal}}\n追加条件: {{notes}}\n\n【出力】\n1. 投稿の柱3〜5個\n2. 非露骨な投稿本文案5本\n3. 広告/PR表示の入れ方\n4. 画像・動画を使う場合の媒体規約チェック\n5. プロフィールやヘッダーに置かない方がよい成人向け要素\n6. 自然なCTA\n7. 投稿前チェックリスト\n\n【安全・規約ルール】\n- 対象は18歳以上の成人向けアフィリエイト運用に限定する。\n- 未成年、年齢不明の人物、非同意、搾取、違法行為、性的サービスの勧誘・売買を扱わない。\n- 露骨な性的描写や性的興奮を目的とする文章・画像生成指示は作らず、商品・作品・サービスの説明は非露骨で業務的な表現にする。\n- 媒体規約の回避、年齢制限の回避、審査・BAN回避の手順は提案しない。\n- 広告・PR・アフィリエイトであることが一般消費者に分かる明瞭な表示を前提とする。\n- 媒体仕様・法令・広告ポリシーは変更されうるため、最新の公式情報を確認できない場合は要確認と明示する。\n- 成人向けメディアを扱う場合、X上で必要な内容警告・設定を最新公式ルールで確認する。"
},
{
  "id": "adult-affiliate-lp-flow",
  "title": "アダアフィLP・導線設計",
  "category": "アダアフィ",
  "sideHustle": "成人向けアフィリエイト",
  "description": "成人向け案件のLPや比較記事から公式ページまでの導線を、誤認防止・年齢配慮・広告表示込みで設計します。",
  "recommendedAi": "Claude",
  "fields": [
    {
      "key": "offer",
      "label": "紹介対象",
      "placeholder": "案件・サービス・商品と確認済み情報",
      "multiline": true
    },
    {
      "key": "audience",
      "label": "想定読者",
      "placeholder": "18歳以上の読者像と検討段階"
    },
    {
      "key": "traffic",
      "label": "流入元",
      "placeholder": "SEO、X、既存読者、その他"
    },
    {
      "key": "goal",
      "label": "最終行動",
      "placeholder": "公式ページ確認、比較、登録検討など"
    },
    {
      "key": "notes",
      "label": "追加条件",
      "placeholder": "広告表記、年齢確認、禁止表現、掲載媒体など",
      "multiline": true
    }
  ],
  "prompt": "あなたは成人向けアフィリエイトのLP・導線設計者です。\n読者を煽って急がせるのではなく、18歳以上の読者が内容・条件・注意点を理解したうえで公式情報へ進める導線を設計してください。\n\n紹介対象: {{offer}}\n想定読者: {{audience}}\n流入元: {{traffic}}\n最終行動: {{goal}}\n追加条件: {{notes}}\n\n【出力】\n1. 読者の検討段階\n2. ファーストビューで伝える内容\n3. セクション構成\n4. 比較・注意点・対象外の配置\n5. 広告/PR表示と年齢配慮\n6. CTAの文言と配置\n7. 公式ページへ渡す前の確認事項\n8. 誤認・離脱・規約違反を防ぐチェック\n\n【安全・規約ルール】\n- 対象は18歳以上の成人向けアフィリエイト運用に限定する。\n- 未成年、年齢不明の人物、非同意、搾取、違法行為、性的サービスの勧誘・売買を扱わない。\n- 露骨な性的描写や性的興奮を目的とする文章・画像生成指示は作らず、商品・作品・サービスの説明は非露骨で業務的な表現にする。\n- 媒体規約の回避、年齢制限の回避、審査・BAN回避の手順は提案しない。\n- 広告・PR・アフィリエイトであることが一般消費者に分かる明瞭な表示を前提とする。\n- 媒体仕様・法令・広告ポリシーは変更されうるため、最新の公式情報を確認できない場合は要確認と明示する。"
},
{
  "id": "adult-affiliate-compliance-check",
  "title": "アダアフィ広告表記・媒体規約チェック",
  "category": "アダアフィ",
  "sideHustle": "成人向けアフィリエイト",
  "description": "投稿・記事・LPの広告表示、年齢制限、媒体ごとの成人向けポリシー、最新確認項目を監査します。",
  "recommendedAi": "Gemini",
  "fields": [
    {
      "key": "content",
      "label": "確認したい投稿・記事・LP",
      "placeholder": "確認対象の文章・構成・掲載内容",
      "multiline": true
    },
    {
      "key": "platform",
      "label": "掲載媒体",
      "placeholder": "一覧から選ぶか自由入力",
      "options": [
        "X",
        "SEOブログ/サイト",
        "Google広告",
        "Instagram/Meta",
        "その他"
      ]
    },
    {
      "key": "offer",
      "label": "紹介対象",
      "placeholder": "案件・商品・サービスの種類と確認済み情報",
      "multiline": true
    },
    {
      "key": "jurisdiction",
      "label": "対象地域",
      "placeholder": "例：日本"
    },
    {
      "key": "notes",
      "label": "追加条件",
      "placeholder": "現在確認している公式規約URLや運用条件など",
      "multiline": true
    }
  ],
  "prompt": "あなたは成人向けアフィリエイトの広告表示・媒体ポリシー監査担当です。\n以下の内容を、最新公式情報を優先して確認する前提で監査してください。\n\n確認対象: {{content}}\n掲載媒体: {{platform}}\n紹介対象: {{offer}}\n対象地域: {{jurisdiction}}\n追加条件: {{notes}}\n\n【出力】\n1. 確認済み事項\n2. 最新公式情報の確認が必要な事項\n3. 広告/PR表示の明瞭性\n4. 年齢制限・未成年への露出リスク\n5. 媒体固有の掲載制限\n6. 修正優先度：高/中/低\n7. 修正文案（非露骨な範囲）\n8. 公開前チェックリスト\n\n【安全・規約ルール】\n- 対象は18歳以上の成人向けアフィリエイト運用に限定する。\n- 未成年、年齢不明の人物、非同意、搾取、違法行為、性的サービスの勧誘・売買を扱わない。\n- 露骨な性的描写や性的興奮を目的とする文章・画像生成指示は作らず、商品・作品・サービスの説明は非露骨で業務的な表現にする。\n- 媒体規約の回避、年齢制限の回避、審査・BAN回避の手順は提案しない。\n- 広告・PR・アフィリエイトであることが一般消費者に分かる明瞭な表示を前提とする。\n- 媒体仕様・法令・広告ポリシーは変更されうるため、最新の公式情報を確認できない場合は要確認と明示する。\n- 規約回避策ではなく、規約に適合する修正だけを提案する。"
},
{
  "id": "adult-affiliate-conversion-review",
  "title": "アダアフィCV改善・テスト設計",
  "category": "アダアフィ",
  "sideHustle": "成人向けアフィリエイト",
  "description": "実測データから導線のボトルネックを整理し、規約順守のA/Bテスト案を作ります。",
  "recommendedAi": "ChatGPT",
  "fields": [
    {
      "key": "funnel",
      "label": "現在の導線",
      "placeholder": "流入→記事→CTA→公式ページなど",
      "multiline": true
    },
    {
      "key": "metrics",
      "label": "実測データ",
      "placeholder": "PV、CTR、離脱箇所、CV等。確認済み数値のみ",
      "multiline": true
    },
    {
      "key": "audience",
      "label": "想定読者",
      "placeholder": "18歳以上の読者像"
    },
    {
      "key": "goal",
      "label": "改善したい指標",
      "placeholder": "CTR、記事回遊、公式ページ遷移など"
    },
    {
      "key": "notes",
      "label": "追加条件",
      "placeholder": "変更できない箇所、媒体規約、広告表記条件など",
      "multiline": true
    }
  ],
  "prompt": "あなたは成人向けアフィリエイトのコンバージョン改善担当です。\n確認済みの実測データだけを使い、規約順守の範囲で改善仮説とテスト案を作成してください。\n\n現在の導線: {{funnel}}\n実測データ: {{metrics}}\n想定読者: {{audience}}\n改善したい指標: {{goal}}\n追加条件: {{notes}}\n\n【出力】\n1. 現状のボトルネック候補\n2. データから言えること/言えないこと\n3. 優先順位付き改善仮説\n4. A/Bテスト案\n5. 測定指標と判定条件\n6. 広告表記・年齢配慮を壊さない確認項目\n7. 次に収集すべきデータ\n\n【安全・規約ルール】\n- 対象は18歳以上の成人向けアフィリエイト運用に限定する。\n- 未成年、年齢不明の人物、非同意、搾取、違法行為、性的サービスの勧誘・売買を扱わない。\n- 露骨な性的描写や性的興奮を目的とする文章・画像生成指示は作らず、商品・作品・サービスの説明は非露骨で業務的な表現にする。\n- 媒体規約の回避、年齢制限の回避、審査・BAN回避の手順は提案しない。\n- 広告・PR・アフィリエイトであることが一般消費者に分かる明瞭な表示を前提とする。\n- 媒体仕様・法令・広告ポリシーは変更されうるため、最新の公式情報を確認できない場合は要確認と明示する。\n- 年齢制限や媒体審査を回避するための改善は提案しない。"
},
{
  "id": "adult-affiliate-content-calendar",
  "title": "アダアフィコンテンツ計画",
  "category": "アダアフィ",
  "sideHustle": "成人向けアフィリエイト",
  "description": "SEO・Xなど複数チャネルのコンテンツを、比較・選び方・更新情報・導線の役割に分けて計画します。",
  "recommendedAi": "Claude",
  "fields": [
    {
      "key": "niche",
      "label": "扱うテーマ・案件領域",
      "placeholder": "非露骨なカテゴリ説明で入力"
    },
    {
      "key": "audience",
      "label": "想定読者",
      "placeholder": "18歳以上の読者像"
    },
    {
      "key": "channels",
      "label": "使用チャネル",
      "placeholder": "SEOブログ、X、その他"
    },
    {
      "key": "goal",
      "label": "運用目的",
      "placeholder": "検索流入、比較記事への導線、既存読者の回遊など"
    },
    {
      "key": "notes",
      "label": "追加条件",
      "placeholder": "更新頻度、使える素材、広告表記、規約条件など",
      "multiline": true
    }
  ],
  "prompt": "あなたは成人向けアフィリエイトのコンテンツ戦略担当です。\n露骨な性的内容に依存せず、比較・選び方・公式情報・更新情報・FAQなど、18歳以上の読者に役立つコンテンツ計画を作成してください。\n\n扱うテーマ: {{niche}}\n想定読者: {{audience}}\n使用チャネル: {{channels}}\n運用目的: {{goal}}\n追加条件: {{notes}}\n\n【出力】\n1. コンテンツの柱\n2. チャネルごとの役割\n3. 4週間分の企画案\n4. SEO記事とSNS投稿の連携\n5. 更新確認が必要な情報\n6. 広告/PR表示・年齢配慮\n7. 再利用できるテンプレート\n8. 効果測定項目\n\n【安全・規約ルール】\n- 対象は18歳以上の成人向けアフィリエイト運用に限定する。\n- 未成年、年齢不明の人物、非同意、搾取、違法行為、性的サービスの勧誘・売買を扱わない。\n- 露骨な性的描写や性的興奮を目的とする文章・画像生成指示は作らず、商品・作品・サービスの説明は非露骨で業務的な表現にする。\n- 媒体規約の回避、年齢制限の回避、審査・BAN回避の手順は提案しない。\n- 広告・PR・アフィリエイトであることが一般消費者に分かる明瞭な表示を前提とする。\n- 媒体仕様・法令・広告ポリシーは変更されうるため、最新の公式情報を確認できない場合は要確認と明示する。"
},
{
  "id": "adult-affiliate-site-architecture",
  "title": "アダアフィサイト設計・カテゴリ構成",
  "category": "アダアフィ",
  "sideHustle": "成人向けアフィリエイト",
  "description": "成人向けアフィリエイトサイトの情報設計を、読者導線・比較軸・年齢配慮・広告表示込みで整理します。",
  "recommendedAi": "Gemini",
  "fields": [
    {
      "key": "niche",
      "label": "サイトテーマ",
      "placeholder": "扱う成人向けサービス・作品・商品の領域を非露骨に入力"
    },
    {
      "key": "audience",
      "label": "想定読者",
      "placeholder": "18歳以上の読者像と主な悩み"
    },
    {
      "key": "offers",
      "label": "扱う案件・コンテンツ",
      "placeholder": "確認済みの案件カテゴリや記事タイプ",
      "multiline": true
    },
    {
      "key": "goal",
      "label": "サイトの目的",
      "placeholder": "比較支援、情報整理、公式情報への導線など"
    },
    {
      "key": "notes",
      "label": "追加条件",
      "placeholder": "既存記事、サイト規模、年齢配慮、広告表示など",
      "multiline": true
    }
  ],
  "prompt": "あなたは成人向けアフィリエイトサイトの情報設計者です。\n18歳以上の読者が迷わず必要な情報へ到達できる、非露骨で規約順守のサイト構造を作成してください。\n\nサイトテーマ: {{niche}}\n想定読者: {{audience}}\n扱う案件・コンテンツ: {{offers}}\nサイトの目的: {{goal}}\n追加条件: {{notes}}\n\n【出力】\n1. サイトの主カテゴリ\n2. 各カテゴリの役割\n3. 記事タイプと内部リンク\n4. 比較記事・個別記事・FAQの関係\n5. 広告/PR表示を明瞭にする位置\n6. 年齢配慮・媒体規約の確認ポイント\n7. 更新頻度が高い情報の管理方法\n8. 重複記事を防ぐルール\n\n【安全・規約ルール】\n- 対象は18歳以上の成人向けアフィリエイト運用に限定する。\n- 未成年、年齢不明の人物、非同意、搾取、違法行為、性的サービスの勧誘・売買を扱わない。\n- 露骨な性的描写や性的興奮を目的とする文章・画像生成指示は作らず、商品・作品・サービスの説明は非露骨で業務的な表現にする。\n- 媒体規約の回避、年齢制限の回避、審査・BAN回避の手順は提案しない。\n- 広告・PR・アフィリエイトであることが一般消費者に分かる明瞭な表示を前提とする。\n- 媒体仕様・法令・広告ポリシーは変更されうるため、最新の公式情報を確認できない場合は要確認と明示する。"
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
  const resolvedPrompt = template.prompt.replace(/\{\{([a-zA-Z0-9_-]+)\}\}/g, (_match, key: string) => {
    const value = values[key]?.trim();
    return value || "未指定";
  }).trim();

  return [
    resolvedPrompt,
    ACTION_PROMPT_ACCURACY_LAYER,
    actionPromptCategoryGuidance({ category: template.category, title: template.title, sideHustle: template.sideHustle }),
    actionPromptResearchGuidance({ category: template.category, title: template.title, sideHustle: template.sideHustle }),
    actionPromptTemplateGuidance({ id: template.id, category: template.category, title: template.title, sideHustle: template.sideHustle }),
  ].filter(Boolean).join("\n\n");
}
