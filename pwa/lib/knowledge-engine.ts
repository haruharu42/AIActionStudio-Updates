import { PROMOTION_COMMON_KNOWLEDGE, PROMOTION_PUBLICATION_KNOWLEDGE } from "@/lib/promotion-knowledge";

export type KnowledgeKind = "age" | "genre" | "subgenre" | "publication" | "task" | "combination";

export const KNOWLEDGE_TASKS = [
  "title",
  "article",
  "image",
  "social",
  "promotion",
  "sidejob_content",
  "sidejob_sns",
  "sidejob_video",
  "sidejob_affiliate",
  "sidejob_resale",
  "sidejob_crowdsourcing",
  "sidejob_skill_sales",
  "sidejob_digital_product",
  "sidejob_outreach",
  "sidejob_research",
  "sidejob_efficiency",
  "sidejob_planning",
] as const;

export type KnowledgeTask = (typeof KNOWLEDGE_TASKS)[number];

export function isKnowledgeTask(value: unknown): value is KnowledgeTask {
  return typeof value === "string" && (KNOWLEDGE_TASKS as readonly string[]).includes(value);
}

export type KnowledgeRule = {
  key: string;
  kind: KnowledgeKind;
  label: string;
  parentLabel?: string | null;
  aliases?: string[];
  guidance: string[];
  deliverables: string[];
  cautions: string[];
  tasks?: KnowledgeTask[];
  priority: number;
  source: "seed" | "cloud";
  catalogVersion?: number;
  sourceUrls?: string[];
  sourceSummary?: string;
  sourceCheckedAt?: string | null;
};

export type KnowledgeCompileInput = {
  task: KnowledgeTask;
  publicationTarget?: string;
  articleType?: "free" | "paid" | string;
  ageGroup?: string;
  genre?: string;
  subgenre?: string;
  audience?: string;
  purpose?: string;
};

export type CompiledKnowledge = {
  promptBlock: string;
  applied: string[];
  warnings: string[];
};

let runtimeCloudRules: KnowledgeRule[] = [];

export function setRuntimeKnowledgeCatalog(rules: KnowledgeRule[]): void {
  runtimeCloudRules = rules.filter((rule) => rule.source === "cloud");
}

export function getRuntimeKnowledgeCatalog(): KnowledgeRule[] {
  return runtimeCloudRules;
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ja");
}

function list(...items: string[]): string[] {
  return items;
}

const commonRule: KnowledgeRule = {
  key: "common:editorial",
  kind: "combination",
  label: "共通編集原則",
  priority: 100,
  source: "seed",
  guidance: list(
    "明示された今回の条件を、過去の傾向や一般論より優先する",
    "読者が次に何を理解・判断・実行できるかが分かる具体的な内容にする",
    "複数の条件は単純に列挙せず、読者・目的・媒体・テーマの関係を整理して反映する",
  ),
  deliverables: [],
  cautions: list(
    "年齢・性別・職業だけから家族構成、収入、能力、IT習熟度などを決めつけない",
    "未確認の価格、統計、ランキング、レビュー、最新仕様、成果を事実として補完しない",
    "条件同士が衝突する場合は、安全・事実性 → 今回の明示条件 → 媒体・タスク → 読者 → 個人最適化の順で優先する",
  ),
};

