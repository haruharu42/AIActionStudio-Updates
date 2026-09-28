// Curated high-value combination rules; avoid generating a full cartesian product of user conditions.
import type { SideHustleDefinition } from "@/features/side-hustles/types";

export type SideHustleCombinationKnowledge = {
  key: string;
  when: Readonly<Record<string, string | readonly string[]>>;
  label: string;
  guidance: readonly string[];
  deliverables: readonly string[];
  cautions: readonly string[];
};

type CombinationCompileResult = {
  promptBlock: string;
  applied: string[];
};

function combinationRule(
  key: string,
  when: SideHustleCombinationKnowledge["when"],
  label: string,
  guidance: readonly string[],
  deliverables: readonly string[] = [],
  cautions: readonly string[] = [],
): SideHustleCombinationKnowledge {
  return { key, when, label, guidance, deliverables, cautions };
}

const C = combinationRule;

export const SIDE_HUSTLE_COMBINATION_KNOWLEDGE: Readonly<Record<string, readonly SideHustleCombinationKnowledge[]>> = {
  "content-sales": [
    C("note-beginner-paid", { platform: "note", buyer_stage: ["beginner", "started"], product_type: "paid_article" }, "note × 初心者 × 有料記事", ["無料部分で前提と判断基準を渡し、有料部分では迷わず実行できる手順・テンプレート・完成例へ進める", "専門用語は初出で説明し、購入直後の最初の行動を明示する"], ["初心者向け実行チェック", "購入後30分で始める手順"], ["初心者向けであることを理由に成果を保証しない"]),
    C("tips-brain-experienced-guide", { platform: ["tips", "brain"], buyer_stage: "intermediate", product_type: ["guide", "mini_course"] }, "Tips/Brain × 経験者 × 実践教材", ["基礎説明を圧縮し、判断基準・失敗回避・応用パターン・再利用方法を厚くする", "経験者が既知の一般論ではなく、作業品質を上げるチェックポイントを中心にする"], ["応用チェックリスト", "実践課題"]),
    C("blog-series-evidence", { platform: ["blog", "newsletter"], product_type: "series", proof_material: ["source_material", "existing_content"] }, "ブログ/ニュースレター × 連載 × 既存根拠", ["各回を単独でも理解できる形にしつつ、既存資料・一次情報への参照関係を維持する", "連載全体で同じ根拠を重複説明しすぎず、回ごとの役割を分ける"], ["連載マップ", "根拠対応表"]),
    C("template-stuck", { product_type: "template_pack", buyer_stage: ["stuck", "comparison"], free_paid_boundary: ["problem_to_template", "sample_to_full"] }, "テンプレート商品 × 行き詰まり/比較中", ["無料側で課題の切り分け方を示し、有料側では選択式テンプレートと記入例で作業を前へ進める", "テンプレートが合わない条件も明示する"], ["用途別テンプレート選択表", "記入例"]),
    C("experience-case-system", { proof_material: ["own_experience", "own_results"], free_paid_boundary: "case_to_system" }, "実体験/実績 × 事例から仕組み化", ["体験・結果・一般化した手順を明確に分け、個別事例を普遍的な成功法則へ飛躍させない", "再利用可能な部分だけを抽出してチェックリスト化する"], ["事例→原則→手順の対応表"], ["個人の実績を読者の再現性として保証しない"]),
  ],
  "sns-management": [
    C("instagram-early-trust", { platform: "instagram", account_stage: ["new", "early"], objective: ["trust", "profile"], content_style: "carousel" }, "Instagram × 初期アカウント × 信頼形成", ["プロフィールとカルーセルの役割を分け、保存・プロフィール遷移につながる基礎投稿を優先する", "投稿テーマを広げすぎず3本程度の柱から開始する"], ["初期12投稿の配分", "プロフィール整合チェック"]),
    C("x-active-content", { platform: "x", account_stage: ["active", "restart"], objective: ["content", "lead"], content_style: ["short_text", "educational"] }, "X × 継続/再開 × 記事・相談導線", ["短文単体で価値を渡し、必要な投稿だけ記事・相談への導線を付ける", "再開時は過去投稿との連続性を説明し、急な販売投稿連投を避ける"], ["再開1週間の投稿案", "記事導線付き短文"]),
    C("tiktok-early-shortvideo", { platform: "tiktok", account_stage: ["new", "early"], content_style: "short_video", objective: ["trust", "profile"] }, "TikTok × 初期 × 短尺動画", ["1本1テーマで冒頭に内容を提示し、プロフィールへ移動する理由を動画内の価値とつなげる", "撮影・編集負荷を抑えた反復可能な型を先に作る"], ["短尺動画テンプレート", "7本分の企画"]),
    C("multi-pivot-sales", { platform: "multi", account_stage: ["active", "pivot"], objective: ["sale", "lead"] }, "複数SNS × 継続/方向転換 × 販売/相談", ["同じ原稿の横流しではなく、核メッセージだけ共通化し媒体ごとにフック・尺・CTAを変える", "方向転換時は旧テーマとの接続説明を作る"], ["媒体別再編集表", "テーマ移行投稿"]),
    C("visual-sales-inquiry", { platform: ["instagram", "tiktok"], objective: "sale", conversion_path: ["service", "inquiry"] }, "ビジュアルSNS × 販売目的 × 問い合わせ導線", ["実績の誇張より、提供内容・対象者・利用イメージ・次の一歩を視覚的に明確にする", "販売投稿だけに偏らず信頼形成投稿との比率を設計する"], ["販売導線投稿", "問い合わせ前FAQ"], ["限定性や成果を捏造しない"]),
  ],
  "youtube-video": [
    C("short-early-discover", { format: ["shorts", "tiktok", "reels"], channel_stage: ["new", "early"], video_goal: "discover", production_style: ["no_face", "voiceover"] }, "短尺 × 初期チャンネル × 新規認知", ["前提説明を短くし、冒頭でテーマと得られるものを即時提示する", "反復制作できる映像・字幕・ナレーションの型を固定する"], ["15〜45秒構成", "量産用素材テンプレート"]),
    C("long-growing-education", { format: "long", channel_stage: "growing", video_goal: "educate", production_style: ["screen", "voiceover"] }, "長尺 × 継続投稿 × 解説", ["検索・関連視聴から途中参加しても理解できる章立てにし、画面収録と説明を同期させる", "既知の視聴者向け前置きを長くしすぎない"], ["章ごとの画面素材", "要点復習パート"]),
    C("gameplay-restart-entertain", { format: ["live_clip", "long"], channel_stage: ["restart", "pivot"], video_goal: ["entertain", "trust"], production_style: "gameplay" }, "実況/切り抜き × 再開/転換 × エンタメ", ["既存視聴者へ変更点を簡潔に伝え、見せ場までの待ち時間を削る", "人物らしさは残しつつ内輪前提を増やしすぎない"], ["見せ場候補", "復帰説明の短文"]),
    C("long-convert", { format: "long", video_goal: "convert", next_action: ["article", "service"] }, "長尺 × コンバージョン × 記事/サービス", ["本編だけで十分な価値を提供した後、関連する深掘り先としてCTAを置く", "動画内で扱っていない内容をCTA側で成果として約束しない"], ["CTA前の要約", "概要欄導線"]),
    C("short-convert", { format: ["shorts", "tiktok", "reels"], video_goal: "convert", next_action: ["article", "service"] }, "短尺 × コンバージョン", ["短尺内では問題提起と1つの価値に絞り、詳細は次の導線で補完する", "強い煽りより『誰に何が分かるか』を明確にする"], ["短尺CTA 3案"], ["短尺だけで結果保証をしない"]),
  ],
  "affiliate": [
    C("blog-software-compare-official", { channel: ["blog", "note"], product_type: ["software", "subscription"], reader_stage: ["research", "compare"], evidence: "official_only" }, "記事媒体 × SaaS/サブスク × 比較検討 × 公式情報", ["料金体系・機能・制限・解約条件・対象プランを公式情報でそろえて比較する", "仕様更新日を記録し、古いプラン情報を混ぜない"], ["公式確認表", "プラン比較表"]),
    C("youtube-device-owned", { channel: "youtube", product_type: "device", evidence: ["owned_product", "own_use"] }, "YouTube × ガジェット × 実機確認", ["仕様の事実と実際に確認した使用感を分け、映像で確認できる点は実演する", "未検証の耐久性・長期使用感を推測しない"], ["実演カット一覧", "事実/感想の台本区分"]),
    C("social-dailygoods-research", { channel: ["x", "instagram"], product_type: "daily_goods", reader_stage: ["problem", "research"], evidence: ["public_reviews", "mixed"] }, "SNS × 日用品 × 初期検討", ["短い投稿でも広告性と比較条件を曖昧にせず、第三者レビューは傾向として扱う", "購入前に確認すべき個人差・サイズ・用途条件を残す"], ["SNS比較カード項目"], ["レビュー件数や評価を未確認で固定しない"]),
    C("multi-final-compare", { reader_stage: "final", comparison_style: ["two_compare", "multi_compare"], evidence: ["official_only", "mixed"] }, "最終検討 × 複数比較", ["差が出る項目だけでなく共通条件も明示し、候補ごとの向く条件を同じ軸で整理する", "最終CTAの前に価格・契約条件・返品/解約等の再確認を促す"], ["最終比較表", "購入前確認"]),
    C("education-trial", { product_type: "education", reader_stage: "final", cta: ["trial", "official_check"] }, "スクール/学習 × 最終確認 × 体験導線", ["対象者・学習内容・期間・サポート・費用条件を公式情報で確認させ、無料体験は判断材料として位置づける", "合格・転職・収入などの成果を広告文脈で保証しない"], ["体験前質問リスト"], ["教育成果を断定しない"]),
  ],
  "resale": [
    C("mercari-fashion-own-fast", { marketplace: ["mercari", "rakuma"], category: "fashion", inventory: "own", goal: ["fast", "trust"] }, "フリマ × 衣類 × 不用品 × 早期販売/安心", ["サイズ・素材・使用感・傷・保管状態を先に整理し、購入者が質問しそうな情報を説明へ含める", "早く売る場合も状態説明を省略しない"], ["採寸チェック", "写真順序"]),
    C("electronics-used-fragile", { marketplace: ["yahoo", "amazon"], category: "electronics", condition: ["used", "damaged"], shipping: "fragile" }, "家電 × 中古/不具合あり × 精密配送", ["動作確認範囲・不具合・付属品・初期化状態・梱包方法を分けて明示する", "確認できない機能は未確認とする"], ["動作確認表", "精密梱包チェック"], ["安全性や完全動作を未確認で断定しない"]),
    C("hobby-lot-margin", { marketplace: ["mercari", "yahoo"], category: "hobby", inventory: "lot", goal: ["margin", "repeat"] }, "ホビー × まとめ仕入れ × 利益/継続", ["個体差・欠品・状態差を商品単位で確認し、セット販売と単品販売の判断材料を分ける", "利益計算は実入力の仕入・送料・手数料だけで行う"], ["在庫個体チェック", "セット分け基準"]),
    C("ec-handmade-repeat", { marketplace: "ec", inventory: "handmade", condition: ["new", "like_new"], goal: "repeat" }, "自社EC × 自作品 × 継続販売", ["仕様・素材・個体差・制作期間・注意事項を固定フォーマット化する", "再販売しやすいSKU・撮影・説明テンプレートを作る"], ["商品ページテンプレート", "再販SOP"]),
    C("home-large-trust", { category: "home", shipping: ["large", "handoff"], goal: "trust" }, "家具/生活用品 × 大型配送/受渡し × 安心重視", ["寸法・搬出入条件・受渡し範囲・傷の位置を先に明示し、購入後の認識違いを減らす"], ["寸法図", "受渡し確認事項"], ["配送可否や設置可否を未確認で約束しない"]),
  ],
  "skill-sales": [
    C("coconala-creative-beginner", { platform: "coconala", service: ["writing", "design"], positioning: "beginner", delivery: ["file", "text"] }, "ココナラ × 制作系 × 初心者向け", ["購入前に必要素材・納品形式・できること/できないことを平易に示す", "初心者向けでも依頼者側に必要な準備を省略しない"], ["購入前入力フォーム", "納品例の構成"]),
    C("direct-consulting-custom", { platform: "direct", service: "consulting", positioning: "custom", delivery: ["call", "hybrid"] }, "直接販売 × 相談 × 個別最適化", ["相談前に目的・現状・制約を取得し、通話後の成果物と対象外を明確にする", "助言の範囲と実行責任を混同しない"], ["事前ヒアリング", "相談後アクションメモ"]),
    C("marketplace-speed-production", { platform: ["coconala", "stores"], service: ["setup", "video"], positioning: "speed", delivery: ["work", "file"] }, "マーケット販売 × 作業代行/動画 × 迅速対応", ["短納期の条件、必要素材の締切、修正範囲を先に定義し、依頼者待ち時間を納期保証へ含めない"], ["短納期受付条件"], ["常に即日対応できると保証しない"]),
    C("membership-template-hybrid", { platform: "membership", service: ["consulting", "writing"], positioning: "template", delivery: "hybrid" }, "会員向け × 相談/文章 × テンプレート付き", ["個別対応と共通テンプレートの境界を明確にし、会員が自走できる再利用物を残す"], ["共通テンプレート", "個別補足"]),
    C("quality-stuck-revision", { buyer_problem: ["quality", "stuck"], revision: ["limited", "quote"], positioning: ["careful", "custom"] }, "品質改善/行き詰まり × 丁寧確認 × 条件付き修正", ["初稿の問題点を診断→優先順位→修正案の順で示し、修正範囲外は追加見積条件として分離する"], ["修正優先順位表", "追加対応境界"]),
  ],
  "digital-product": [
    C("marketplace-pdf-beginner", { sales_channel: ["note", "tips", "brain"], format: "pdf", buyer_level: ["zero", "beginner"], scope: ["mini", "standard"] }, "コンテンツ販売媒体 × PDF × 初心者", ["最初から順に実行できる一本道を用意し、1ページ目で対象者・完成状態・必要時間の目安を説明する", "専門用語より記入例とチェック欄を優先する"], ["開始ガイド", "章末チェック"]),
    C("store-template-pro", { sales_channel: "store", format: ["template", "notion"], buyer_level: ["intermediate", "professional"], outcome: ["system", "asset"] }, "EC × テンプレート/Notion × 経験者", ["設定自由度・カスタマイズ箇所・運用前提・更新方法を明示し、導入後すぐ使えるサンプルデータを用意する"], ["導入手順", "カスタマイズガイド"]),
    C("video-deep-skill", { format: "video_course", buyer_level: ["beginner", "intermediate"], scope: "deep", outcome: "skill" }, "動画教材 × 体系学習 × スキル習得", ["視聴だけで終わらないよう章ごとに練習課題・確認基準・成果物を置く", "前章の理解を前提にする箇所を明示する"], ["練習課題", "到達確認"]),
    C("sns-bundle-mixed", { sales_channel: "sns", format: "bundle", buyer_level: "mixed", scope: ["standard", "workbook"] }, "SNS販売 × 複数形式 × 幅広いレベル", ["販売投稿では収録物と対象レベルを簡潔に分け、商品内では初心者ルートと経験者ルートを用意する"], ["レベル別利用ルート", "収録物一覧"]),
    C("supported-deep-product", { support: ["community", "session"], scope: "deep", buyer_level: ["professional", "mixed"] }, "体系商品 × コミュニティ/個別相談", ["教材本体とサポートで扱う範囲を分け、質問受付・個別相談の対象外条件を明示する"], ["サポート利用ガイド"], ["返信速度・個別成果・無制限対応を保証しない"]),
  ],
  "crowdsourcing": [
    C("platform-beginner-writing", { platform: ["crowdworks", "lancers"], experience: "none", job_type: ["writing", "research"], proposal_style: "beginner_honest" }, "大手案件サイト × 未経験 × ライティング/調査", ["未経験を隠さず、案件要件を理解したこと・作業手順・確認方法・学習済み事項で提案を補強する", "小さなサンプルを作る場合も依頼内容の無断本制作は避ける"], ["未経験向け応募文", "要件理解チェック"]),
    C("direct-expert-creative", { platform: ["direct", "referral"], experience: ["professional", "portfolio"], job_type: ["design", "video", "sns"], proposal_style: "evidence" }, "直接/紹介 × 経験者 × 制作案件", ["相手の要件に関連する実績だけを選び、成果物・担当範囲・進行方法を短く対応付ける"], ["関連実績選択表", "提案要約"]),
    C("coconala-small-experience", { platform: "coconala", experience: ["personal", "small_paid"], job_type: ["design", "writing"], proposal_style: ["concise", "process"] }, "ココナラ募集 × 初期経験 × 制作", ["経験を盛らず、依頼要件への理解・制作フロー・確認タイミングで安心材料を作る"], ["短文応募", "進行フロー"]),
    C("rush-creative-scope", { deadline: ["same_day", "3_days"], job_type: ["video", "design"], risk: ["scope", "revision"] }, "短納期 × 制作案件 × 範囲/修正リスク", ["着手前に素材受領時刻・成果物範囲・修正回数・確認期限を固定し、待ち時間を納期から分ける"], ["短納期確認事項"], ["無条件の当日納品を約束しない"]),
    C("rights-payment-check", { risk: ["rights", "payment"], experience: ["small_paid", "professional", "portfolio"] }, "権利/報酬確認 × 有償経験あり", ["著作権・実績公開可否・二次利用・支払条件を契約前に確認し、慣れで省略しない"], ["契約前確認質問"]),
  ],
  "outreach": [
    C("cold-company-email", { target: ["company", "small_business"], relationship: "cold", channel: ["email", "form"], ask: ["reply", "brief"] }, "企業/事業者 × 新規営業 × メール/フォーム", ["相手に関係する連絡理由を冒頭で示し、提供価値・根拠・小さな次の一歩だけに絞る", "企業情報を読んだふりをせず確認済み情報だけで個別化する"], ["新規営業文", "件名案"]),
    C("warm-creator-dm", { target: ["creator", "shop"], relationship: ["follow", "met"], channel: ["dm", "chat"], ask: ["sample", "reply"] }, "クリエイター/店舗 × 相互認知 × DM", ["既存の接点を短く触れ、DMでは長い会社紹介より具体的な提案とサンプル確認へつなげる"], ["短いDM提案"]),
    C("past-client-expansion", { target: "existing_client", relationship: "past", channel: ["email", "chat"], ask: ["quote", "brief"] }, "既存顧客 × 再提案", ["過去案件の事実を踏まえ、今回新しく提供できる範囲と前回から変わる条件を明示する", "過去の満足度を推測しない"], ["再提案文", "変更条件一覧"]),
    C("referral-proposal-call", { relationship: "referral", target: ["company", "small_business"], channel: ["proposal", "email"], ask: "call" }, "紹介 × 企業 × 打合せ提案", ["紹介者名や関係を事実の範囲で簡潔に示し、打合せ前に目的・議題・所要範囲を明確にする"], ["打合せ依頼文", "議題案"]),
    C("cold-service-followup", { relationship: "cold", offer: ["writing", "design", "video", "sns"], followup: ["once", "two"] }, "新規制作営業 × 1〜2回フォロー", ["初回と同じ文を再送せず、補足価値か確認しやすい要約を添える", "返信がないことを緊急性や関心の証拠として扱わない"], ["フォローアップ文"], ["圧迫的な追客や架空の締切を使わない"]),
  ],
  "sidejob-planner": [
    C("lowtime-lowbudget-no-sales", { time: ["3h", "5h"], budget: ["zero", "3000"], sales: ["avoid", "platform"], creation: ["content", "product"] }, "低時間 × 低予算 × 営業控えめ × コンテンツ/商品", ["固定費を増やさず、週1〜2回で完成できる小さな制作物から検証する", "案件獲得を営業だけに依存せず、プラットフォームや蓄積型コンテンツを候補に含める"], ["4週間の小規模検証"]),
    C("writing-research-platform", { time: ["5h", "10h"], strength: ["writing", "research"], sales: "platform", creation: ["content", "service"] }, "文章/調査 × プラットフォーム応募 × コンテンツ/サービス", ["ライティング・調査・要約・編集など隣接候補を比較し、サンプル成果物を先に作る"], ["候補3案", "サンプル制作計画"]),
    C("creative-active-sales", { time: ["10h", "20h"], strength: ["design", "video"], sales: ["dm", "call"], creation: ["video", "service"] }, "デザイン/動画 × 営業可能 × 制作サービス", ["制作時間と営業時間を別枠で確保し、ポートフォリオ→小案件→継続提案の順で検証する"], ["週間営業/制作配分"]),
    C("communication-fulltime", { time: "20plus", strength: "communication", sales: "active", creation: "service" }, "十分な時間 × コミュニケーション × 積極営業", ["相談・運用支援・営業支援など人とのやり取りが価値になる候補を含め、受注上限と対応時間も検証する"], ["案件上限試算", "営業検証"]),
    C("tiny-test", { budget: ["zero", "3000"], risk: ["low_cost", "test"] }, "低予算 × 小さく検証", ["有料ツール契約や在庫購入より先に、無料環境で需要・制作継続性・営業反応を確認する", "30日で継続/撤退を判断できる観測項目を定義する"], ["30日検証指標"], ["初期投資額と成功確率を結びつけない"]),
  ],
  "research": [
    C("factcheck-current-official", { research_type: "fact_check", decision: ["validate", "update"], source_priority: ["official", "public_data"], freshness: ["today", "30d"] }, "事実確認 × 現在情報 × 公式/公的情報", ["主張を検証可能な小問へ分解し、一次情報の公開日・更新日・対象地域を記録する", "現在仕様と過去仕様を別行で管理する"], ["主張別根拠表", "未確認事項"]),
    C("competitor-position", { research_type: "competitor", decision: "position", source_priority: ["company", "mixed"], freshness: ["30d", "year"] }, "競合調査 × 差別化判断", ["競合の公開事実・提供内容・価格条件・訴求を分け、自社の優劣ではなく空白ニーズを探す", "推測した売上・顧客数・内部戦略を事実扱いしない"], ["競合比較表", "差別化仮説"]),
    C("product-choice-current", { research_type: "product", decision: "choose", source_priority: ["official", "company"], freshness: ["today", "30d"], scope: ["two", "five"] }, "商品比較 × 選択 × 最新公式情報", ["同一プラン・地域・条件で仕様と価格を比較し、変動項目は確認日を付ける"], ["比較表", "確認日付き根拠"]),
    C("market-trend-go", { research_type: ["market", "trend"], decision: "go_no_go", source_priority: ["public_data", "mixed"], freshness: ["year", "multi_year"] }, "市場/動向 × 実行判断 × 中長期データ", ["単月の話題性より複数期間のデータと構造要因を分け、実行条件・保留条件・追加調査を整理する"], ["Go/No-Go判断材料"]),
    C("trend-broad-current", { research_type: "trend", freshness: "today", scope: "broad", deliverable: ["sources", "report"] }, "最新動向 × 広範囲探索 × 根拠付き成果物", ["速報性と確度を分け、複数ソースで確認できない項目は未確定として残す", "更新が速い領域は取得日時を明記する"], ["時系列整理", "ソース一覧"], ["検索結果スニペットだけで最新事実を確定しない"]),
  ],
  "workflow-efficiency": [
    C("content-from-memory", { workflow: ["content", "publishing"], current_state: ["memory", "notes"], automation: ["assist", "draft"], frequency: ["daily", "weekly"] }, "制作/公開 × 手順未整備 × AI補助", ["まず現行手順を可視化し、繰り返し部分だけテンプレート化してからAI下書きを入れる", "人の最終確認点を残したまま小さく自動化する"], ["最小SOP", "AI入力テンプレート"]),
    C("research-partial", { workflow: "research", current_state: ["notes", "checklist"], automation: "partial", frequency: ["daily", "weekly"] }, "調査 × 一部手順化済み × 部分自動化", ["検索・収集・要約・出典記録・最終判断を分け、自動化するのは反復部分に限定する"], ["調査フロー", "出典記録テンプレート"]),
    C("customer-highrisk", { workflow: "customer", current_state: ["checklist", "sop"], risk: ["customer", "public"], automation: ["assist", "draft"] }, "顧客対応 × 影響あり × AI補助", ["AIは回答候補作成までに留め、送信前承認・禁止回答・エスカレーション条件を定義する"], ["送信前チェック", "エスカレーション条件"], ["AIによる自動送信を前提にしない"]),
    C("admin-money-automation", { workflow: "admin", current_state: ["sop", "automation"], risk: "money", automation: ["partial", "high"] }, "事務管理 × 金銭影響 × 高自動化", ["金額・承認・支払・更新処理には二重確認、監査ログ、ロールバック手順を置く", "例外処理は人へ戻す"], ["承認フロー", "ロールバック手順"], ["金銭処理の完全自動化を安全確認なしに勧めない"]),
    C("publishing-public-high", { workflow: "publishing", current_state: "automation", risk: "public", automation: "high", output: ["full", "decision_tree"] }, "公開作業 × 既存自動化 × 公開リスク", ["公開前プレビュー・権限確認・差分確認・取り消し手順をSOPへ組み込み、最終公開だけは明示承認を残す"], ["公開判断フロー", "緊急取り消し手順"]),
  ],
};

