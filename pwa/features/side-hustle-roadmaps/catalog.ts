export type SideHustleRoadmapReference = { label: string; url: string; note: string };
export type SideHustleRoadmapPhase = { id: string; window: string; title: string; outcome: string; tasks: readonly string[]; checks: readonly string[]; metrics: readonly string[] };
export type SideHustleRoadmapDefinition = { slug: string; title: string; category: string; actionHref: string; summary: string; refs: readonly (keyof typeof ROADMAP_REFERENCE_LINKS)[]; phases: readonly SideHustleRoadmapPhase[] };

export const ROADMAP_REFERENCE_LINKS = {
  "googlePeopleFirst": {
    "label": "Google Search Central — people-first content",
    "url": "https://developers.google.com/search/docs/fundamentals/creating-helpful-content?hl=ja",
    "note": "検索順位だけでなく、読者が目的を達成できる有用・信頼できる内容を優先。"
  },
  "notePaid": {
    "label": "noteヘルプ — 有料記事 / 有料ライン",
    "url": "https://www.help-note.com/hc/ja/articles/360008882894-%E6%9C%89%E6%96%99%E8%A8%98%E4%BA%8B%E3%82%92%E6%9B%B8%E3%81%8F-%E6%9C%89%E6%96%99%E3%83%A9%E3%82%A4%E3%83%B3%E3%81%AE%E8%A8%AD%E5%AE%9A",
    "note": "無料・有料の境界と購入者からの見え方を公開前に確認。"
  },
  "youtubeRetention": {
    "label": "YouTube Help — 視聴者維持率",
    "url": "https://support.google.com/youtube/answer/9314415?hl=ja",
    "note": "タイトル・サムネイルの期待を冒頭で回収し、視聴維持データから改善。"
  },
  "tiktokCreative": {
    "label": "TikTok for Business — Creative Codes",
    "url": "https://ads.tiktok.com/business/en-US/creative-codes",
    "note": "短尺はHook→Body→Close、縦型・モバイル前提で制作。"
  },
  "instagramBestPractices": {
    "label": "Meta — Instagram Best Practices",
    "url": "https://about.fb.com/news/2024/10/best-practices-education-hub-creators-instagram/",
    "note": "Creation / Engagement / Reach / Monetization / Guidelinesと実アカウントのインサイトで改善。"
  },
  "caaStealth": {
    "label": "消費者庁 — ステルスマーケティングQ&A",
    "url": "https://www.caa.go.jp/policies/policy/representation/fair_labeling/faq/stealth_marketing/",
    "note": "広告・PR・アフィリエイトであることが表示全体から明瞭に分かるようにする。"
  },
  "crowdworksGuide": {
    "label": "CrowdWorks — 仕事の依頼形式ガイド",
    "url": "https://crowdworks.jp/pages/guides/employer/index",
    "note": "プロジェクト・コンペ・タスクで契約、提案、納品の流れが異なる。"
  },
  "freelancerLaw": {
    "label": "公正取引委員会 — フリーランス法特設サイト",
    "url": "https://www.jftc.go.jp/freelancelaw_2025/",
    "note": "業務委託では取引条件の明示や報酬支払期日など最新の適用関係を確認。"
  },
  "coconalaSell": {
    "label": "ココナラ — サービスを出品したい",
    "url": "https://coconala.com/pages/guide_sell",
    "note": "タイトル、キャッチ、サービス内容、購入前のお願い、成果物イメージを明確にする。"
  },
  "mercariSell": {
    "label": "メルカリ — 出品までの流れ・売り方",
    "url": "https://help.jp.mercari.com/guide/articles/62/",
    "note": "写真・商品名・状態・説明を実物と一致させ、AI生成文も本人が確認。"
  },
  "ntaSideIncome": {
    "label": "国税庁 — 雑所得",
    "url": "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1500.htm",
    "note": "副業収入の所得区分・必要経費・記録は個別状況に応じて最新案内を確認。"
  },
  "ntaFiling": {
    "label": "国税庁 — 給与所得者で確定申告が必要な人",
    "url": "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1900.htm",
    "note": "給与所得者の申告要否は年間の所得状況に応じて最新要件を確認。"
  },
  "xAdult": {
    "label": "X — 成人向けコンテンツに関するポリシー",
    "url": "https://help.x.com/ja/rules-and-policies/adult-content",
    "note": "成人向けコンテンツの内容警告・表示場所・年齢制限等の最新ルールを確認。"
  }
} as const;
export const SIDE_HUSTLE_ROADMAPS: readonly SideHustleRoadmapDefinition[] = [
  {
    "slug": "note-operations",
    "title": "note運営",
    "category": "記事・コンテンツ",
    "actionHref": "/note-operations",
    "summary": "発信軸から無料記事、有料記事、継続運営までを段階的に進めます。",
    "refs": [
      "googlePeopleFirst",
      "notePaid",
      "caaStealth",
      "ntaSideIncome"
    ],
    "phases": [
      {
        "id": "foundation",
        "window": "準備",
        "title": "発信の土台を作る",
        "outcome": "誰に何を届けるnoteかを一文で説明できる状態。",
        "tasks": [
          "対象読者と発信テーマを1つに絞る",
          "プロフィール・固定導線・広告/PR表示方針を整える",
          "事実確認と収支記録の方法を決める"
        ],
        "checks": [
          "実績・体験は事実だけを使う",
          "無料と有料の役割を先に分ける"
        ],
        "metrics": [
          "プロフィール完成",
          "記事テーマ候補10件",
          "記録方法決定"
        ]
      },
      {
        "id": "free",
        "window": "1〜2週",
        "title": "無料記事で需要を確認する",
        "outcome": "読者が何に反応するかを実測できる状態。",
        "tasks": [
          "読者の悩み別に無料記事を3本作る",
          "各記事に1つの読後行動を設定する",
          "保存・反応・プロフィール遷移等を記録する"
        ],
        "checks": [
          "検索狙いだけの量産にしない",
          "反応が弱い記事も学びを残す"
        ],
        "metrics": [
          "公開本数",
          "読者反応",
          "次に深掘りするテーマ"
        ]
      },
      {
        "id": "paid",
        "window": "2〜4週",
        "title": "最初の有料価値を作る",
        "outcome": "購入後に具体的な成果物が残る状態。",
        "tasks": [
          "反応から有料テーマを1つ選ぶ",
          "手順・テンプレート・チェックリストを入れる",
          "有料ライン前に対象者・内容・注意点を明記する"
        ],
        "checks": [
          "成果保証をしない",
          "価格・販売条件を最新確認する"
        ],
        "metrics": [
          "有料記事完成",
          "付属物完成",
          "公開前チェック"
        ]
      },
      {
        "id": "distribution",
        "window": "1〜2か月",
        "title": "読者導線を整える",
        "outcome": "無料→関連→有料へ自然に回遊できる状態。",
        "tasks": [
          "関連記事をつなぐ",
          "SNS告知と記事内容を一致させる",
          "更新が必要な情報に確認日を付ける"
        ],
        "checks": [
          "広告/PR表示を必要に応じて明瞭にする",
          "反応を実績に見せかけない"
        ],
        "metrics": [
          "記事間遷移",
          "有料記事への遷移",
          "更新対象数"
        ]
      },
      {
        "id": "system",
        "window": "3か月〜",
        "title": "継続運営を仕組み化する",
        "outcome": "企画・制作・公開・改善を同じ手順で回せる状態。",
        "tasks": [
          "月次カレンダーを作る",
          "読者価値と更新負荷をレビューする",
          "収入・経費・取引記録を整理する"
        ],
        "checks": [
          "伸びた記事の単純コピーを避ける",
          "税務・規約は変更時に公式確認する"
        ],
        "metrics": [
          "月次更新率",
          "再利用できる型",
          "継続判断"
        ]
      }
    ]
  },
  {
    "slug": "content-sales",
    "title": "記事・ブログ・コンテンツ販売",
    "category": "記事・コンテンツ",
    "actionHref": "/side-hustles/content-sales",
    "summary": "無料記事・有料記事・教材型コンテンツを、読者価値から商品化します。",
    "refs": [
      "googlePeopleFirst",
      "notePaid",
      "caaStealth",
      "ntaSideIncome"
    ],
    "phases": [
      {
        "id": "position",
        "window": "準備",
        "title": "売る前に価値を定義する",
        "outcome": "対象者・課題・購入後に完成するものが明確な状態。",
        "tasks": [
          "対象者と対象外を決める",
          "購入後にできることを1文で定義する",
          "一次情報・自分の経験・例を分ける"
        ],
        "checks": [
          "文字数を価値にしない",
          "架空実績を使わない"
        ],
        "metrics": [
          "価値仮説",
          "購入者像",
          "証拠素材一覧"
        ]
      },
      {
        "id": "prototype",
        "window": "1〜2週",
        "title": "小さな試作品を作る",
        "outcome": "短い教材や無料サンプルで理解度を確認できる状態。",
        "tasks": [
          "サンプルを1〜3本作る",
          "チェックリスト/テンプレートを1つ作る",
          "迷う箇所を収集する"
        ],
        "checks": [
          "無料部分にも価値を残す",
          "商品化前に事実確認する"
        ],
        "metrics": [
          "試作品数",
          "質問/反応",
          "修正点"
        ]
      },
      {
        "id": "offer",
        "window": "2〜4週",
        "title": "最初の商品を完成する",
        "outcome": "説明・本体・付属物・注意事項がそろった状態。",
        "tasks": [
          "章ごとに学ぶ/やる/完成物を設定する",
          "販売ページと内容を一致させる",
          "販売条件を最新確認する"
        ],
        "checks": [
          "成果保証をしない",
          "権利・引用を確認する"
        ],
        "metrics": [
          "商品完成",
          "販売ページ完成",
          "公開前チェック"
        ]
      },
      {
        "id": "launch",
        "window": "1〜2か月",
        "title": "販売後の改善を回す",
        "outcome": "問い合わせや利用状況から改善できる状態。",
        "tasks": [
          "広告/PR表示を必要に応じて明示する",
          "質問をFAQへ反映する",
          "更新日と変更履歴を残す"
        ],
        "checks": [
          "レビューを捏造しない",
          "煽りだけで売ろうとしない"
        ],
        "metrics": [
          "FAQ更新",
          "更新件数",
          "再利用率"
        ]
      },
      {
        "id": "portfolio",
        "window": "3か月〜",
        "title": "商品群を体系化する",
        "outcome": "入口・本体・応用の役割を分けられる状態。",
        "tasks": [
          "既存商品を用途別に整理する",
          "重複章を共通化する",
          "収支と更新負荷で継続判断する"
        ],
        "checks": [
          "古い情報を放置しない",
          "税務・規約変更を確認する"
        ],
        "metrics": [
          "更新負荷",
          "継続商品数",
          "再利用資産数"
        ]
      }
    ]
  },
  {
    "slug": "sns-management",
    "title": "SNS運用・集客",
    "category": "SNS・動画・集客",
    "actionHref": "/side-hustles/sns-management",
    "summary": "媒体別の発信の柱、投稿習慣、検証指標、導線を作ります。",
    "refs": [
      "instagramBestPractices",
      "tiktokCreative",
      "caaStealth"
    ],
    "phases": [
      {
        "id": "account",
        "window": "準備",
        "title": "アカウントの役割を固定する",
        "outcome": "誰向けに何を発信し何へつなぐか明確な状態。",
        "tasks": [
          "対象読者・発信テーマ・主目的を決める",
          "プロフィールとリンク先を一致させる",
          "最新ガイドラインを確認する"
        ],
        "checks": [
          "フォロワー数を成果保証に使わない",
          "他媒体文面を機械転用しない"
        ],
        "metrics": [
          "プロフィール完成",
          "投稿の柱3〜5個",
          "CTA方針"
        ]
      },
      {
        "id": "baseline",
        "window": "1〜2週",
        "title": "投稿の基準値を作る",
        "outcome": "複数の投稿型を比較できる状態。",
        "tasks": [
          "柱ごとに2〜3本試す",
          "1投稿1目的で作る",
          "保存・返信・共有・遷移を記録する"
        ],
        "checks": [
          "アルゴリズムの噂を断定しない",
          "投稿条件を記録する"
        ],
        "metrics": [
          "投稿本数",
          "反応差",
          "勝ち筋候補"
        ]
      },
      {
        "id": "series",
        "window": "2〜4週",
        "title": "継続シリーズを作る",
        "outcome": "同じ価値を違う角度で届けられる状態。",
        "tasks": [
          "反応のよい柱をシリーズ化する",
          "画像/動画と本文の役割を分ける",
          "4週間の投稿配分を決める"
        ],
        "checks": [
          "同じフックを連発しない",
          "広告投稿は明瞭表示する"
        ],
        "metrics": [
          "シリーズ数",
          "保存/返信",
          "準備時間"
        ]
      },
      {
        "id": "funnel",
        "window": "1〜2か月",
        "title": "集客導線を整える",
        "outcome": "投稿→プロフィール→記事/商品/相談を測定できる状態。",
        "tasks": [
          "CTAを1つに絞る",
          "遷移先と投稿の約束を一致させる",
          "インサイトで改善する"
        ],
        "checks": [
          "誇張でクリックだけを上げない",
          "媒体規約を確認する"
        ],
        "metrics": [
          "プロフィール遷移",
          "リンク遷移",
          "CTA別反応"
        ]
      },
      {
        "id": "operation",
        "window": "3か月〜",
        "title": "運用を仕組み化する",
        "outcome": "企画・制作・投稿・分析を定例化できる状態。",
        "tasks": [
          "月次で投稿柱を見直す",
          "再利用テンプレートを作る",
          "成果と負荷で継続判断する"
        ],
        "checks": [
          "伸びた投稿のコピー量産を避ける",
          "仕様変更時に見直す"
        ],
        "metrics": [
          "制作時間",
          "再利用率",
          "継続率"
        ]
      }
    ]
  },
  {
    "slug": "youtube-video",
    "title": "YouTube・ショート動画",
    "category": "SNS・動画・集客",
    "actionHref": "/side-hustles/youtube-video",
    "summary": "企画から公開後の視聴維持分析まで段階化します。",
    "refs": [
      "youtubeRetention",
      "tiktokCreative",
      "caaStealth"
    ],
    "phases": [
      {
        "id": "concept",
        "window": "準備",
        "title": "動画の約束を決める",
        "outcome": "誰が何のために見る動画かを一文で説明できる状態。",
        "tasks": [
          "対象視聴者と動画の役割を決める",
          "長尺/ショートで制作型を分ける",
          "タイトル・サムネイルの約束範囲を決める"
        ],
        "checks": [
          "本編にない内容を訴求しない",
          "未確認情報を断定しない"
        ],
        "metrics": [
          "企画候補10件",
          "制作型1〜2種",
          "公開前チェック"
        ]
      },
      {
        "id": "pilot",
        "window": "1〜2週",
        "title": "小さく公開して基準値を作る",
        "outcome": "制作時間と離脱点を把握できる状態。",
        "tasks": [
          "3本程度試作する",
          "長尺は冒頭30秒、短尺はHook→Body→Closeを設計する",
          "制作時間・離脱点・コメントを記録する"
        ],
        "checks": [
          "高コスト編集を最初から固定しない",
          "再生数だけで判断しない"
        ],
        "metrics": [
          "制作時間",
          "冒頭維持",
          "離脱箇所"
        ]
      },
      {
        "id": "format",
        "window": "2〜4週",
        "title": "再現できる動画型を作る",
        "outcome": "企画→台本→素材→編集→公開を同じ手順で回せる状態。",
        "tasks": [
          "タイトル/サムネ/冒頭を一本の約束で接続する",
          "Bロール・テロップの型を作る",
          "トップモーメント等を確認する"
        ],
        "checks": [
          "見せ場を不必要に後半へ隠さない",
          "CTAを詰め込みすぎない"
        ],
        "metrics": [
          "型の再現回数",
          "維持改善",
          "制作時間改善"
        ]
      },
      {
        "id": "library",
        "window": "1〜2か月",
        "title": "動画群で回遊を作る",
        "outcome": "単発動画から関連動画へつなげられる状態。",
        "tasks": [
          "テーマ別シリーズを作る",
          "反応のよい場面を次企画へ展開する",
          "ショートと長尺の役割を分ける"
        ],
        "checks": [
          "関連性の低い誘導をしない",
          "スポンサー表示を確認する"
        ],
        "metrics": [
          "次動画遷移",
          "シリーズ視聴",
          "再利用素材数"
        ]
      },
      {
        "id": "system",
        "window": "3か月〜",
        "title": "制作と分析を継続運用にする",
        "outcome": "月次で次の改善を決められる状態。",
        "tasks": [
          "残す型/捨てる型を決める",
          "素材管理を整える",
          "収益化条件・規約を公式確認する"
        ],
        "checks": [
          "アルゴリズムを断定しない",
          "高負荷な型を惰性で続けない"
        ],
        "metrics": [
          "月次公開率",
          "再利用率",
          "改善仮説数"
        ]
      }
    ]
  },
  {
    "slug": "affiliate",
    "title": "アフィリエイト",
    "category": "販売・収益化",
    "actionHref": "/side-hustles/affiliate",
    "summary": "読者課題、案件調査、比較、広告表示、更新管理まで進めます。",
    "refs": [
      "googlePeopleFirst",
      "caaStealth",
      "ntaSideIncome"
    ],
    "phases": [
      {
        "id": "niche",
        "window": "準備",
        "title": "読者と紹介領域を絞る",
        "outcome": "誰のどの判断を助けるか明確な状態。",
        "tasks": [
          "読者の悩みと検討段階を整理する",
          "公式情報源を洗い出す",
          "広告/PR表示ルールを決める"
        ],
        "checks": [
          "報酬単価だけで選ばない",
          "未使用商品を使用済みと書かない"
        ],
        "metrics": [
          "読者課題一覧",
          "一次情報源",
          "開示方針"
        ]
      },
      {
        "id": "research",
        "window": "1〜2週",
        "title": "比較基準を作る",
        "outcome": "全候補を同じ軸で比較できる状態。",
        "tasks": [
          "公式仕様・料金・条件・更新日を集める",
          "共通比較軸を固定する",
          "事実/経験/第三者意見を分ける"
        ],
        "checks": [
          "価格等に確認日を残す",
          "レビューを一般化しない"
        ],
        "metrics": [
          "比較軸",
          "一次情報取得率",
          "要確認数"
        ]
      },
      {
        "id": "content",
        "window": "2〜4週",
        "title": "判断支援コンテンツを公開する",
        "outcome": "読者が候補を選べる記事/投稿がそろった状態。",
        "tasks": [
          "比較/個別/選び方記事を分ける",
          "people-firstで独自整理を入れる",
          "CTAを自然な次行動にする"
        ],
        "checks": [
          "ランキングを根拠なく作らない",
          "広告表示を明瞭にする"
        ],
        "metrics": [
          "公開本数",
          "比較表",
          "CTA遷移"
        ]
      },
      {
        "id": "optimize",
        "window": "1〜2か月",
        "title": "流入と成約の間を改善する",
        "outcome": "離脱・迷いを仮説検証できる状態。",
        "tasks": [
          "検索意図とのズレを確認する",
          "CTA・比較表・導線を小さく改善する",
          "案件条件を定期確認する"
        ],
        "checks": [
          "煽りでCTRだけを上げない",
          "古い価格を放置しない"
        ],
        "metrics": [
          "更新件数",
          "導線CTR",
          "要確認解消"
        ]
      },
      {
        "id": "portfolio",
        "window": "3か月〜",
        "title": "案件依存を減らす",
        "outcome": "複数案件・記事を更新可能な資産として管理できる状態。",
        "tasks": [
          "案件終了時の代替導線を用意する",
          "最終確認日を管理する",
          "収支と更新負荷で継続判断する"
        ],
        "checks": [
          "提供元規約を定期確認する",
          "税務記録を整理する"
        ],
        "metrics": [
          "更新期限",
          "案件分散",
          "収支記録"
        ]
      }
    ]
  },
  {
    "slug": "adult-affiliate",
    "title": "アダアフィ",
    "category": "販売・収益化",
    "actionHref": "/prompts?category=%E3%82%A2%E3%83%80%E3%82%A2%E3%83%95%E3%82%A3",
    "summary": "18歳以上・広告表示・媒体規約順守を前提に運用します。",
    "refs": [
      "xAdult",
      "caaStealth",
      "googlePeopleFirst",
      "ntaSideIncome"
    ],
    "phases": [
      {
        "id": "compliance",
        "window": "準備",
        "title": "運用可能範囲を決める",
        "outcome": "18歳以上・非露骨・規約順守の境界が明確な状態。",
        "tasks": [
          "案件・媒体の成人向けポリシーを確認する",
          "広告/PR表示と年齢配慮を決める",
          "扱わないテーマ・表現・掲載場所を明文化する"
        ],
        "checks": [
          "未成年・非同意・違法内容を扱わない",
          "規約回避を前提にしない"
        ],
        "metrics": [
          "規約確認日",
          "禁止事項一覧",
          "開示方針"
        ]
      },
      {
        "id": "offer",
        "window": "1〜2週",
        "title": "案件と媒体の適合を確認する",
        "outcome": "案件条件・媒体可否・更新頻度で比較できる状態。",
        "tasks": [
          "案件・ASPを同じ軸で整理する",
          "承認条件・掲載可否を公式確認する",
          "不明数値は要確認として残す"
        ],
        "checks": [
          "架空EPC/CVR等を作らない",
          "使えない媒体へ誘導しない"
        ],
        "metrics": [
          "比較案件数",
          "公式確認率",
          "要確認項目"
        ]
      },
      {
        "id": "content",
        "window": "2〜4週",
        "title": "非露骨な価値コンテンツを作る",
        "outcome": "成人読者に役立つ比較・選び方情報を公開できる状態。",
        "tasks": [
          "SEO記事またはX投稿の柱を作る",
          "内容警告・表示位置を確認する",
          "CTAの広告表示を明瞭にする"
        ],
        "checks": [
          "露骨な性的描写を集客手段にしない",
          "禁止場所を確認する"
        ],
        "metrics": [
          "公開本数",
          "規約チェック率",
          "導線遷移"
        ]
      },
      {
        "id": "funnel",
        "window": "1〜2か月",
        "title": "導線を測定可能にする",
        "outcome": "流入→記事/投稿→公式情報を分けて改善できる状態。",
        "tasks": [
          "比較表・CTAを役割分担する",
          "実測データからボトルネック仮説を作る",
          "規約を壊さないテストだけ行う"
        ],
        "checks": [
          "警告や広告表示を弱めない",
          "誇張でクリックだけを増やさない"
        ],
        "metrics": [
          "CTR",
          "離脱箇所",
          "規約違反ゼロ"
        ]
      },
      {
        "id": "maintenance",
        "window": "3か月〜",
        "title": "規約変更に耐える運用へ移行する",
        "outcome": "案件・媒体ポリシー・記事更新を定期監査できる状態。",
        "tasks": [
          "月次で案件条件と媒体規約を確認する",
          "古い記事・リンク・料金を更新する",
          "収支・確認履歴を整理する"
        ],
        "checks": [
          "古いポリシーを固定ルールにしない",
          "年齢・表示ルールを継続確認する"
        ],
        "metrics": [
          "確認期限超過ゼロ",
          "リンク切れゼロ",
          "更新履歴"
        ]
      }
    ]
  },
  {
    "slug": "resale",
    "title": "物販・フリマ販売",
    "category": "販売・収益化",
    "actionHref": "/side-hustles/resale",
    "summary": "商品確認、撮影、出品、発送、収支、SOP化まで進めます。",
    "refs": [
      "mercariSell",
      "ntaSideIncome"
    ],
    "phases": [
      {
        "id": "inventory",
        "window": "準備",
        "title": "売る物と状態を正確に把握する",
        "outcome": "状態・付属品・動作・欠点を説明できる状態。",
        "tasks": [
          "商品をカテゴリ別に整理する",
          "現物を確認する",
          "原価・送料・手数料の記録項目を決める"
        ],
        "checks": [
          "未確認の定価・購入時期を作らない",
          "禁止商品を確認する"
        ],
        "metrics": [
          "確認済み商品数",
          "不明点数",
          "原価記録"
        ]
      },
      {
        "id": "listing",
        "window": "1週",
        "title": "正確な出品ページを作る",
        "outcome": "写真と説明が一致する状態。",
        "tasks": [
          "型番・色等を正確に入れる",
          "傷・欠品が分かる写真を撮る",
          "AI生成文を現物と照合する"
        ],
        "checks": [
          "欠点を隠さない",
          "他人の画像を無断利用しない"
        ],
        "metrics": [
          "出品数",
          "説明修正数",
          "購入前質問"
        ]
      },
      {
        "id": "fulfillment",
        "window": "2〜4週",
        "title": "発送品質を安定させる",
        "outcome": "梱包・発送・連絡を同じ手順で行える状態。",
        "tasks": [
          "カテゴリ別の梱包手順を作る",
          "発送前チェックを標準化する",
          "取引メッセージをテンプレ化する"
        ],
        "checks": [
          "個人情報を過剰保存しない",
          "不適切な梱包をしない"
        ],
        "metrics": [
          "発送ミス",
          "梱包時間",
          "問い合わせ"
        ]
      },
      {
        "id": "economics",
        "window": "1〜2か月",
        "title": "利益と手間を見える化する",
        "outcome": "送料・手数料・原価・時間込みで判断できる状態。",
        "tasks": [
          "商品別実収支を記録する",
          "売れ残り期間と値下げ履歴を残す",
          "カテゴリ別作業時間を比較する"
        ],
        "checks": [
          "売上=利益とみなさない",
          "値上がりを保証しない"
        ],
        "metrics": [
          "商品別利益",
          "回転日数",
          "作業時間"
        ]
      },
      {
        "id": "system",
        "window": "3か月〜",
        "title": "出品をSOP化する",
        "outcome": "確認/撮影/出品/発送/記録を再現できる状態。",
        "tasks": [
          "チェックリストを作る",
          "低効率カテゴリを見直す",
          "税務・在庫・証憑を整理する"
        ],
        "checks": [
          "規約変更を確認する",
          "過剰在庫を避ける"
        ],
        "metrics": [
          "再出品時間",
          "在庫回転",
          "記録完了率"
        ]
      }
    ]
  },
  {
    "slug": "skill-sales",
    "title": "スキル販売",
    "category": "販売・収益化",
    "actionHref": "/side-hustles/skill-sales",
    "summary": "提供範囲、販売ページ、納品フロー、サービス化まで進めます。",
    "refs": [
      "coconalaSell",
      "freelancerLaw",
      "ntaSideIncome"
    ],
    "phases": [
      {
        "id": "service",
        "window": "準備",
        "title": "売るスキルをサービスに変える",
        "outcome": "購入者が何を受け取り何を用意するか説明できる状態。",
        "tasks": [
          "提供内容・対象者・対象外を決める",
          "納品物・修正範囲・必要素材を決める",
          "サンプル制作を計画する"
        ],
        "checks": [
          "資格・経験を盛らない",
          "成果保証をしない"
        ],
        "metrics": [
          "サービス仕様",
          "対象外一覧",
          "サンプル"
        ]
      },
      {
        "id": "listing",
        "window": "1〜2週",
        "title": "販売ページを完成する",
        "outcome": "タイトル・内容・購入前のお願いが一致する状態。",
        "tasks": [
          "内容が分かるタイトルを作る",
          "サンプル画像/成果物を用意する",
          "購入後の流れとFAQを作る"
        ],
        "checks": [
          "価格・手数料を最新確認する",
          "サンプルを実績と誤認させない"
        ],
        "metrics": [
          "販売ページ",
          "FAQ件数",
          "確認項目"
        ]
      },
      {
        "id": "delivery",
        "window": "2〜4週",
        "title": "納品フローを標準化する",
        "outcome": "ヒアリングから納品までの認識違いを減らせる状態。",
        "tasks": [
          "受付フォームを作る",
          "確認ポイントを決める",
          "取引条件を記録可能な形で確認する"
        ],
        "checks": [
          "無制限修正を約束しない",
          "権利・利用範囲を確認する"
        ],
        "metrics": [
          "納品SOP",
          "確認漏れ",
          "修正理由"
        ]
      },
      {
        "id": "improve",
        "window": "1〜2か月",
        "title": "サービス品質を改善する",
        "outcome": "質問・修正理由から説明や範囲を改善できる状態。",
        "tasks": [
          "問い合わせをFAQへ反映する",
          "修正が多い工程をテンプレ化する",
          "実作業時間と価格を比較する"
        ],
        "checks": [
          "レビューを操作しない",
          "価格変更時に矛盾させない"
        ],
        "metrics": [
          "作業時間",
          "修正回数",
          "問い合わせ分類"
        ]
      },
      {
        "id": "productize",
        "window": "3か月〜",
        "title": "再現可能なサービス群にする",
        "outcome": "本体・オプション等を明確に分けられる状態。",
        "tasks": [
          "本体/オプションを分ける",
          "再利用テンプレートを整備する",
          "取引・収支記録を整理する"
        ],
        "checks": [
          "対応範囲を広げすぎない",
          "契約・規約を更新確認する"
        ],
        "metrics": [
          "リピート率",
          "テンプレ利用率",
          "利益/時間"
        ]
      }
    ]
  },
  {
    "slug": "digital-product",
    "title": "デジタル商品・教材販売",
    "category": "販売・収益化",
    "actionHref": "/side-hustles/digital-product",
    "summary": "購入者の到達状態から逆算して教材を作り、更新まで設計します。",
    "refs": [
      "notePaid",
      "googlePeopleFirst",
      "caaStealth",
      "ntaSideIncome"
    ],
    "phases": [
      {
        "id": "outcome",
        "window": "準備",
        "title": "購入後の完成物を定義する",
        "outcome": "購入者が何をできるようになるか説明できる状態。",
        "tasks": [
          "開始地点と到達地点を決める",
          "対象者・対象外・前提を決める",
          "商品形式を成果物に合わせる"
        ],
        "checks": [
          "情報量だけを価値にしない",
          "成果保証をしない"
        ],
        "metrics": [
          "到達状態",
          "前提条件",
          "形式決定"
        ]
      },
      {
        "id": "prototype",
        "window": "1〜2週",
        "title": "最小教材を作る",
        "outcome": "1つの成果物を完成できる試作品がある状態。",
        "tasks": [
          "章ごとに学ぶ/やる/完成するを設定する",
          "テンプレ/ワークを作る",
          "迷う箇所を確認する"
        ],
        "checks": [
          "架空実績を作らない",
          "引用・素材権利を確認する"
        ],
        "metrics": [
          "試作完成",
          "ワーク数",
          "修正点"
        ]
      },
      {
        "id": "launch",
        "window": "2〜4週",
        "title": "販売可能な一式を完成する",
        "outcome": "本体・サンプル・販売ページ・注意事項がそろった状態。",
        "tasks": [
          "無料/有料の境界を整理する",
          "販売ページと商品内容を照合する",
          "広告表示と販売条件を確認する"
        ],
        "checks": [
          "偽の限定性を使わない",
          "価格等を最新確認する"
        ],
        "metrics": [
          "商品完成",
          "販売ページ",
          "公開前チェック"
        ]
      },
      {
        "id": "feedback",
        "window": "1〜2か月",
        "title": "質問を商品改善へ戻す",
        "outcome": "問い合わせから教材を改善できる状態。",
        "tasks": [
          "質問をFAQへ反映する",
          "更新章に確認日を付ける",
          "止まりやすい工程を簡略化する"
        ],
        "checks": [
          "販売数だけで品質判断しない",
          "サポート範囲を曖昧にしない"
        ],
        "metrics": [
          "FAQ更新",
          "更新章数",
          "サポート時間"
        ]
      },
      {
        "id": "catalog",
        "window": "3か月〜",
        "title": "商品体系を作る",
        "outcome": "入口・本体・応用を重複なく設計できる状態。",
        "tasks": [
          "重複内容を共通化する",
          "更新頻度で維持商品を判断する",
          "収支・証憑を整理する"
        ],
        "checks": [
          "古い教材を放置しない",
          "税務・販売規約を更新確認する"
        ],
        "metrics": [
          "再利用率",
          "更新工数",
          "継続商品数"
        ]
      }
    ]
  },
  {
    "slug": "crowdsourcing",
    "title": "クラウドソーシング",
    "category": "受託・案件獲得",
    "actionHref": "/side-hustles/crowdsourcing",
    "summary": "案件選定、応募、条件確認、納品、継続まで進めます。",
    "refs": [
      "crowdworksGuide",
      "freelancerLaw",
      "ntaSideIncome"
    ],
    "phases": [
      {
        "id": "profile",
        "window": "準備",
        "title": "応募できる土台を作る",
        "outcome": "経験を盛らず対応範囲と成果物を示せる状態。",
        "tasks": [
          "案件種別を1〜2個に絞る",
          "サンプル/ポートフォリオを用意する",
          "契約条件の確認項目を決める"
        ],
        "checks": [
          "未経験を経験済みと書かない",
          "公開不可実績を掲載しない"
        ],
        "metrics": [
          "応募領域",
          "サンプル数",
          "契約チェック"
        ]
      },
      {
        "id": "applications",
        "window": "1〜2週",
        "title": "応募の基準値を作る",
        "outcome": "案件要件と能力を対応づけて応募できる状態。",
        "tasks": [
          "案件文を要件ごとに分解する",
          "プロジェクト/コンペ/タスク形式を確認する",
          "案件固有の応募文を作る"
        ],
        "checks": [
          "テンプレ一斉応募をしない",
          "不明条件は質問へ回す"
        ],
        "metrics": [
          "応募数",
          "適合率",
          "返信/質問"
        ]
      },
      {
        "id": "contract",
        "window": "受注時",
        "title": "取引条件を明確にする",
        "outcome": "作業開始前に成果物・期日・報酬等を確認できる状態。",
        "tasks": [
          "取引条件を記録可能な形で確認する",
          "初稿/確認/修正/納品を区切る",
          "権利・検収条件を確認する"
        ],
        "checks": [
          "口頭だけで進めない",
          "無料追加作業を無制限に受けない"
        ],
        "metrics": [
          "条件確認",
          "未定事項",
          "変更履歴"
        ]
      },
      {
        "id": "delivery",
        "window": "1〜2か月",
        "title": "品質と納期を安定させる",
        "outcome": "受注から納品まで同じSOPで再現できる状態。",
        "tasks": [
          "納品前チェックを作る",
          "変更依頼を記録する",
          "納品後に学びと実績可否を整理する"
        ],
        "checks": [
          "機密を再利用しない",
          "無断公開しない"
        ],
        "metrics": [
          "納期遵守",
          "修正回数",
          "手戻り理由"
        ]
      },
      {
        "id": "repeat",
        "window": "3か月〜",
        "title": "継続案件を選別する",
        "outcome": "単価だけでなく負荷・再現性で案件を選べる状態。",
        "tasks": [
          "案件別の時間と収支を記録する",
          "継続提案を標準化する",
          "契約・税務記録を整理する"
        ],
        "checks": [
          "収益保証を前提にしない",
          "不採算案件を見直す"
        ],
        "metrics": [
          "利益/時間",
          "継続率",
          "再利用SOP数"
        ]
      }
    ]
  },
  {
    "slug": "outreach",
    "title": "営業・案件獲得",
    "category": "受託・案件獲得",
    "actionHref": "/side-hustles/outreach",
    "summary": "ターゲット選定、事前調査、初回連絡、条件確認、継続提案まで整えます。",
    "refs": [
      "freelancerLaw",
      "ntaSideIncome"
    ],
    "phases": [
      {
        "id": "offer",
        "window": "準備",
        "title": "提案内容を1つに絞る",
        "outcome": "誰に何を提供し何を次の一歩にするか明確な状態。",
        "tasks": [
          "提供内容・対象者・対象外を決める",
          "サンプル/説明資料を用意する",
          "最初のお願いを小さく設定する"
        ],
        "checks": [
          "存在しない実績を作らない",
          "相手の課題を決めつけない"
        ],
        "metrics": [
          "オファー1件",
          "サンプル",
          "CTA1件"
        ]
      },
      {
        "id": "research",
        "window": "1週",
        "title": "連絡先リストを作る",
        "outcome": "相手ごとに連絡理由を説明できる状態。",
        "tasks": [
          "公開情報から相手を確認する",
          "提案との接点を1つ記録する",
          "連絡可能な窓口を確認する"
        ],
        "checks": [
          "個人情報を過剰収集しない",
          "大量自動送信を前提にしない"
        ],
        "metrics": [
          "候補数",
          "個別化メモ",
          "連絡可否"
        ]
      },
      {
        "id": "contact",
        "window": "2〜4週",
        "title": "初回連絡を検証する",
        "outcome": "短く返信しやすい提案文を運用できる状態。",
        "tasks": [
          "連絡理由→価値→提案→次行動で書く",
          "フォロー回数を決める",
          "反応理由を記録する"
        ],
        "checks": [
          "偽の緊急性を使わない",
          "断られた相手へ執拗に連絡しない"
        ],
        "metrics": [
          "送信数",
          "返信率",
          "会話化率"
        ]
      },
      {
        "id": "discovery",
        "window": "1〜2か月",
        "title": "案件化前の条件確認を標準化する",
        "outcome": "ヒアリングから見積へ漏れなく進める状態。",
        "tasks": [
          "課題・成果物・納期・予算を確認する",
          "取引条件を記録可能な形で確認する",
          "対応不可と追加対応を分ける"
        ],
        "checks": [
          "成果を保証しない",
          "追加作業を曖昧にしない"
        ],
        "metrics": [
          "商談→提案率",
          "未確定数",
          "失注理由"
        ]
      },
      {
        "id": "pipeline",
        "window": "3か月〜",
        "title": "営業をパイプライン化する",
        "outcome": "新規・検討中・受注・継続を定例管理できる状態。",
        "tasks": [
          "週次でステータス更新する",
          "失注理由を改善へ反映する",
          "継続顧客へ価値ベースで提案する"
        ],
        "checks": [
          "件数だけを追わない",
          "収支・契約・税務記録を整理する"
        ],
        "metrics": [
          "案件化率",
          "継続率",
          "平均作業負荷"
        ]
      }
    ]
  },
  {
    "slug": "research",
    "title": "リサーチ・事実確認",
    "category": "リサーチ・業務効率化",
    "actionHref": "/side-hustles/research",
    "summary": "調査設計、一次情報、比較条件、成果物、更新管理まで進めます。",
    "refs": [
      "freelancerLaw",
      "ntaSideIncome"
    ],
    "phases": [
      {
        "id": "scope",
        "window": "準備",
        "title": "調査の答える範囲を決める",
        "outcome": "問い・期間・対象・成果物が明確な状態。",
        "tasks": [
          "最終判断から主要質問を作る",
          "地域・期間・母集団・最新性を固定する",
          "一次情報を決める"
        ],
        "checks": [
          "スニペットだけで断定しない",
          "現在と過去を混ぜない"
        ],
        "metrics": [
          "主要質問",
          "一次情報候補",
          "比較条件"
        ]
      },
      {
        "id": "evidence",
        "window": "1〜2週",
        "title": "根拠の記録形式を作る",
        "outcome": "主張ごとに出典・日付・適用範囲を追跡できる状態。",
        "tasks": [
          "確認済み/解釈/未確認を分ける",
          "公開日と出来事の日付を記録する",
          "数値条件をそろえる"
        ],
        "checks": [
          "二次情報を一次情報として扱わない",
          "異条件数値を直接比較しない"
        ],
        "metrics": [
          "根拠付き主張",
          "未確認項目",
          "不一致ソース"
        ]
      },
      {
        "id": "deliverable",
        "window": "2〜4週",
        "title": "再利用できる成果物を作る",
        "outcome": "比較表・要約・根拠一覧を同じ形式で納品できる状態。",
        "tasks": [
          "結論と根拠を対応づける",
          "不一致を隠さず説明する",
          "追加調査条件を明示する"
        ],
        "checks": [
          "推測で埋めない",
          "重要な限界を省かない"
        ],
        "metrics": [
          "成果物完成",
          "再検証可能率",
          "追加調査数"
        ]
      },
      {
        "id": "service",
        "window": "1〜2か月",
        "title": "調査をサービス化する",
        "outcome": "受付→調査→レビュー→納品を標準化できる状態。",
        "tasks": [
          "目的・範囲・期日を確認する",
          "途中レビューを設定する",
          "取引条件・機密を記録する"
        ],
        "checks": [
          "機密を外部AIへ無断投入しない",
          "範囲を無断拡大しない"
        ],
        "metrics": [
          "納期",
          "手戻り",
          "調査時間"
        ]
      },
      {
        "id": "maintenance",
        "window": "3か月〜",
        "title": "更新型リサーチへ発展する",
        "outcome": "変化する情報を再調査し差分を記録できる状態。",
        "tasks": [
          "更新頻度を決める",
          "変更点だけ再検証するSOPを作る",
          "収支・契約記録を整理する"
        ],
        "checks": [
          "古い資料を最新版扱いしない",
          "更新日だけ変えない"
        ],
        "metrics": [
          "更新期限遵守",
          "差分検出",
          "再利用率"
        ]
      }
    ]
  },
  {
    "slug": "workflow-efficiency",
    "title": "業務効率化・SOP化",
    "category": "リサーチ・業務効率化",
    "actionHref": "/side-hustles/workflow-efficiency",
    "summary": "現状把握、標準化、AI補助、例外処理、改善まで進めます。",
    "refs": [
      "freelancerLaw",
      "ntaSideIncome"
    ],
    "phases": [
      {
        "id": "observe",
        "window": "準備",
        "title": "現状作業を見える化する",
        "outcome": "入力→処理→確認→保存→引継ぎへ分解できる状態。",
        "tasks": [
          "実際の順序を記録する",
          "担当・入力・出力・完了条件を記録する",
          "ミス影響を分類する"
        ],
        "checks": [
          "理想手順を先に書かない",
          "組織固有ルールを推測しない"
        ],
        "metrics": [
          "工程数",
          "手戻り数",
          "作業時間"
        ]
      },
      {
        "id": "standardize",
        "window": "1〜2週",
        "title": "標準手順を作る",
        "outcome": "初見の人でも同じ結果へ到達できるSOPがある状態。",
        "tasks": [
          "1ステップ1作業/判断へ分ける",
          "チェックリストを作る",
          "例外をIf/Thenで定義する"
        ],
        "checks": [
          "正常系だけで終わらせない",
          "完了条件を省略しない"
        ],
        "metrics": [
          "SOP完成",
          "例外パターン",
          "確認項目"
        ]
      },
      {
        "id": "assist",
        "window": "2〜4週",
        "title": "AI補助を安全に入れる",
        "outcome": "AIに渡す/渡さない情報と人の確認点が明確な状態。",
        "tasks": [
          "低リスク工程から試す",
          "個人情報・機密・権限を確認する",
          "前後の時間と品質を比較する"
        ],
        "checks": [
          "高リスク判断を自動化しない",
          "公開・送信を勝手に自動化しない"
        ],
        "metrics": [
          "削減時間",
          "エラー率",
          "人確認箇所"
        ]
      },
      {
        "id": "automation",
        "window": "1〜2か月",
        "title": "部分自動化を安定させる",
        "outcome": "失敗時に再試行・ロールバックできる状態。",
        "tasks": [
          "自動化対象を小さく分ける",
          "ログ/記録/通知を残す",
          "失敗時フローを作る"
        ],
        "checks": [
          "無限再試行しない",
          "権限確認を省略しない"
        ],
        "metrics": [
          "自動化率",
          "失敗件数",
          "復旧時間"
        ]
      },
      {
        "id": "improve",
        "window": "3か月〜",
        "title": "SOPを継続改善する",
        "outcome": "品質と作業時間の両方から更新できる状態。",
        "tasks": [
          "月次で例外・手戻りをレビューする",
          "不要工程を削除する",
          "契約・機密・税務記録を整理する"
        ],
        "checks": [
          "古いSOPを放置しない",
          "効率だけで品質を犠牲にしない"
        ],
        "metrics": [
          "更新頻度",
          "削減時間",
          "品質指標"
        ]
      }
    ]
  },
  {
    "slug": "sidejob-planner",
    "title": "AI副業プランナー",
    "category": "副業設計",
    "actionHref": "/side-hustles/sidejob-planner",
    "summary": "自分に合う副業候補を選び、30日検証から継続判断まで進めます。",
    "refs": [
      "ntaSideIncome",
      "freelancerLaw"
    ],
    "phases": [
      {
        "id": "constraints",
        "window": "準備",
        "title": "自分の条件を数値化する",
        "outcome": "時間・予算・得意・営業可否を比較できる状態。",
        "tasks": [
          "週の使える時間を決める",
          "初期予算と固定費上限を決める",
          "得意・苦手・営業可否を整理する"
        ],
        "checks": [
          "属性から向き不向きを決めつけない",
          "収益額で過大評価しない"
        ],
        "metrics": [
          "時間上限",
          "予算上限",
          "制約一覧"
        ]
      },
      {
        "id": "shortlist",
        "window": "1週",
        "title": "候補を3〜5件へ絞る",
        "outcome": "候補ごとの成果物と集客方法を比較できる状態。",
        "tasks": [
          "最初に作る成果物を定義する",
          "必要ツール・費用・集客方法を比較する",
          "AAS専用機能への導線を確認する"
        ],
        "checks": [
          "成功確率を作らない",
          "相場を未確認で断定しない"
        ],
        "metrics": [
          "候補数",
          "比較表",
          "最初の成果物"
        ]
      },
      {
        "id": "experiment",
        "window": "2〜4週",
        "title": "30日検証を行う",
        "outcome": "小さな公開/応募/販売を経験し実データを得られる状態。",
        "tasks": [
          "週1つの検証行動を設定する",
          "作業時間・反応・学びを記録する",
          "必要なら候補を1つに絞る"
        ],
        "checks": [
          "初月収益だけで判断しない",
          "固定費を増やしすぎない"
        ],
        "metrics": [
          "実行回数",
          "作業時間",
          "反応/学び"
        ]
      },
      {
        "id": "commit",
        "window": "1〜2か月",
        "title": "続ける候補を決める",
        "outcome": "継続・修正・中止の基準で選べる状態。",
        "tasks": [
          "実測負荷と反応を比較する",
          "90日目標を設定する",
          "税務・契約・広告の確認事項を洗い出す"
        ],
        "checks": [
          "サンクコストで続けない",
          "収益保証を前提にしない"
        ],
        "metrics": [
          "継続候補",
          "90日目標",
          "停止理由"
        ]
      },
      {
        "id": "specialize",
        "window": "3か月〜",
        "title": "副業を仕組みにする",
        "outcome": "専用ロードマップへ移行し再現可能にできる状態。",
        "tasks": [
          "選んだ副業の専用ロードマップへ切り替える",
          "月次で収支・時間・スキルを確認する",
          "税務・契約記録を整理する"
        ],
        "checks": [
          "生活を圧迫する稼働を放置しない",
          "規約・法令は最新確認する"
        ],
        "metrics": [
          "継続月数",
          "収支/時間",
          "スキル資産"
        ]
      }
    ]
  }
];

export const SIDE_HUSTLE_ROADMAP_CATEGORIES = [
  "すべて",
  ...Array.from(new Set(SIDE_HUSTLE_ROADMAPS.map((roadmap) => roadmap.category))),
] as const;

export function getSideHustleRoadmap(slug: string): SideHustleRoadmapDefinition | undefined {
  return SIDE_HUSTLE_ROADMAPS.find((roadmap) => roadmap.slug === slug);
}

export function roadmapTaskKey(slug: string, phaseId: string, taskIndex: number): string {
  return slug + ":" + phaseId + ":" + String(taskIndex);
}