const ageRules: KnowledgeRule[] = [
  {
    key: "age:10s", kind: "age", label: "10代", priority: 60, source: "seed",
    guidance: list("学校生活や初学者でも理解できる平易な言葉を優先し、専門用語は短く説明する", "将来選択の余地を残し、断定的な進路・金銭判断を迫らない"),
    deliverables: list("要点の短いまとめ", "安全に試せる最初の一歩"),
    cautions: list("未成年である可能性を考慮し、高額購入・契約・投資などを安易に勧めない"),
  },
  {
    key: "age:20s", kind: "age", label: "20代", priority: 60, source: "seed",
    guidance: list("基礎説明と実践手順を両立し、選択肢を比較しやすくする", "時間・予算・経験に幅がある前提で複数の始め方を示す"),
    deliverables: list("始め方", "判断基準"), cautions: list("年齢だけで学生・独身・低収入などと推定しない"),
  },
  {
    key: "age:30s", kind: "age", label: "30代", priority: 60, source: "seed",
    guidance: list("限られた時間でも判断しやすいよう、結論・手順・優先順位を明確にする", "短時間で試す方法と、深く取り組む方法の両方を示せる場合は分ける"),
    deliverables: list("優先順位", "実行手順"), cautions: list("仕事・結婚・子育て・収入状況を年齢から決めつけない"),
  },
  {
    key: "age:40s", kind: "age", label: "40代", priority: 60, source: "seed",
    guidance: list("既存経験を活かせる選択肢と、初めて学ぶ場合の手順を併記する", "費用・時間・継続性など比較軸を明確にする"),
    deliverables: list("比較軸", "無理なく試す手順"), cautions: list("役職・家族構成・デジタル習熟度を年齢だけから推定しない"),
  },
  {
    key: "age:50s", kind: "age", label: "50代", priority: 60, source: "seed",
    guidance: list("専門用語を放置せず、既知を前提にしすぎない説明にする", "手順は重要な分岐を省略せず、確認ポイントを入れる"),
    deliverables: list("確認ポイント", "段階的な手順"), cautions: list("年齢を理由に能力・健康・IT習熟度を低く見積もらない"),
  },
  {
    key: "age:60s", kind: "age", label: "60代", priority: 60, source: "seed",
    guidance: list("一文を必要以上に長くせず、操作・判断の順番が追いやすい構成にする", "略語やサービス固有語は初出時に意味を説明する"),
    deliverables: list("手順ごとの確認事項", "用語の短い補足"), cautions: list("年齢だけで初心者・苦手・退職済みなどと決めつけない"),
  },
  {
    key: "age:70plus", kind: "age", label: "70代以上", priority: 60, source: "seed",
    guidance: list("読み飛ばしても流れが分かる明確な見出しと短めの段落を使う", "操作手順は番号付きで示し、失敗時の戻り方や確認点も必要に応じて書く"),
    deliverables: list("番号付き手順", "注意点と確認方法"), cautions: list("年齢を能力や健康状態の代理指標として扱わない"),
  },
];