function matchesExpected(actual: string | undefined, expected: string | readonly string[]): boolean {
  if (!actual) return false;
  return Array.isArray(expected) ? expected.includes(actual) : actual === expected;
}

function activeRule(
  rule: SideHustleCombinationKnowledge,
  selected: Readonly<Record<string, string>>,
): boolean {
  return Object.entries(rule.when).every(([fieldKey, expected]) => matchesExpected(selected[fieldKey], expected));
}

function unique(lines: string[]): string[] {
  return [...new Set(lines.map((line) => line.trim()).filter(Boolean))];
}

export function compileSideHustleCombinationKnowledge(
  definition: SideHustleDefinition,
  selected: Readonly<Record<string, string>>,
): CombinationCompileResult {
  const rules = SIDE_HUSTLE_COMBINATION_KNOWLEDGE[definition.slug] ?? [];
  const active = rules.filter((rule) => activeRule(rule, selected));

  if (!active.length) return { promptBlock: "", applied: [] };

  const guidance = unique(active.flatMap((rule) => [...rule.guidance]));
  const deliverables = unique(active.flatMap((rule) => [...rule.deliverables]));
  const cautions = unique(active.flatMap((rule) => [...rule.cautions]));

  const sections = [
    "【複合条件KNOWLEDGE】",
    ...active.map((rule) => `- ${rule.label}`),
    "",
    "【複合条件から導いた優先ルール】",
    ...guidance.map((line) => `- ${line}`),
  ];
  if (deliverables.length) sections.push("", "【複合条件の追加成果物】", ...deliverables.map((line) => `- ${line}`));
  if (cautions.length) sections.push("", "【複合条件の注意】", ...cautions.map((line) => `- ${line}`));

  return {
    promptBlock: sections.filter(Boolean).join("\n").replace(/\n{3,}/g, "\n\n"),
    applied: active.map((rule) => `複合: ${rule.label}`),
  };
}

export function countCombinationKnowledgeRules(slug: string): number {
  return SIDE_HUSTLE_COMBINATION_KNOWLEDGE[slug]?.length ?? 0;
}