const genreRules: KnowledgeRule[] = [
  {
    key: "genre:ai-sidejob", kind: "genre", label: "AI副業", aliases: ["生成AI副業"], priority: 70, source: "seed",
    guidance: list("仕事内容、必要な準備、作業フロー、成果物の例を具体化する", "AIで自動化できる部分と人が確認すべき部分を分ける"),
    deliverables: list("始め方", "作業フロー", "チェックリスト", "成果物例"),
    cautions: list("収益額・成功率・案件獲得を保証しない", "利用するAIやサービスの最新仕様が必要な場合は確認を促す"),
  },
  {
    key: "genre:lifestyle", kind: "genre", label: "生活・暮らし", aliases: ["暮らし"], priority: 70, source: "seed",
    guidance: list("負担を増やさず試せる小さな改善から示す", "家事・時間・費用のトレードオフを必要に応じて整理する"),
    deliverables: list("実践手順", "チェックリスト"), cautions: list("家庭構成や生活環境を一律に想定しない"),
  },
  {
    key: "genre:beauty", kind: "genre", label: "美容", priority: 70, source: "seed",
    guidance: list("目的、使い方、選び方、注意点を分けて整理する", "個人差があることを明示し、再現性のない効果を断定しない"),
    deliverables: list("選び方", "手順", "注意点"), cautions: list("医学的な診断・治療効果を断定しない", "肌・身体の変化を保証しない"),
  },
  {
    key: "genre:gadget", kind: "genre", label: "ガジェット", priority: 70, source: "seed",
    guidance: list("用途から必要条件を整理してから比較する", "初心者向けではスペック値の意味を利用場面と結びつける"),
    deliverables: list("比較表", "選び方", "設定手順"), cautions: list("価格・在庫・現行仕様は未確認で断定しない", "使用経験を創作しない"),
  },
  {
    key: "genre:career", kind: "genre", label: "仕事・キャリア", priority: 70, source: "seed",
    guidance: list("目標、現在地、必要スキル、具体的行動を分けて整理する", "複数の選択肢と判断基準を示す"),
    deliverables: list("行動計画", "判断基準", "スキル整理"), cautions: list("採用・昇給・転職成功を保証しない"),
  },
  {
    key: "genre:money", kind: "genre", label: "お金・副業", aliases: ["お金", "副業"], priority: 75, source: "seed",
    guidance: list("目的、前提条件、費用、リスク、選択肢を分ける", "読者が自分で判断できる比較軸を示す"),
    deliverables: list("比較軸", "確認事項", "リスク整理"), cautions: list("投資収益・節税効果・収入を保証しない", "法令・税制・金融商品の最新条件は確認を促す"),
  },
  {
    key: "genre:sns", kind: "genre", label: "SNS運用", priority: 70, source: "seed",
    guidance: list("目的、対象読者、投稿の柱、投稿形式、CTAを一貫させる", "媒体ごとに同じ文章を使い回さず、見せ方を変える"),
    deliverables: list("投稿の柱", "投稿例", "運用チェック"), cautions: list("フォロワー増加・拡散・売上を保証しない"),
  },
  {
    key: "genre:learning", kind: "genre", label: "学習・自己成長", priority: 70, source: "seed",
    guidance: list("目標を小さな学習単位へ分解し、復習・実践を組み込む", "継続しやすい時間配分と確認方法を示す"),
    deliverables: list("学習計画", "チェックリスト", "復習方法"), cautions: list("短期間での習得や資格合格を保証しない"),
  },
  {
    key: "genre:health", kind: "genre", label: "健康・フィットネス", priority: 80, source: "seed",
    guidance: list("一般的な情報と個別の医療判断を明確に分ける", "安全性、継続性、無理のない選択肢を優先する"),
    deliverables: list("安全上の注意", "無理のない実践案"), cautions: list("診断・治療・薬の変更を指示しない", "症状や効果を断定せず、必要に応じ専門家への相談を促す"),
  },
  {
    key: "genre:parenting", kind: "genre", label: "子育て・教育", priority: 75, source: "seed",
    guidance: list("子どもの年齢・発達・家庭状況による違いを前提に複数案を示す", "保護者の負担と安全面も考慮する"),
    deliverables: list("選択肢", "実践例", "確認ポイント"), cautions: list("子どもの能力・発達を一律に決めつけない"),
  },
  {
    key: "genre:travel", kind: "genre", label: "旅行", priority: 65, source: "seed",
    guidance: list("目的、日程、移動、予算、持ち物を分けて整理する", "代替案や余裕時間を必要に応じて示す"),
    deliverables: list("旅程案", "持ち物", "確認事項"), cautions: list("営業時間・料金・運行情報など変動情報を未確認で断定しない"),
  },
  {
    key: "genre:food", kind: "genre", label: "料理・グルメ", priority: 65, source: "seed",
    guidance: list("材料、分量、手順、失敗しやすい点を明確にする", "代替材料がある場合は条件付きで示す"),
    deliverables: list("材料", "手順", "コツ"), cautions: list("アレルギーや衛生面に配慮し、安全を断定しない"),
  },
  {
    key: "genre:hobby", kind: "genre", label: "趣味・エンタメ", priority: 60, source: "seed",
    guidance: list("初心者が始めるために必要なものと、楽しみ方の選択肢を整理する"),
    deliverables: list("始め方", "必要なもの", "楽しみ方"), cautions: list("著作物を長く転載・模倣しない"),
  },
  {
    key: "genre:pets", kind: "genre", label: "ペット", priority: 75, source: "seed",
    guidance: list("動物種・年齢・環境による違いを前提に、安全と日常管理を優先する"),
    deliverables: list("確認項目", "日常管理の手順"), cautions: list("病気の診断や治療を断定せず、異常時は獣医師への相談を促す"),
  },
];

const subgenreRules: KnowledgeRule[] = [
  { key: "sub:ai-writing", kind: "subgenre", label: "AIライティング", parentLabel: "AI副業", priority: 80, source: "seed", guidance: list("テーマ決定 → 読者設定 → 構成 → 下書き → 事実確認 → 校正 → 公開の流れを意識する", "AI出力をそのまま公開せず、人が確認する工程を含める"), deliverables: list("制作フロー", "品質チェック"), cautions: list("AIが生成した出典不明の事実を確定情報として扱わない") },
  { key: "sub:image-ai", kind: "subgenre", label: "画像生成AI", parentLabel: "AI副業", priority: 80, source: "seed", guidance: list("用途、構図、主体、背景、画風、避ける要素を分けて指示する", "商用利用時はロゴ・商標・既存作品固有要素への依存を避ける"), deliverables: list("画像プロンプト", "確認チェック"), cautions: list("権利関係やサービス規約を未確認で断定しない") },
  { key: "sub:prompt", kind: "subgenre", label: "プロンプト活用", parentLabel: "AI副業", priority: 80, source: "seed", guidance: list("目的・入力・制約・出力形式を明確に分ける", "長い指示は優先順位を整理し、重複を減らす"), deliverables: list("再利用できるテンプレート", "入力例"), cautions: list("万能な一文で精度が保証されると説明しない") },
  { key: "sub:skincare", kind: "subgenre", label: "スキンケア", parentLabel: "美容", priority: 80, source: "seed", guidance: list("目的、使用順序、頻度、肌状態による調整を分けて説明する"), deliverables: list("基本手順", "注意点"), cautions: list("医薬品相当の効果や症状改善を保証しない") },
  { key: "sub:pc", kind: "subgenre", label: "PC", parentLabel: "ガジェット", priority: 75, source: "seed", guidance: list("用途を先に決め、CPU・メモリ・ストレージ・GPUなど必要な要素だけ比較する"), deliverables: list("用途別チェック", "比較項目"), cautions: list("現行モデル・価格は最新確認なしに断定しない") },
  { key: "sub:x", kind: "subgenre", label: "X", parentLabel: "SNS運用", priority: 75, source: "seed", guidance: list("1投稿1メッセージを基本に、冒頭で内容が分かるようにする", "必要なら連投へ分割し、各投稿単体でも意味を持たせる"), deliverables: list("短文投稿案", "CTA案"), cautions: list("アルゴリズムや文字数仕様を最新確認なしに絶対条件として断定しない") },
  { key: "sub:instagram", kind: "subgenre", label: "Instagram", parentLabel: "SNS運用", priority: 75, source: "seed", guidance: list("フック → 要点 → まとめ → CTAの視覚的な流れを設計する", "キャプション単体でも意味が伝わるようにする"), deliverables: list("カルーセル構成", "キャプション"), cautions: list("流行・リーチ数を未確認で断定しない") },
  { key: "sub:tiktok", kind: "subgenre", label: "TikTok", parentLabel: "SNS運用", priority: 75, source: "seed", guidance: list("冒頭でテーマを提示し、1本で扱うメッセージを絞る", "映像・テロップ・ナレーションの役割を分ける"), deliverables: list("短尺台本", "テロップ案"), cautions: list("再生数や拡散を保証しない") },
];

const taskRules: Record<KnowledgeTask, KnowledgeRule> = {
  title: { key: "task:title", kind: "task", label: "タイトル生成", priority: 90, source: "seed", tasks: ["title"], guidance: list("読者・テーマ・得られる内容のうち重要な要素が一目で分かるようにする", "本文にない強い約束をタイトルだけに追加しない"), deliverables: list("内容の角度が異なる複数案"), cautions: list("釣り・過度な煽り・根拠のない数字を避ける") },
  article: { key: "task:article", kind: "task", label: "記事本文", priority: 90, source: "seed", tasks: ["article"], guidance: list("導入で読者の課題と記事で分かることを明確にする", "抽象論だけで終わらせず、手順・判断基準・例・チェック項目で具体化する"), deliverables: list("完成記事"), cautions: list("同じ要点を言い換えて文字数を水増ししない") },
  image: { key: "task:image", kind: "task", label: "画像計画", priority: 90, source: "seed", tasks: ["image"], guidance: list("記事テーマの中核を1つの視覚メッセージに絞る", "記事と画像で読者像・世界観・用語を一致させる"), deliverables: list("主役", "構図", "背景", "避ける要素"), cautions: list("画像内に未確認の価格・順位・効果を書かない") },
  social: { key: "task:social", kind: "task", label: "SNS投稿", priority: 90, source: "seed", tasks: ["social"], guidance: list("元記事の価値を短く再構成し、SNS単体でも最低限の学びがある内容にする", "媒体の閲覧行動に合わせて文章量と構成を変える"), deliverables: list("投稿案", "狙い", "自然なCTA"), cautions: list("記事にない成果・体験・レビューを追加しない") },
  promotion: { key: "task:promotion", kind: "task", label: "販売・プロモーション", priority: 90, source: "seed", tasks: ["promotion"], guidance: list("確認済み事実 → 読者の課題 → 価値 → 利用イメージ → 注意事項 → CTAの論理を崩さない", "認知・信頼・販売など目的に応じてCTAの強さを調整する"), deliverables: list("訴求軸", "CTA", "公開前確認"), cautions: list("未確認の実績・利用者数・レビュー・割引を作らない") },

  sidejob_content: { key: "task:sidejob_content", kind: "task", label: "記事・コンテンツ販売副業", priority: 94, source: "seed", tasks: ["sidejob_content"], guidance: list("無料部分と有料部分、単品と継続商品の役割を分ける", "購入後に実行できる成果物・手順・テンプレートを具体化する"), deliverables: list("商品設計", "無料/有料境界", "章構成", "販売前チェック"), cautions: list("売上・購入率・販売数を保証しない", "入力されていない実績や購入者の声を作らない") },
  sidejob_sns: { key: "task:sidejob_sns", kind: "task", label: "SNS運用副業", priority: 94, source: "seed", tasks: ["sidejob_sns"], guidance: list("媒体・目的・投稿の柱・CTA・検証指標を一貫させる", "単発投稿ではなく継続運用できる企画単位へ分解する"), deliverables: list("運用方針", "投稿の柱", "投稿カレンダー", "検証項目"), cautions: list("フォロワー増加・表示回数・売上を保証しない", "媒体仕様やアルゴリズムを未確認で断定しない") },
  sidejob_video: { key: "task:sidejob_video", kind: "task", label: "YouTube・動画副業", priority: 94, source: "seed", tasks: ["sidejob_video"], guidance: list("視聴者の期待、冒頭フック、維持ポイント、結論、CTAを動画尺に合わせる", "長尺・ショート・ライブの目的を混同しない"), deliverables: list("企画", "台本", "サムネイル文言", "撮影/編集チェック"), cautions: list("再生数・登録者増加を保証しない", "動画内にない内容をサムネイルだけで誇張しない") },
  sidejob_affiliate: { key: "task:sidejob_affiliate", kind: "task", label: "アフィリエイト副業", priority: 96, source: "seed", tasks: ["sidejob_affiliate"], guidance: list("読者の状況→比較軸→候補→向いている条件→確認事項の順で購入判断を支援する", "広告・紹介であることを前提に事実と評価を分ける"), deliverables: list("比較軸", "記事/投稿構成", "一次情報確認リスト", "CTA案"), cautions: list("価格・在庫・キャンペーン・ランキング・レビューを未確認で断定しない", "実際に使っていない商品を使用済みとして書かない") },
  sidejob_resale: { key: "task:sidejob_resale", kind: "task", label: "物販・フリマ副業", priority: 96, source: "seed", tasks: ["sidejob_resale"], guidance: list("商品状態、付属品、発送条件、購入前注意を分けて誤解なく伝える", "利益計算では仕入・販売手数料・送料・返品等の入力済み費用だけを使う"), deliverables: list("出品タイトル", "商品説明", "撮影チェック", "発送前チェック"), cautions: list("未確認の動作・傷・購入時期・定価・正規品判定を作らない", "販売可否や規約適合を未確認で断定しない") },
  sidejob_crowdsourcing: { key: "task:sidejob_crowdsourcing", kind: "task", label: "クラウドソーシング副業", priority: 94, source: "seed", tasks: ["sidejob_crowdsourcing"], guidance: list("案件要件と自分が事実として提示できる経験を対応付ける", "応募前の不明点・納期・成果物・修正範囲を明確にする"), deliverables: list("案件適合チェック", "応募文", "確認質問", "作業計画"), cautions: list("経験年数・実績・資格・ポートフォリオを創作しない", "契約条件を推測で補完しない") },
  sidejob_skill_sales: { key: "task:sidejob_skill_sales", kind: "task", label: "スキル販売副業", priority: 94, source: "seed", tasks: ["sidejob_skill_sales"], guidance: list("購入前条件、提供範囲、納品物、修正範囲、対応不可を先に定義する", "成果物の価値を作業量ではなく購入者が使える状態で説明する"), deliverables: list("サービス設計", "販売ページ", "購入前質問", "納品チェック"), cautions: list("資格・実績・販売件数・評価を創作しない", "成果保証や無制限対応を安易に約束しない") },
  sidejob_digital_product: { key: "task:sidejob_digital_product", kind: "task", label: "デジタル商品副業", priority: 94, source: "seed", tasks: ["sidejob_digital_product"], guidance: list("購入前の課題と購入後の完成状態をつなぎ、各章に具体的な成果物を置く", "教材・テンプレート・チェックリストなど再利用可能な形へ落とす"), deliverables: list("商品企画", "章構成", "テンプレート設計", "販売前チェック"), cautions: list("学習成果・収益・期間短縮を保証しない", "架空の利用者レビューや販売実績を作らない") },
  sidejob_outreach: { key: "task:sidejob_outreach", kind: "task", label: "営業・案件獲得副業", priority: 94, source: "seed", tasks: ["sidejob_outreach"], guidance: list("相手に関係する連絡理由と、自分が提供できる具体的価値を短く対応付ける", "返信しやすい次の一歩を1つだけ提示する"), deliverables: list("営業文", "提案要点", "質問事項", "フォローアップ案"), cautions: list("取引実績・紹介実績・成果を創作しない", "大量送信前提の誇張や圧迫的な表現を避ける") },
  sidejob_research: { key: "task:sidejob_research", kind: "task", label: "リサーチ副業", priority: 96, source: "seed", tasks: ["sidejob_research"], guidance: list("調査目的を意思決定に必要な問いへ分解し、一次情報と二次情報を区別する", "更新日・対象地域・対象プラン・比較条件を記録する"), deliverables: list("調査設計", "情報源優先順位", "比較表項目", "未確認事項"), cautions: list("検索スニペットだけで断定しない", "古い情報と現在情報を混ぜない") },
  sidejob_efficiency: { key: "task:sidejob_efficiency", kind: "task", label: "業務効率化副業", priority: 92, source: "seed", tasks: ["sidejob_efficiency"], guidance: list("現状作業を入力・処理・確認・保存・例外対応へ分ける", "自動化候補と人が確認すべき箇所を分離する"), deliverables: list("SOP", "チェックリスト", "再利用テンプレート", "例外時ルール"), cautions: list("入力されていない社内規定・権限・システム仕様を作らない", "機密情報を外部AIへ貼る前提にしない") },
  sidejob_planning: { key: "task:sidejob_planning", kind: "task", label: "AI副業選定", priority: 96, source: "seed", tasks: ["sidejob_planning"], guidance: list("使える時間・得意分野・初期費用・営業可否・制作物の好みから候補を絞る", "候補ごとに最初の30日で検証する内容を具体化する"), deliverables: list("候補比較", "適合理由", "30日検証計画", "撤退/継続基準"), cautions: list("収益額・案件獲得・成功確率を保証しない", "向き不向きを属性だけで断定しない") },
};

const publicationRules: KnowledgeRule[] = [
  { key: "pub:note", kind: "publication", label: "note", priority: 65, source: "seed", guidance: list("読み物として自然な導入と見出しの流れを作り、本文だけでも価値が伝わるようにする"), deliverables: [], cautions: [] },
  { key: "pub:tips", kind: "publication", label: "Tips", priority: 65, source: "seed", guidance: list("再現しやすい手順・テンプレート・チェックリストなど実務成果物を明確にする"), deliverables: [], cautions: [] },
  { key: "pub:brain", kind: "publication", label: "Brain", priority: 65, source: "seed", guidance: list("購入判断に必要な対象者・得られる内容・前提条件・注意点を具体的にする"), deliverables: [], cautions: [] },
  { key: "pub:blog", kind: "publication", label: "ブログ", priority: 65, source: "seed", guidance: list("検索や流入元に依存せず、見出しだけで論点を追える構造にする"), deliverables: [], cautions: [] },
];

export const DEFAULT_GENRE_LABELS = [
  "AI副業", "生活・暮らし", "美容", "ガジェット", "仕事・キャリア", "お金・副業", "SNS運用", "学習・自己成長",
  "健康・フィットネス", "子育て・教育", "旅行", "料理・グルメ", "趣味・エンタメ", "ペット",
] as const;

function matches(rule: KnowledgeRule, value: string, parent?: string): boolean {
  const wanted = normalize(value);
  if (!wanted) return false;
  if (rule.parentLabel && parent && normalize(rule.parentLabel) !== normalize(parent)) return false;
  return normalize(rule.label) === wanted || (rule.aliases ?? []).some((alias) => normalize(alias) === wanted);
}

function unique(lines: string[]): string[] {
  return [...new Set(lines.map((line) => line.trim()).filter(Boolean))];
}

function allRules(input: KnowledgeCompileInput): KnowledgeRule[] {
  const rules: KnowledgeRule[] = [commonRule, taskRules[input.task]];
  if (input.task === "promotion") {
    rules.push(PROMOTION_COMMON_KNOWLEDGE);
    const promotionPublication = PROMOTION_PUBLICATION_KNOWLEDGE.find(
      (rule) => matches(rule, input.publicationTarget ?? ""),
    );
    if (promotionPublication) rules.push(promotionPublication);
  }
  const age = ageRules.find((rule) => matches(rule, input.ageGroup ?? ""));
  if (age) rules.push(age);
  const genre = genreRules.find((rule) => matches(rule, input.genre ?? ""));
  if (genre) rules.push(genre);
  const subgenre = subgenreRules.find((rule) => matches(rule, input.subgenre ?? "", input.genre));
  if (subgenre) rules.push(subgenre);
  const publication = publicationRules.find((rule) => matches(rule, input.publicationTarget ?? ""));
  if (publication) rules.push(publication);

  for (const rule of runtimeCloudRules) {
    if (rule.tasks?.length && !rule.tasks.includes(input.task)) continue;
    if (rule.kind === "genre" && matches(rule, input.genre ?? "")) rules.push(rule);
    if (rule.kind === "subgenre" && matches(rule, input.subgenre ?? "", input.genre)) rules.push(rule);
    if (rule.kind === "age" && matches(rule, input.ageGroup ?? "")) rules.push(rule);
    if (rule.kind === "publication" && matches(rule, input.publicationTarget ?? "")) rules.push(rule);
    if (rule.kind === "task" && (!rule.tasks?.length || rule.tasks.includes(input.task))) rules.push(rule);
    if (rule.kind === "combination") rules.push(rule);
  }
  return rules.sort((a, b) => b.priority - a.priority || a.key.localeCompare(b.key, "ja"));
}

export function compileKnowledgeContext(input: KnowledgeCompileInput): CompiledKnowledge {
  const rules = allRules(input);
  const guidance = unique(rules.flatMap((rule) => rule.guidance));
  const deliverables = unique(rules.flatMap((rule) => rule.deliverables));
  const cautions = unique(rules.flatMap((rule) => rule.cautions));
  const warnings: string[] = [];

  const knownGenre = !input.genre || normalize(input.genre) === "その他" || genreRules.some((rule) => matches(rule, input.genre ?? "")) || runtimeCloudRules.some((rule) => rule.kind === "genre" && matches(rule, input.genre ?? ""));
  if (input.genre && !knownGenre) warnings.push(`自由入力ジャンル「${input.genre}」は一般ルールを基準に扱い、専門的な断定は避ける`);
  const knownSubgenre = !input.subgenre || normalize(input.subgenre) === "aiおまかせ" || normalize(input.subgenre) === "その他" || subgenreRules.some((rule) => matches(rule, input.subgenre ?? "", input.genre)) || runtimeCloudRules.some((rule) => rule.kind === "subgenre" && matches(rule, input.subgenre ?? "", input.genre));
  if (input.subgenre && !knownSubgenre) warnings.push(`自由入力サブジャンル「${input.subgenre}」は親ジャンル「${input.genre || "未指定"}」との関係を優先して解釈する`);

  if (input.articleType === "paid") {
    guidance.push("有料コンテンツでは、無料部分だけでも読者が判断できる情報を提供し、有料部分の価値を具体的に示す");
    cautions.push("有料であることを理由に成果保証・希少性の捏造・過度な煽りを追加しない");
  } else if (input.articleType === "free") {
    guidance.push("無料コンテンツは記事単体で課題解決に役立つ内容として完結させる");
  }

  const purpose = normalize(input.purpose);
  if (purpose.includes("信頼") && (purpose.includes("販売") || purpose.includes("購入"))) {
    guidance.push("信頼構築を主目的にし、販売CTAは本文の価値説明後に選択肢として自然に置く");
  }

  const applied = unique(rules.map((rule) => rule.label));
  const sections = [
    "【AAS KNOWLEDGE COMPILER】",
    `適用タスク: ${input.task}`,
    input.ageGroup ? `対象年齢: ${input.ageGroup}` : "",
    input.genre ? `ジャンル: ${input.genre}` : "",
    input.subgenre ? `サブジャンル: ${input.subgenre}` : "",
    input.publicationTarget ? `掲載先: ${input.publicationTarget}` : "",
    input.audience ? `補足読者条件: ${input.audience}` : "",
    input.purpose ? `目的: ${input.purpose}` : "",
    "",
    "【条件から導いた制作ルール】",
    ...unique(guidance).map((line) => `- ${line}`),
  ];
  if (deliverables.length) sections.push("", "【価値を出しやすい成果物】", ...unique(deliverables).map((line) => `- ${line}`));
  if (cautions.length || warnings.length) sections.push("", "【注意・補正】", ...unique([...cautions, ...warnings]).map((line) => `- ${line}`));
  sections.push(
    "",
    "【プロンプト監査】",
    "- 上記ルールを機械的に全部詰め込まず、今回のテーマに関係するものだけ自然に反映する",
    "- 矛盾する条件があれば、安全・事実性と今回の明示条件を優先して解消する",
    "- 同じ意味の指示を重複させず、読者・媒体・目的に合わない定型文を入れない",
    "- 最終出力前に、読者適合・目的適合・媒体適合・事実性・CTA整合性を内部確認する",
  );

  return { promptBlock: sections.filter((line) => line !== "").join("\n").replace(/\n{3,}/g, "\n\n"), applied, warnings };
}
