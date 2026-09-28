-- Phase 69: scenario-aware side-hustle Knowledge depth.
-- Adds five context-specific rules per side-hustle task (60 total) without changing the stable schema.
-- Scenario metadata is encoded in keys:
-- auto:scenario:<task>:<dimension>:<value>:<slug>-20260925
-- Client compiler activates these only when the current wizard selections derive the same scenario tag.
-- Priorities intentionally stay below baseline task/support rules so server-side Stable baseline gates remain unaffected.
-- Official/public-primary sources checked 2026-09-25. Fresh-first; Stable follows the existing reviewed promotion flow.

do $migration$
declare
  next_version bigint;
  stable_delay_hours integer := 168;
  stable_at timestamptz;
begin
  select greatest(current_version + 1, 9)
  into next_version
  from public.knowledge_refresh_channels
  where channel = 'fresh'
  for update;

  select coalesce(stable_knowledge_refresh_hours, 168)
  into stable_delay_hours
  from public.creator_system_settings
  where id = 1;

  stable_delay_hours := greatest(stable_delay_hours, 1);
  stable_at := now() + make_interval(hours => stable_delay_hours);

  with raw as (
    select value as item
    from jsonb_array_elements($rows$[
  {
    "key": "auto:scenario:sidejob_content:experience:beginner:one-outcome-first-20260925",
    "label": "初心者向け：最初の商品は1つの完成状態へ絞る",
    "aliases": [
      "experience:beginner"
    ],
    "guidance": [
      "初めて販売する場合は、読者が購入後に1つの具体的な成果物または判断を完成できる範囲へ絞る",
      "前提知識を省略せず、用語・手順・確認ポイントを順番に置く"
    ],
    "deliverables": [
      "対象者/対象外",
      "完成状態",
      "最短実行手順",
      "公開前チェック"
    ],
    "cautions": [
      "未確認の成果・売上・成功率を保証しない",
      "情報量だけを増やして価値が高いと見せない"
    ],
    "tasks": [
      "sidejob_content"
    ],
    "priority": 48,
    "source_urls": [
      "https://www.help-note.com/hc/ja/sections/24999788721177",
      "https://www.no-trouble.caa.go.jp/what/mailorder/advertising.php"
    ],
    "source_summary": "2026-09-25確認。note公式の有料コンテンツ案内と消費者庁の通信販売表示を、初回商品設計の購入前説明と実行可能性へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_content:experience:experienced:systemize-series-20260925",
    "label": "経験者向け：単品をシリーズ・更新可能な仕組みへ再設計する",
    "aliases": [
      "experience:experienced"
    ],
    "guidance": [
      "既存コンテンツの重複を減らし、基礎・実践・応用・更新情報の役割を分ける",
      "更新が必要な章と長期利用できるテンプレートを分離する"
    ],
    "deliverables": [
      "コンテンツ体系図",
      "重複整理表",
      "更新対象一覧",
      "再利用テンプレート"
    ],
    "cautions": [
      "未確認の成果・売上・成功率を保証しない",
      "価格・規約・仕様など変動情報は公開時点の公式情報を確認する"
    ],
    "tasks": [
      "sidejob_content"
    ],
    "priority": 47,
    "source_urls": [
      "https://www.help-note.com/hc/ja/sections/24999788721177",
      "https://www.bunka.go.jp/chosakuken/"
    ],
    "source_summary": "2026-09-25確認。note公式の有料コンテンツ運用と文化庁の著作権情報を、既存資産の再編集・再利用時の確認へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_content:mode:production:deliverable-backward-design-20260925",
    "label": "制作向け：読後に完成する成果物から章構成を逆算する",
    "aliases": [
      "mode:production"
    ],
    "guidance": [
      "各章を読むこと自体ではなく、章を終えた時に何が完成するかを定義してから本文を作る",
      "説明・例・テンプレート・チェックを成果物に必要な順で配置する"
    ],
    "deliverables": [
      "章ごとの完成物",
      "テンプレート",
      "記入例",
      "完了条件"
    ],
    "cautions": [
      "架空の事例を実例として扱わない",
      "他者素材の権利条件を未確認で流用しない"
    ],
    "tasks": [
      "sidejob_content"
    ],
    "priority": 46,
    "source_urls": [
      "https://www.help-note.com/hc/ja/sections/24999788721177",
      "https://www.bunka.go.jp/chosakuken/"
    ],
    "source_summary": "2026-09-25確認。有料コンテンツの提供設計と著作物利用の公式情報を、制作工程と付属物の設計へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_content:mode:sales:free-paid-boundary-20260925",
    "label": "販売向け：無料範囲・有料価値・条件・CTAを分離する",
    "aliases": [
      "mode:sales"
    ],
    "guidance": [
      "無料部分だけでも対象者と内容を判断できる情報を残し、有料部分では具体的な実行手順・テンプレート等の追加価値を明示する",
      "販売条件や注意事項は購入前に確認できる位置へ置く"
    ],
    "deliverables": [
      "無料/有料境界表",
      "購入前説明",
      "注意事項",
      "CTA"
    ],
    "cautions": [
      "根拠のない希少性や煽りを作らない",
      "価格・規約・仕様など変動情報は公開時点の公式情報を確認する"
    ],
    "tasks": [
      "sidejob_content"
    ],
    "priority": 45,
    "source_urls": [
      "https://www.help-note.com/hc/ja/sections/24999788721177",
      "https://www.no-trouble.caa.go.jp/what/mailorder/advertising.php"
    ],
    "source_summary": "2026-09-25確認。note公式の有料コンテンツ案内と消費者庁の通信販売表示を、無料/有料境界と購入前説明へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_content:medium:note:note-paid-flow-20260925",
    "label": "note向け：有料ライン前で購入判断に必要な情報を揃える",
    "aliases": [
      "medium:note"
    ],
    "guidance": [
      "noteで有料記事を作る場合は、有料ラインより前に対象者・得られる内容・前提条件・注意点を読み取れる構成を優先する",
      "有料部分では約束した内容と実際の本文・付属物を一致させる"
    ],
    "deliverables": [
      "無料部分の導入",
      "有料部分の見出し",
      "購入前確認項目"
    ],
    "cautions": [
      "有料であることを成果保証の根拠にしない",
      "価格・規約・仕様など変動情報は公開時点の公式情報を確認する"
    ],
    "tasks": [
      "sidejob_content"
    ],
    "priority": 44,
    "source_urls": [
      "https://www.help-note.com/hc/ja/sections/24999788721177"
    ],
    "source_summary": "2026-09-25確認。note公式ヘルプの有料記事・有料コンテンツ案内を、note媒体固有の購入導線へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_sns:experience:beginner:one-platform-one-goal-20260925",
    "label": "初心者向け：1媒体・1目的・少数の投稿軸から始める",
    "aliases": [
      "experience:beginner"
    ],
    "guidance": [
      "初期運用では複数媒体を同時最適化せず、主媒体と最優先目的を1つ決める",
      "投稿の柱を2〜3個に絞り、各投稿の役割を認知・信頼・誘導などで明示する"
    ],
    "deliverables": [
      "投稿の柱",
      "2週間の投稿案",
      "確認指標"
    ],
    "cautions": [
      "未確認の成果・売上・成功率を保証しない",
      "単発投稿の数値だけで再現性を判断しない"
    ],
    "tasks": [
      "sidejob_sns"
    ],
    "priority": 48,
    "source_urls": [
      "https://help.x.com/ja/using-x/view-counts",
      "https://help.x.com/ja/using-x/media-studio-analytics"
    ],
    "source_summary": "2026-09-25確認。X公式の表示回数・分析機能を、初期運用の目的分離と検証へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_sns:experience:experienced:period-format-comparison-20260925",
    "label": "経験者向け：期間・形式を揃えて運用改善を比較する",
    "aliases": [
      "experience:experienced"
    ],
    "guidance": [
      "継続運用では投稿単位の当たり外れより、期間・形式・テーマを揃えた比較で改善仮説を作る",
      "変更した要素を1つずつ記録し、到達・反応・遷移を分けて見る"
    ],
    "deliverables": [
      "改善ログ",
      "形式別比較",
      "次回テスト仮説"
    ],
    "cautions": [
      "相関だけで原因を断定しない",
      "アルゴリズムを未確認の固定ルールとして断定しない"
    ],
    "tasks": [
      "sidejob_sns"
    ],
    "priority": 47,
    "source_urls": [
      "https://help.x.com/ja/using-x/media-studio-analytics",
      "https://support.google.com/youtube/answer/9002587?hl=ja"
    ],
    "source_summary": "2026-09-25確認。X/YouTube公式Analyticsの指標確認を、継続運用の比較・改善へ横断適用。"
  },
  {
    "key": "auto:scenario:sidejob_sns:mode:production:content-system-20260925",
    "label": "制作向け：投稿の柱から再利用できる制作単位を作る",
    "aliases": [
      "mode:production"
    ],
    "guidance": [
      "1テーマを短文・図解・動画等へ展開する場合も、媒体ごとにフックとCTAを作り直す",
      "素材・事実・CTAを再利用可能な部品として管理し、同じ文面の機械的転載を避ける"
    ],
    "deliverables": [
      "投稿フォーマット",
      "素材台帳",
      "CTA候補",
      "制作チェック"
    ],
    "cautions": [
      "第三者素材や引用の権利確認を省略しない",
      "未確認の体験談を投稿へ追加しない"
    ],
    "tasks": [
      "sidejob_sns"
    ],
    "priority": 46,
    "source_urls": [
      "https://help.x.com/ja/using-x/media-studio-analytics",
      "https://www.bunka.go.jp/chosakuken/"
    ],
    "source_summary": "2026-09-25確認。SNS公式分析と文化庁の著作権情報を、継続制作と素材再利用の確認へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_sns:mode:acquisition:funnel-stages-20260925",
    "label": "集客向け：到達・プロフィール・遷移・問い合わせを段階で分ける",
    "aliases": [
      "mode:acquisition"
    ],
    "guidance": [
      "集客では表示回数だけを成果にせず、プロフィール閲覧・リンク遷移・問い合わせ等の次段階を目的に合わせて確認する",
      "CTAは一投稿で一つを基本にし、投稿内容との関係が自然な次行動を置く"
    ],
    "deliverables": [
      "集客段階表",
      "CTA設計",
      "段階別確認指標"
    ],
    "cautions": [
      "未確認の成果・売上・成功率を保証しない",
      "表示回数だけから購入意欲を推定しない"
    ],
    "tasks": [
      "sidejob_sns"
    ],
    "priority": 45,
    "source_urls": [
      "https://help.x.com/ja/using-x/view-counts",
      "https://help.x.com/ja/using-x/media-studio-analytics"
    ],
    "source_summary": "2026-09-25確認。X公式の表示回数・分析情報を、認知から次行動までの段階別評価へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_sns:medium:x:x-metrics-operation-20260925",
    "label": "X向け：表示回数と反応を分けて投稿を改善する",
    "aliases": [
      "medium:x"
    ],
    "guidance": [
      "Xでは表示回数を到達の参考値として扱い、反応や遷移と分けて改善する",
      "投稿形式・テーマ・時間帯など変更点を記録し、一定期間で比較する"
    ],
    "deliverables": [
      "X投稿改善ログ",
      "表示/反応の確認表",
      "次回テスト"
    ],
    "cautions": [
      "表示回数を閲覧人数や売上と同一視しない",
      "価格・規約・仕様など変動情報は公開時点の公式情報を確認する"
    ],
    "tasks": [
      "sidejob_sns"
    ],
    "priority": 44,
    "source_urls": [
      "https://help.x.com/ja/using-x/view-counts",
      "https://help.x.com/ja/using-x/media-studio-analytics"
    ],
    "source_summary": "2026-09-25確認。X公式のview countsとMedia Studio Analyticsを、X媒体固有の改善へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_video:experience:beginner:one-message-structure-20260925",
    "label": "初心者向け：1本1メッセージで動画構成を簡潔にする",
    "aliases": [
      "experience:beginner"
    ],
    "guidance": [
      "最初は動画ごとに伝える結論を1つ決め、冒頭・本編・まとめをその結論へ接続する",
      "撮影・収録前に必要素材と確認事項を短いチェックへ落とす"
    ],
    "deliverables": [
      "一文の結論",
      "冒頭設計",
      "構成",
      "素材チェック"
    ],
    "cautions": [
      "未確認の成果・売上・成功率を保証しない",
      "確認できないゲーム仕様や数値を台本へ補完しない"
    ],
    "tasks": [
      "sidejob_video"
    ],
    "priority": 48,
    "source_urls": [
      "https://support.google.com/youtube/answer/9002587?hl=ja",
      "https://support.google.com/youtube/answer/9314416?hl=ja"
    ],
    "source_summary": "2026-09-25確認。YouTube公式Analytics/視聴者情報を、初心者向けの明確な動画設計と振り返りへ反映。"
  },
  {
    "key": "auto:scenario:sidejob_video:experience:experienced:retention-hypothesis-20260925",
    "label": "経験者向け：視聴維持と視聴者情報から改善仮説を作る",
    "aliases": [
      "experience:experienced"
    ],
    "guidance": [
      "経験者は全体再生数だけでなく、視聴維持・視聴者情報・流入等を目的に応じて確認する",
      "離脱箇所と構成上の出来事を対応付け、次回は変更点を限定して検証する"
    ],
    "deliverables": [
      "離脱仮説",
      "構成変更案",
      "比較期間",
      "改善ログ"
    ],
    "cautions": [
      "単一指標で動画品質を断定しない",
      "短期間の変動からアルゴリズムを推測しすぎない"
    ],
    "tasks": [
      "sidejob_video"
    ],
    "priority": 47,
    "source_urls": [
      "https://support.google.com/youtube/answer/9002587?hl=ja",
      "https://support.google.com/youtube/answer/9314416?hl=ja"
    ],
    "source_summary": "2026-09-25確認。YouTube公式AnalyticsとAudience情報を、継続チャンネルの改善仮説へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_video:mode:production:script-to-publish-check-20260925",
    "label": "制作向け：台本・素材・編集・公開前確認を一つの工程にする",
    "aliases": [
      "mode:production"
    ],
    "guidance": [
      "台本、収録素材、差し込み素材、テロップ、サムネイルを別工程として管理し、公開前に内容一致を確認する",
      "AIで作った説明や字幕も、事実・固有名詞・数値を人が確認する"
    ],
    "deliverables": [
      "制作工程表",
      "素材リスト",
      "公開前チェック"
    ],
    "cautions": [
      "第三者素材の利用条件を未確認で使わない",
      "AI出力だけで事実確認済みとしない"
    ],
    "tasks": [
      "sidejob_video"
    ],
    "priority": 46,
    "source_urls": [
      "https://www.bunka.go.jp/chosakuken/",
      "https://support.google.com/youtube/answer/9002587?hl=ja"
    ],
    "source_summary": "2026-09-25確認。文化庁の著作権情報とYouTube公式Analyticsを、動画制作・公開前確認へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_video:mode:acquisition:title-thumbnail-to-content-20260925",
    "label": "集客向け：タイトル・サムネイルと動画内容を一致させる",
    "aliases": [
      "mode:acquisition"
    ],
    "guidance": [
      "クリックを得るための表現は本編で実際に提供する内容と一致させる",
      "視聴後CTAは登録・次動画・概要欄など目的を一つに絞り、動画の価値提供後に置く"
    ],
    "deliverables": [
      "タイトル訴求",
      "サムネイル要点",
      "CTA",
      "確認指標"
    ],
    "cautions": [
      "本編にない成果や断定をタイトルだけに追加しない",
      "未確認の成果・売上・成功率を保証しない"
    ],
    "tasks": [
      "sidejob_video"
    ],
    "priority": 45,
    "source_urls": [
      "https://support.google.com/youtube/answer/9002587?hl=ja",
      "https://support.google.com/youtube/answer/9314416?hl=ja"
    ],
    "source_summary": "2026-09-25確認。YouTube公式Analytics/視聴者情報を、クリック後の視聴体験とCTA整合へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_video:medium:youtube:youtube-analytics-loop-20260925",
    "label": "YouTube向け：Analyticsを企画・構成・改善へ戻す",
    "aliases": [
      "medium:youtube"
    ],
    "guidance": [
      "YouTube Studioの分析を、次の企画・冒頭・構成を変えるための材料として使う",
      "比較時は期間や動画形式を揃え、数値の意味をレポート定義に沿って解釈する"
    ],
    "deliverables": [
      "YouTube改善メモ",
      "次回企画仮説",
      "比較条件"
    ],
    "cautions": [
      "指標定義や画面仕様が固定と断定しない",
      "価格・規約・仕様など変動情報は公開時点の公式情報を確認する"
    ],
    "tasks": [
      "sidejob_video"
    ],
    "priority": 44,
    "source_urls": [
      "https://support.google.com/youtube/answer/9002587?hl=ja",
      "https://support.google.com/youtube/answer/9314416?hl=ja"
    ],
    "source_summary": "2026-09-25確認。YouTube公式Analyticsと視聴者レポートを、媒体固有の改善サイクルへ反映。"
  },
  {
    "key": "auto:scenario:sidejob_affiliate:experience:beginner:official-first-20260925",
    "label": "初心者向け：公式情報と自分の経験を明確に分ける",
    "aliases": [
      "experience:beginner"
    ],
    "guidance": [
      "初めて紹介する場合は、仕様・価格条件・提供範囲を公式情報から確認し、自分が使っていないものは使用経験として書かない",
      "比較軸は読者の用途から先に決め、都合のよい項目だけを選ばない"
    ],
    "deliverables": [
      "確認項目",
      "公式URL",
      "比較軸",
      "未確認事項"
    ],
    "cautions": [
      "利用していない商品を使用済みと書かない",
      "価格・規約・仕様など変動情報は公開時点の公式情報を確認する"
    ],
    "tasks": [
      "sidejob_affiliate"
    ],
    "priority": 48,
    "source_urls": [
      "https://www.caa.go.jp/policies/policy/representation/fair_labeling/stealth_marketing",
      "https://developers.openai.com/api/docs/guides/tools-web-search"
    ],
    "source_summary": "2026-09-25確認。消費者庁の広告表示情報と公式Web検索ガイドを、初心者の根拠分離・事実確認へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_affiliate:experience:experienced:comparison-maintenance-20260925",
    "label": "経験者向け：比較表を更新可能なデータとして管理する",
    "aliases": [
      "experience:experienced"
    ],
    "guidance": [
      "複数商品の比較では全候補に同じ軸を適用し、確認日と情報源を列ごとに残す",
      "価格・プラン・仕様変更が起きやすい項目を更新対象として分離する"
    ],
    "deliverables": [
      "比較マスター",
      "確認日",
      "変更履歴",
      "更新対象一覧"
    ],
    "cautions": [
      "古い比較結果を現在の事実として流用しない",
      "ランキングを根拠なく作らない"
    ],
    "tasks": [
      "sidejob_affiliate"
    ],
    "priority": 47,
    "source_urls": [
      "https://developers.openai.com/api/docs/guides/tools-web-search",
      "https://www.no-trouble.caa.go.jp/what/mailorder/advertising.php"
    ],
    "source_summary": "2026-09-25確認。公式Web検索と通信販売表示の公的情報を、比較コンテンツの更新管理へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_affiliate:mode:research:evidence-layers-20260925",
    "label": "調査向け：事実・自分の経験・第三者評価を別レイヤーで扱う",
    "aliases": [
      "mode:research"
    ],
    "guidance": [
      "商品情報を調べる時は公式事実、自分の確認済み経験、第三者評価を混ぜずに記録する",
      "変動情報は参照ページを開き、対象プラン・地域・日付まで確認する"
    ],
    "deliverables": [
      "事実表",
      "経験メモ",
      "第三者情報",
      "根拠URL"
    ],
    "cautions": [
      "検索結果スニペットだけで断定しない",
      "第三者レビューを自分の経験として書かない"
    ],
    "tasks": [
      "sidejob_affiliate"
    ],
    "priority": 46,
    "source_urls": [
      "https://developers.openai.com/api/docs/guides/tools-web-search",
      "https://www.caa.go.jp/policies/policy/representation/fair_labeling/stealth_marketing"
    ],
    "source_summary": "2026-09-25確認。公式Web検索ガイドと消費者庁の広告識別情報を、根拠レイヤー分離へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_affiliate:mode:sales:ad-disclosure-cta-20260925",
    "label": "販売向け：広告であることを分かる形にし判断支援を優先する",
    "aliases": [
      "mode:sales"
    ],
    "guidance": [
      "広告・プロモーションに当たる表示は、消費者が広告であることを判別できる明瞭さを確認する",
      "CTA前に向いている条件・向かない可能性・確認すべき公式条件を示す"
    ],
    "deliverables": [
      "広告表示確認",
      "購入前条件",
      "CTA",
      "公開前チェック"
    ],
    "cautions": [
      "広告表示を目立たなくする工夫をしない",
      "成果や効果を未確認で断定しない"
    ],
    "tasks": [
      "sidejob_affiliate"
    ],
    "priority": 45,
    "source_urls": [
      "https://www.caa.go.jp/policies/policy/representation/fair_labeling/stealth_marketing",
      "https://www.no-trouble.caa.go.jp/what/mailorder/advertising.php"
    ],
    "source_summary": "2026-09-25確認。消費者庁のステルスマーケティング/通信販売情報を、広告表示とCTAへ反映。"
  },
  {
    "key": "auto:scenario:sidejob_affiliate:medium:blog:blog-update-block-20260925",
    "label": "ブログ・SEO向け：比較記事に更新日と確認ポイントを持たせる",
    "aliases": [
      "medium:blog"
    ],
    "guidance": [
      "長期公開する比較記事では、変動しやすい価格・プラン・仕様と、変わりにくい判断基準を分ける",
      "更新時は結論だけでなく根拠URLと比較表を再確認する"
    ],
    "deliverables": [
      "更新日",
      "再確認リスト",
      "比較表",
      "変更履歴"
    ],
    "cautions": [
      "検索順位を品質や収益の保証として扱わない",
      "価格・規約・仕様など変動情報は公開時点の公式情報を確認する"
    ],
    "tasks": [
      "sidejob_affiliate"
    ],
    "priority": 44,
    "source_urls": [
      "https://developers.openai.com/api/docs/guides/tools-web-search",
      "https://www.no-trouble.caa.go.jp/what/mailorder/advertising.php"
    ],
    "source_summary": "2026-09-25確認。公式Web検索ガイドと消費者庁の通信販売情報を、長期公開する比較記事の更新へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_resale:experience:beginner:listing-checklist-20260925",
    "label": "初心者向け：状態・付属品・写真・発送を出品前に揃える",
    "aliases": [
      "experience:beginner"
    ],
    "guidance": [
      "初出品では商品名、型番、状態、付属品、動作確認の有無を確認済み/未確認で分ける",
      "購入者が判断できる写真箇所と発送方法を出品前に決める"
    ],
    "deliverables": [
      "商品情報表",
      "撮影リスト",
      "付属品確認",
      "発送確認"
    ],
    "cautions": [
      "傷や動作状態を推測で補完しない",
      "正規品・真贋を根拠なく断定しない"
    ],
    "tasks": [
      "sidejob_resale"
    ],
    "priority": 48,
    "source_urls": [
      "https://help.jp.mercari.com/guide/articles/64/",
      "https://help.jp.mercari.com/guide/articles/107/"
    ],
    "source_summary": "2026-09-25確認。メルカリ公式の価格設定・送料案内を、初出品の確認項目へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_resale:experience:experienced:repeatable-inventory-20260925",
    "label": "経験者向け：継続出品を在庫・費用・説明テンプレートで標準化する",
    "aliases": [
      "experience:experienced"
    ],
    "guidance": [
      "継続販売では仕入れ、販売価格、手数料、送料、受取額を商品単位で記録する",
      "カテゴリ別の状態説明・撮影・梱包テンプレートを作り、個別商品の事実だけ差し替える"
    ],
    "deliverables": [
      "商品台帳",
      "費用記録",
      "説明テンプレート",
      "梱包テンプレート"
    ],
    "cautions": [
      "未確認の成果・売上・成功率を保証しない",
      "価格・規約・仕様など変動情報は公開時点の公式情報を確認する"
    ],
    "tasks": [
      "sidejob_resale"
    ],
    "priority": 47,
    "source_urls": [
      "https://help.jp.mercari.com/guide/articles/64/",
      "https://help.jp.mercari.com/guide/articles/107/"
    ],
    "source_summary": "2026-09-25確認。メルカリ公式の価格/送料案内を、継続出品の費用・在庫管理へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_resale:mode:production:photo-description-evidence-20260925",
    "label": "制作向け：写真と説明文で同じ状態情報を示す",
    "aliases": [
      "mode:production"
    ],
    "guidance": [
      "傷・使用感・付属品など重要な状態は、説明文だけでなく写真でも確認できるよう撮影箇所を決める",
      "未確認事項は断定せず、確認できないこと自体を説明へ反映する"
    ],
    "deliverables": [
      "写真カット表",
      "状態説明",
      "未確認事項"
    ],
    "cautions": [
      "写真で見えない状態を推測しない",
      "画像加工で状態を誤認させない"
    ],
    "tasks": [
      "sidejob_resale"
    ],
    "priority": 46,
    "source_urls": [
      "https://help.jp.mercari.com/guide/articles/64/"
    ],
    "source_summary": "2026-09-25確認。メルカリ公式の出品価格・商品情報案内を、状態説明と購入判断材料の整合へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_resale:mode:sales:takehome-before-price-20260925",
    "label": "販売向け：販売価格・手数料・送料・最低受取額を分ける",
    "aliases": [
      "mode:sales"
    ],
    "guidance": [
      "価格を決める前に販売価格から差し引かれる費用を項目ごとに確認し、想定受取額を計算する",
      "値下げ条件を決める場合も最低受取額を下回らないか確認する"
    ],
    "deliverables": [
      "価格候補",
      "費用項目",
      "想定受取額",
      "値下げ下限"
    ],
    "cautions": [
      "利益を保証する価格として提示しない",
      "価格・規約・仕様など変動情報は公開時点の公式情報を確認する"
    ],
    "tasks": [
      "sidejob_resale"
    ],
    "priority": 45,
    "source_urls": [
      "https://help.jp.mercari.com/guide/articles/64/",
      "https://help.jp.mercari.com/guide/articles/107/"
    ],
    "source_summary": "2026-09-25確認。メルカリ公式の価格設定・送料案内を、販売価格と手取りの分離へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_resale:medium:mercari:mercari-current-rules-20260925",
    "label": "メルカリ向け：出品時点の価格・送料条件を公式で再確認する",
    "aliases": [
      "medium:mercari"
    ],
    "guidance": [
      "メルカリで出品する場合は、価格設定と配送負担・配送方法に関する現在の公式案内を出品時に確認する",
      "Knowledge内の固定率・固定送料ではなく、公式表示を入力値として使う"
    ],
    "deliverables": [
      "公式確認項目",
      "価格計算",
      "発送条件"
    ],
    "cautions": [
      "価格・規約・仕様など変動情報は公開時点の公式情報を確認する",
      "過去の手数料・送料を現在値として扱わない"
    ],
    "tasks": [
      "sidejob_resale"
    ],
    "priority": 44,
    "source_urls": [
      "https://help.jp.mercari.com/guide/articles/64/",
      "https://help.jp.mercari.com/guide/articles/107/"
    ],
    "source_summary": "2026-09-25確認。メルカリ公式ヘルプの価格設定・送料負担を、媒体固有の出品確認へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_crowdsourcing:experience:beginner:honest-proposal-20260925",
    "label": "初心者向け：経験を盛らず要件理解と進め方で提案する",
    "aliases": [
      "experience:beginner"
    ],
    "guidance": [
      "未経験の場合は経験年数を作らず、案件要件の理解・対応可能範囲・確認質問・進め方を具体化する",
      "個人制作等の提示可能な事実がある時だけ、案件要件との対応関係を示す"
    ],
    "deliverables": [
      "要件表",
      "対応可否",
      "応募文",
      "確認質問"
    ],
    "cautions": [
      "架空の職歴・資格・案件数・評価を作らない",
      "仮払い等の必要手続き前に完成作業を始める前提にしない"
    ],
    "tasks": [
      "sidejob_crowdsourcing"
    ],
    "priority": 48,
    "source_urls": [
      "https://crowdworks.jp/pages/guidelines/job_offer",
      "https://crowdworks.jp/pages/guidelines/message"
    ],
    "source_summary": "2026-09-25確認。クラウドワークス公式の仕事依頼/連絡ガイドラインを、初心者応募の誠実な要件対応へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_crowdsourcing:experience:experienced:scope-acceptance-20260925",
    "label": "経験者向け：作業範囲・修正・検収条件を受注前に固定する",
    "aliases": [
      "experience:experienced"
    ],
    "guidance": [
      "経験案件では成果物だけでなく、作業範囲、素材支給、初稿、修正、検収、納品形式を合意項目にする",
      "追加作業が発生する条件を見積もり前に分離する"
    ],
    "deliverables": [
      "スコープ表",
      "修正条件",
      "検収条件",
      "追加作業条件"
    ],
    "cautions": [
      "曖昧な要件を自己判断だけで確定しない",
      "契約条件を入力なしに創作しない"
    ],
    "tasks": [
      "sidejob_crowdsourcing"
    ],
    "priority": 47,
    "source_urls": [
      "https://crowdworks.jp/pages/guidelines/job_offer",
      "https://crowdworks.jp/pages/guidelines/message"
    ],
    "source_summary": "2026-09-25確認。クラウドワークス公式ガイドラインを、受注後トラブルを減らす条件合意へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_crowdsourcing:mode:outreach:requirements-to-evidence-20260925",
    "label": "応募向け：募集要件と提示できる根拠を1対1で対応付ける",
    "aliases": [
      "mode:outreach"
    ],
    "guidance": [
      "応募文は一般的な自己PRより、募集要件ごとに対応可否と提示可能な根拠を示す",
      "不明点は応募前後の質問として分け、できると断定しない"
    ],
    "deliverables": [
      "要件対応表",
      "根拠一覧",
      "応募文",
      "質問"
    ],
    "cautions": [
      "未確認の実績やポートフォリオを追加しない",
      "依頼文にない条件を勝手に約束しない"
    ],
    "tasks": [
      "sidejob_crowdsourcing"
    ],
    "priority": 46,
    "source_urls": [
      "https://crowdworks.jp/pages/guidelines/job_offer"
    ],
    "source_summary": "2026-09-25確認。クラウドワークス公式の仕事依頼ガイドラインを、案件要件に沿った応募設計へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_crowdsourcing:mode:delivery:milestone-delivery-20260925",
    "label": "納品向け：初稿・確認・修正・納品を区切って合意する",
    "aliases": [
      "mode:delivery"
    ],
    "guidance": [
      "受注後は作業開始条件、初稿、依頼者確認、修正、最終納品の区切りを明示する",
      "外部連絡や支払方法は利用プラットフォームの現在ルールを確認する"
    ],
    "deliverables": [
      "工程表",
      "確認タイミング",
      "修正記録",
      "納品チェック"
    ],
    "cautions": [
      "必要な契約・仮払いを飛ばさない",
      "価格・規約・仕様など変動情報は公開時点の公式情報を確認する"
    ],
    "tasks": [
      "sidejob_crowdsourcing"
    ],
    "priority": 45,
    "source_urls": [
      "https://crowdworks.jp/pages/guidelines/message",
      "https://crowdworks.jp/pages/guidelines/job_offer"
    ],
    "source_summary": "2026-09-25確認。クラウドワークス公式の連絡/仕事依頼ガイドラインを、受注から納品までの区切りへ反映。"
  },
  {
    "key": "auto:scenario:sidejob_crowdsourcing:medium:crowdworks:crowdworks-platform-flow-20260925",
    "label": "クラウドワークス向け：連絡・契約・決済ルール内で進める",
    "aliases": [
      "medium:crowdworks"
    ],
    "guidance": [
      "クラウドワークス利用時は、外部連絡・直接取引・仕事依頼に関する現在のガイドラインを確認する",
      "案件の依頼内容と契約内容に差がある場合は作業前に確認する"
    ],
    "deliverables": [
      "規約確認",
      "契約確認",
      "連絡方法",
      "作業開始条件"
    ],
    "cautions": [
      "規約回避の方法を案内しない",
      "価格・規約・仕様など変動情報は公開時点の公式情報を確認する"
    ],
    "tasks": [
      "sidejob_crowdsourcing"
    ],
    "priority": 44,
    "source_urls": [
      "https://crowdworks.jp/pages/guidelines/message",
      "https://crowdworks.jp/pages/guidelines/job_offer"
    ],
    "source_summary": "2026-09-25確認。クラウドワークス公式ガイドラインを、媒体固有の案件進行へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_skill_sales:experience:beginner:narrow-service-20260925",
    "label": "初心者向け：最初のサービスは対象・範囲・納品物を狭く定義する",
    "aliases": [
      "experience:beginner"
    ],
    "guidance": [
      "初販売では何でも対応する形を避け、対象者・対応する課題・基本納品物・対応外を明確にする",
      "実績がない場合は提供工程や確認の丁寧さなど、事実で説明できる価値を使う"
    ],
    "deliverables": [
      "サービス範囲",
      "対象/対象外",
      "納品物",
      "購入前質問"
    ],
    "cautions": [
      "架空の販売件数・評価・資格を作らない",
      "未確認の成果・売上・成功率を保証しない"
    ],
    "tasks": [
      "sidejob_skill_sales"
    ],
    "priority": 48,
    "source_urls": [
      "https://coconala.com/pages/guide_rule",
      "https://www.no-trouble.caa.go.jp/what/mailorder/advertising.php"
    ],
    "source_summary": "2026-09-25確認。ココナラ公式ルールと消費者庁の通信販売情報を、初回サービスの範囲・購入前説明へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_skill_sales:experience:experienced:package-boundaries-20260925",
    "label": "経験者向け：基本範囲・追加対応・修正・再依頼をパッケージ化する",
    "aliases": [
      "experience:experienced"
    ],
    "guidance": [
      "継続販売では基本料金に含む範囲と追加見積になる条件を分ける",
      "修正回数だけでなく、修正に含まれる変更と新規作業の境界を定義する"
    ],
    "deliverables": [
      "基本範囲",
      "追加条件",
      "修正条件",
      "再依頼テンプレート"
    ],
    "cautions": [
      "入力されていない価格を勝手に固定しない",
      "価格・規約・仕様など変動情報は公開時点の公式情報を確認する"
    ],
    "tasks": [
      "sidejob_skill_sales"
    ],
    "priority": 47,
    "source_urls": [
      "https://coconala.com/pages/guide_rule",
      "https://www.no-trouble.caa.go.jp/what/mailorder/advertising.php"
    ],
    "source_summary": "2026-09-25確認。ココナラ公式ルールと通信販売表示を、継続サービスの条件分離へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_skill_sales:mode:production:deliverable-qa-20260925",
    "label": "制作向け：納品物ごとに完了条件と品質確認を持つ",
    "aliases": [
      "mode:production"
    ],
    "guidance": [
      "ファイル・文章・通話・作業代行など納品形式ごとに、完了条件と依頼者確認ポイントを定義する",
      "納品前に事実・誤記・ファイル形式・不足物を確認する"
    ],
    "deliverables": [
      "納品物一覧",
      "完了条件",
      "品質チェック",
      "確認依頼文"
    ],
    "cautions": [
      "依頼者の機密情報を公開実績へ無断転用しない",
      "AI出力だけで納品可と判断しない"
    ],
    "tasks": [
      "sidejob_skill_sales"
    ],
    "priority": 46,
    "source_urls": [
      "https://coconala.com/pages/guide_rule",
      "https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/"
    ],
    "source_summary": "2026-09-25確認。ココナラ公式ルールと個人情報保護委員会ガイドラインを、納品品質と顧客情報の扱いへ反映。"
  },
  {
    "key": "auto:scenario:sidejob_skill_sales:mode:sales:prepurchase-scope-20260925",
    "label": "販売向け：購入前に範囲・納品・修正・対応外を確認できるようにする",
    "aliases": [
      "mode:sales"
    ],
    "guidance": [
      "購入者が申し込む前に、提供内容、必要情報、納品形式、修正条件、対応できないことを読める構成にする",
      "強みは入力された事実または提供方法の違いで説明する"
    ],
    "deliverables": [
      "販売ページ",
      "購入前確認",
      "FAQ",
      "対応外一覧"
    ],
    "cautions": [
      "購入判断を急かす架空の希少性を作らない",
      "未確認の成果・売上・成功率を保証しない"
    ],
    "tasks": [
      "sidejob_skill_sales"
    ],
    "priority": 45,
    "source_urls": [
      "https://www.no-trouble.caa.go.jp/what/mailorder/advertising.php",
      "https://coconala.com/pages/guide_rule"
    ],
    "source_summary": "2026-09-25確認。消費者庁の通信販売表示とココナラ公式ルールを、サービス購入前説明へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_skill_sales:medium:coconala:coconala-rules-20260925",
    "label": "ココナラ向け：プラットフォーム内の連絡・決済ルールを確認する",
    "aliases": [
      "medium:coconala"
    ],
    "guidance": [
      "ココナラで販売する場合は、外部連絡・外部決済・禁止行為等の現在ルールを確認してサービス文面と進行を作る",
      "ルール上必要な手続きと購入者への案内を分ける"
    ],
    "deliverables": [
      "ルール確認",
      "連絡方法",
      "決済確認",
      "購入後案内"
    ],
    "cautions": [
      "禁止された外部誘導や決済回避を案内しない",
      "価格・規約・仕様など変動情報は公開時点の公式情報を確認する"
    ],
    "tasks": [
      "sidejob_skill_sales"
    ],
    "priority": 44,
    "source_urls": [
      "https://coconala.com/pages/guide_rule"
    ],
    "source_summary": "2026-09-25確認。ココナラ公式ルールを、媒体固有の販売・連絡・決済フローへ反映。"
  },
  {
    "key": "auto:scenario:sidejob_digital_product:experience:beginner:mini-product-outcome-20260925",
    "label": "初心者向け：小さな商品で1つの完成状態を作る",
    "aliases": [
      "experience:beginner"
    ],
    "guidance": [
      "初商品は情報を網羅するより、購入者が短い手順で1つの計画・テンプレート・成果物を完成できる範囲にする",
      "前提知識と必要ツールを購入前に明示する"
    ],
    "deliverables": [
      "商品コンセプト",
      "完成状態",
      "最短手順",
      "必要物"
    ],
    "cautions": [
      "未確認の成果・売上・成功率を保証しない",
      "ボリュームを価値の代理にしない"
    ],
    "tasks": [
      "sidejob_digital_product"
    ],
    "priority": 48,
    "source_urls": [
      "https://www.no-trouble.caa.go.jp/what/mailorder/advertising.php",
      "https://www.help-note.com/hc/ja/sections/24999788721177"
    ],
    "source_summary": "2026-09-25確認。消費者庁の購入前表示とnote公式有料コンテンツ案内を、初回デジタル商品の範囲設計へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_digital_product:experience:experienced:modular-update-map-20260925",
    "label": "経験者向け：教材をモジュール化し更新箇所を分離する",
    "aliases": [
      "experience:experienced"
    ],
    "guidance": [
      "体系化した商品では基礎、実践、テンプレート、最新情報を分け、変更頻度の高い部分だけ更新できる構造にする",
      "各モジュールの依存関係と前提条件を明示する"
    ],
    "deliverables": [
      "モジュール構成",
      "依存関係",
      "更新マップ",
      "変更履歴"
    ],
    "cautions": [
      "古い仕様を最新として残さない",
      "第三者素材の再配布条件を未確認で含めない"
    ],
    "tasks": [
      "sidejob_digital_product"
    ],
    "priority": 47,
    "source_urls": [
      "https://www.bunka.go.jp/chosakuken/",
      "https://www.no-trouble.caa.go.jp/what/mailorder/advertising.php"
    ],
    "source_summary": "2026-09-25確認。文化庁の著作権情報と通信販売表示を、教材資産の更新・再配布確認へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_digital_product:mode:production:module-output-20260925",
    "label": "制作向け：各章・モジュールに購入者の成果物を設定する",
    "aliases": [
      "mode:production"
    ],
    "guidance": [
      "各章を読み終えるだけでなく、記入・設定・作成などの具体的な成果物が残る設計にする",
      "説明→例→テンプレート→確認の順を必要に応じて組み合わせる"
    ],
    "deliverables": [
      "章ごとの成果物",
      "テンプレート",
      "ワークシート",
      "完了チェック"
    ],
    "cautions": [
      "架空の成功事例を教材の根拠にしない",
      "他者コンテンツを近似模倣しない"
    ],
    "tasks": [
      "sidejob_digital_product"
    ],
    "priority": 46,
    "source_urls": [
      "https://www.bunka.go.jp/chosakuken/",
      "https://www.help-note.com/hc/ja/sections/24999788721177"
    ],
    "source_summary": "2026-09-25確認。著作権と有料コンテンツの公式情報を、教材制作と付属物設計へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_digital_product:mode:sales:support-update-conditions-20260925",
    "label": "販売向け：販売条件・更新方針・サポート範囲を購入前に示す",
    "aliases": [
      "mode:sales"
    ],
    "guidance": [
      "販売ページでは商品形式、利用条件、必要環境、サポート範囲、更新方針を購入前に確認できるようにする",
      "提供しないサポートや将来更新を暗黙に約束しない"
    ],
    "deliverables": [
      "販売条件",
      "サポート範囲",
      "更新方針",
      "FAQ"
    ],
    "cautions": [
      "未定の将来アップデートを保証しない",
      "価格・規約・仕様など変動情報は公開時点の公式情報を確認する"
    ],
    "tasks": [
      "sidejob_digital_product"
    ],
    "priority": 45,
    "source_urls": [
      "https://www.no-trouble.caa.go.jp/what/mailorder/advertising.php",
      "https://www.help-note.com/hc/ja/sections/24999788721177"
    ],
    "source_summary": "2026-09-25確認。消費者庁の通信販売表示とnote公式有料コンテンツ案内を、販売条件とサポート説明へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_digital_product:medium:note:note-digital-delivery-20260925",
    "label": "note向け：有料部分と付属物の提供内容を明確にする",
    "aliases": [
      "medium:note"
    ],
    "guidance": [
      "noteでデジタル商品型コンテンツを販売する場合は、無料部分で対象者・内容・前提を説明し、有料部分で受け取れる本文・テンプレート等を明示する",
      "購入後に必要な操作や外部ツールがある場合は事前条件として示す"
    ],
    "deliverables": [
      "無料説明",
      "有料提供物",
      "前提条件",
      "利用手順"
    ],
    "cautions": [
      "購入後に初めて重大な前提条件を出さない",
      "価格・規約・仕様など変動情報は公開時点の公式情報を確認する"
    ],
    "tasks": [
      "sidejob_digital_product"
    ],
    "priority": 44,
    "source_urls": [
      "https://www.help-note.com/hc/ja/sections/24999788721177",
      "https://www.no-trouble.caa.go.jp/what/mailorder/advertising.php"
    ],
    "source_summary": "2026-09-25確認。note公式有料コンテンツ案内と通信販売表示を、note上のデジタル商品提供へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_outreach:experience:beginner:small-ask-20260925",
    "label": "初心者向け：連絡理由と小さな次の一歩だけを明確にする",
    "aliases": [
      "experience:beginner"
    ],
    "guidance": [
      "初回営業では長い自己PRより、なぜ相手に連絡したか、何を提供できるか、次に何をお願いするかを短く示す",
      "実績が少ない場合は架空の成果を作らず、提案内容と進め方を具体化する"
    ],
    "deliverables": [
      "短文提案",
      "丁寧版",
      "最初のお願い",
      "確認質問"
    ],
    "cautions": [
      "架空の導入実績・紹介者・成果数値を作らない",
      "大量一斉送信を前提にしない"
    ],
    "tasks": [
      "sidejob_outreach"
    ],
    "priority": 48,
    "source_urls": [
      "https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/",
      "https://developers.openai.com/api/docs/guides/tools-web-search"
    ],
    "source_summary": "2026-09-25確認。個人情報保護委員会の利用目的ガイドと公式Web検索ガイドを、初回連絡の情報収集・誠実な提案へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_outreach:experience:experienced:segment-followup-20260925",
    "label": "経験者向け：相手群ごとに提案仮説とフォロー停止条件を分ける",
    "aliases": [
      "experience:experienced"
    ],
    "guidance": [
      "継続営業では相手の業種・課題仮説・提案内容をまとめて管理し、同じ文章の無差別送信を避ける",
      "返信がない場合の再連絡回数と打ち切り条件を事前に決める"
    ],
    "deliverables": [
      "相手セグメント",
      "提案仮説",
      "フォロー履歴",
      "打ち切り条件"
    ],
    "cautions": [
      "相手の事情を未確認で断定しない",
      "取得した連絡先を目的外に広げない"
    ],
    "tasks": [
      "sidejob_outreach"
    ],
    "priority": 47,
    "source_urls": [
      "https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/",
      "https://developers.openai.com/api/docs/guides/tools-web-search"
    ],
    "source_summary": "2026-09-25確認。個人情報の利用目的とWeb調査の公式情報を、継続営業の相手管理・フォローへ反映。"
  },
  {
    "key": "auto:scenario:sidejob_outreach:mode:research:recipient-fact-hypothesis-20260925",
    "label": "調査向け：相手の確認済み事実と提案仮説を分ける",
    "aliases": [
      "mode:research"
    ],
    "guidance": [
      "連絡前調査では公式サイト等で確認した事実と、自分が考えた課題仮説を別欄にする",
      "提案に使う情報は連絡目的に必要な範囲へ絞る"
    ],
    "deliverables": [
      "確認済み事実",
      "仮説",
      "根拠URL",
      "未確認事項"
    ],
    "cautions": [
      "公開情報だけを理由に無制限に個人情報を収集しない",
      "推測を相手の事実として書かない"
    ],
    "tasks": [
      "sidejob_outreach"
    ],
    "priority": 46,
    "source_urls": [
      "https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/",
      "https://developers.openai.com/api/docs/guides/tools-web-search"
    ],
    "source_summary": "2026-09-25確認。個人情報保護委員会の利用目的ガイドと公式Web検索を、営業前リサーチの事実/仮説分離へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_outreach:mode:outreach:channel-message-20260925",
    "label": "営業向け：連絡手段に合わせて情報量とCTAを調整する",
    "aliases": [
      "mode:outreach"
    ],
    "guidance": [
      "メール、DM、フォーム等の連絡手段ごとに、相手が最初に確認できる情報量へ調整する",
      "一度の連絡で大きな契約を迫らず、返信・短い打合せ・要件確認など次の一歩を一つ設定する"
    ],
    "deliverables": [
      "手段別文面",
      "CTA",
      "返信後確認事項",
      "フォロー文"
    ],
    "cautions": [
      "相手を操作する煽りや偽の緊急性を使わない",
      "返信がないことを同意と扱わない"
    ],
    "tasks": [
      "sidejob_outreach"
    ],
    "priority": 45,
    "source_urls": [
      "https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/"
    ],
    "source_summary": "2026-09-25確認。個人情報保護委員会の利用目的・適正取扱いの考え方を、連絡目的と情報量の整理へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_outreach:medium:email:email-context-ask-20260925",
    "label": "メール向け：件名・連絡理由・提案・お願いを短く分離する",
    "aliases": [
      "medium:email"
    ],
    "guidance": [
      "営業メールは件名で要件が分かり、本文冒頭で相手に連絡した理由を示す",
      "提案の説明後に、返信や短い打合せ等の具体的な一つのお願いを置く"
    ],
    "deliverables": [
      "件名",
      "短文メール",
      "丁寧版",
      "返信後の質問"
    ],
    "cautions": [
      "不要な個人情報を本文や管理表へ追加しない",
      "架空の共通点や紹介関係を作らない"
    ],
    "tasks": [
      "sidejob_outreach"
    ],
    "priority": 44,
    "source_urls": [
      "https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/"
    ],
    "source_summary": "2026-09-25確認。個人情報保護委員会の利用目的ガイドを、メール営業の目的明確化と情報最小化へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_research:experience:beginner:question-source-order-20260925",
    "label": "初心者向け：調査質問・未知情報・情報源の順番を先に決める",
    "aliases": [
      "experience:beginner"
    ],
    "guidance": [
      "調べ始める前に、最終的に決めたいことと未知情報を箇条書きにする",
      "公式一次情報、公的機関、仕様書等を優先し、検索結果の要約だけで終わらせない"
    ],
    "deliverables": [
      "調査質問",
      "未知情報",
      "優先情報源",
      "確認日"
    ],
    "cautions": [
      "検索スニペットだけで重要事項を断定しない",
      "確認できない情報を推測で埋めない"
    ],
    "tasks": [
      "sidejob_research"
    ],
    "priority": 48,
    "source_urls": [
      "https://developers.openai.com/api/docs/guides/tools-web-search",
      "https://docs.anthropic.com/zh-CN/docs/agents-and-tools/tool-use/web-search-tool",
      "https://ai.google.dev/gemini-api/docs/google-search"
    ],
    "source_summary": "2026-09-25確認。OpenAI/Anthropic/Google公式のWeb検索・グラウンディング文書を、初学者の調査順序へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_research:experience:experienced:conflict-confidence-20260925",
    "label": "経験者向け：食い違う根拠・条件差・確度を明示する",
    "aliases": [
      "experience:experienced"
    ],
    "guidance": [
      "複数ソースが食い違う場合は、公開日、対象地域、プラン、定義等の条件差を確認する",
      "結論だけでなく、確定事実・推定・未確認を分けて判断材料を残す"
    ],
    "deliverables": [
      "ソース差分",
      "条件差",
      "確度",
      "未確認事項"
    ],
    "cautions": [
      "都合のよい根拠だけを選ばない",
      "異なる対象集団の情報を直接同一視しない"
    ],
    "tasks": [
      "sidejob_research"
    ],
    "priority": 47,
    "source_urls": [
      "https://developers.openai.com/api/docs/guides/tools-web-search",
      "https://docs.anthropic.com/zh-CN/docs/agents-and-tools/tool-use/web-search-tool",
      "https://ai.google.dev/gemini-api/docs/google-search"
    ],
    "source_summary": "2026-09-25確認。主要AI各社の公式検索/グラウンディング文書を、複数根拠の照合と不確実性管理へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_research:mode:research:evidence-receipt-20260925",
    "label": "調査向け：URL・確認日・対象条件を根拠レシートとして残す",
    "aliases": [
      "mode:research"
    ],
    "guidance": [
      "価格、規約、仕様、統計等の時点依存情報は、実際に開いたURLと確認日を記録する",
      "結論に使った根拠がどの主張を支えるか対応付ける"
    ],
    "deliverables": [
      "根拠URL",
      "確認日",
      "対象条件",
      "主張との対応"
    ],
    "cautions": [
      "リンクがあるだけで内容確認済みとしない",
      "価格・規約・仕様など変動情報は公開時点の公式情報を確認する"
    ],
    "tasks": [
      "sidejob_research"
    ],
    "priority": 46,
    "source_urls": [
      "https://developers.openai.com/api/docs/guides/tools-web-search",
      "https://ai.google.dev/gemini-api/docs/google-search"
    ],
    "source_summary": "2026-09-25確認。公式Web検索/グラウンディング文書を、再確認可能な根拠記録へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_research:mode:planning:decision-unknowns-20260925",
    "label": "意思決定向け：結論と残る未知情報を同時に出す",
    "aliases": [
      "mode:planning"
    ],
    "guidance": [
      "調査結果を意思決定へ使う場合は、確認済み事実から言えることと、まだ調べる必要があることを分ける",
      "次の調査コストに見合うかを判断できるよう、重要な未知情報を優先順位付けする"
    ],
    "deliverables": [
      "結論",
      "根拠",
      "未確認事項",
      "追加調査優先度"
    ],
    "cautions": [
      "情報不足を断定で埋めない",
      "調査量の多さを結論の正しさと同一視しない"
    ],
    "tasks": [
      "sidejob_research"
    ],
    "priority": 45,
    "source_urls": [
      "https://developers.openai.com/api/docs/guides/tools-web-search",
      "https://docs.anthropic.com/zh-CN/docs/agents-and-tools/tool-use/web-search-tool"
    ],
    "source_summary": "2026-09-25確認。公式Web検索文書を、調査から意思決定への根拠・未知情報整理へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_research:mode:research:source-hierarchy-20260925",
    "label": "調査向け：サービス仕様・制度・評価で情報源の役割を分ける",
    "aliases": [
      "mode:research"
    ],
    "guidance": [
      "サービス仕様は運営元、制度は公的機関など、主張の種類に応じて最も直接的な一次情報を選ぶ",
      "第三者解説は補助として使い、一次情報と区別する"
    ],
    "deliverables": [
      "情報源の優先順位",
      "一次情報",
      "補助情報",
      "差分メモ"
    ],
    "cautions": [
      "二次情報の転載数を独立した根拠数とみなさない",
      "公式であるだけで別条件の情報を流用しない"
    ],
    "tasks": [
      "sidejob_research"
    ],
    "priority": 44,
    "source_urls": [
      "https://developers.openai.com/api/docs/guides/tools-web-search",
      "https://ai.google.dev/gemini-api/docs/google-search"
    ],
    "source_summary": "2026-09-25確認。公式検索/グラウンディング文書の出典重視を、調査対象ごとの情報源階層へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_efficiency:experience:beginner:document-before-automation-20260925",
    "label": "初心者向け：自動化前に現在作業を手順化する",
    "aliases": [
      "experience:beginner"
    ],
    "guidance": [
      "初めて効率化する作業は、入力・処理・確認・保存・引継ぎの順に現在手順を記録する",
      "AIへ任せる前に、正しい完成例と人が確認する箇所を決める"
    ],
    "deliverables": [
      "現行手順",
      "正しい完成例",
      "確認箇所",
      "改善候補"
    ],
    "cautions": [
      "手順が不明なまま全面自動化しない",
      "顧客情報を無断で外部AIへ入力しない"
    ],
    "tasks": [
      "sidejob_efficiency"
    ],
    "priority": 48,
    "source_urls": [
      "https://developers.openai.com/api/docs/guides/evaluation-getting-started",
      "https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/"
    ],
    "source_summary": "2026-09-25確認。OpenAI公式評価ガイドと個人情報保護委員会ガイドラインを、初回自動化の基準作りへ反映。"
  },
  {
    "key": "auto:scenario:sidejob_efficiency:experience:experienced:baseline-exceptions-20260925",
    "label": "経験者向け：基準値・例外・回帰確認まで含めて改善する",
    "aliases": [
      "experience:experienced"
    ],
    "guidance": [
      "既存SOPを改善する場合は、変更前の時間・エラー・手戻り等の基準を残し、変更後と同じ条件で比較する",
      "通常例だけでなく例外や失敗しやすいケースを評価例に含める"
    ],
    "deliverables": [
      "変更前基準",
      "評価例",
      "例外一覧",
      "回帰結果"
    ],
    "cautions": [
      "一例の成功だけで自動化品質を保証しない",
      "評価用データへ機密情報を無断で含めない"
    ],
    "tasks": [
      "sidejob_efficiency"
    ],
    "priority": 47,
    "source_urls": [
      "https://developers.openai.com/api/docs/guides/evaluation-getting-started",
      "https://developers.openai.com/api/docs/guides/evals",
      "https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/"
    ],
    "source_summary": "2026-09-25確認。OpenAI公式Evalsと個人情報ガイドラインを、継続的なSOP改善・回帰確認へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_efficiency:mode:operation:sop-gates-20260925",
    "label": "運用向け：SOPに完了条件・例外・人の確認ゲートを入れる",
    "aliases": [
      "mode:operation"
    ],
    "guidance": [
      "各工程に開始条件と完了条件を設定し、例外時に通常フローへ戻すか人へ渡すかを決める",
      "自動化できる工程と、人が判断すべき工程を分離する"
    ],
    "deliverables": [
      "SOP",
      "完了条件",
      "例外フロー",
      "人の確認ゲート"
    ],
    "cautions": [
      "重要判断まで無条件に自動化しない",
      "例外を無視して処理を続ける設計にしない"
    ],
    "tasks": [
      "sidejob_efficiency"
    ],
    "priority": 46,
    "source_urls": [
      "https://developers.openai.com/api/docs/guides/evaluation-getting-started",
      "https://developers.openai.com/api/docs/guides/evals"
    ],
    "source_summary": "2026-09-25確認。OpenAI公式評価ガイドを、標準手順と人の確認ゲート設計へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_efficiency:risk:high:high-impact-human-gate-20260925",
    "label": "高影響作業向け：顧客・金銭・公開情報は人の最終確認を必須にする",
    "aliases": [
      "risk:high"
    ],
    "guidance": [
      "誤りが顧客、金銭、公開情報へ影響する作業は、自動化結果をそのまま実行せず人の承認点を置く",
      "送信・公開・支払等の不可逆操作前に、入力と出力を再確認する"
    ],
    "deliverables": [
      "承認ポイント",
      "確認チェック",
      "ロールバック手順"
    ],
    "cautions": [
      "高影響操作をAI判断だけで確定しない",
      "個人情報の利用目的を超えて処理しない"
    ],
    "tasks": [
      "sidejob_efficiency"
    ],
    "priority": 45,
    "source_urls": [
      "https://developers.openai.com/api/docs/guides/evals",
      "https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/"
    ],
    "source_summary": "2026-09-25確認。OpenAI公式Evalsと個人情報保護委員会ガイドラインを、高影響自動化の人による最終確認へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_efficiency:strategy:repeat:template-versioning-20260925",
    "label": "反復作業向け：テンプレート・SOP・評価例を同じ版で管理する",
    "aliases": [
      "strategy:repeat"
    ],
    "guidance": [
      "繰り返し作業ではプロンプト、テンプレート、SOP、評価例の変更を版としてまとめる",
      "変更時は代表例で旧版と新版を比較し、改善と回帰を記録する"
    ],
    "deliverables": [
      "版管理",
      "変更履歴",
      "代表評価例",
      "更新条件"
    ],
    "cautions": [
      "最新版が常に改善とは決めつけない",
      "変更理由を残さず上書きしない"
    ],
    "tasks": [
      "sidejob_efficiency"
    ],
    "priority": 44,
    "source_urls": [
      "https://developers.openai.com/api/docs/guides/evaluation-getting-started",
      "https://developers.openai.com/api/docs/guides/evals"
    ],
    "source_summary": "2026-09-25確認。OpenAI公式評価ガイドを、反復業務のテンプレート版管理・回帰確認へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_planning:experience:beginner:small-test-first-20260925",
    "label": "初心者向け：低コストの小さな検証から副業候補を比較する",
    "aliases": [
      "experience:beginner"
    ],
    "guidance": [
      "初めて副業を選ぶ場合は、収益予測より先に必要時間・初期費用・最初の成果物・集客方法を比較する",
      "30日程度で作成数、応募数、継続可能性など自分で確認できる指標を置く"
    ],
    "deliverables": [
      "候補比較",
      "最初の成果物",
      "30日検証",
      "継続判断"
    ],
    "cautions": [
      "未確認の成果・売上・成功率を保証しない",
      "収益額や成功確率を固定値で推定しない"
    ],
    "tasks": [
      "sidejob_planning"
    ],
    "priority": 48,
    "source_urls": [
      "https://www.mhlw.go.jp/content/11201250/001504156.pdf",
      "https://www.nta.go.jp/taxes/shiraberu/shinkoku/kojin_jigyo/index.htm"
    ],
    "source_summary": "2026-09-25確認。厚生労働省の副業・兼業ガイドと国税庁の記帳情報を、無理のない開始条件と記録へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_planning:experience:experienced:scale-constraints-20260925",
    "label": "経験者向け：伸ばす前に時間・営業・納品・更新の制約を確認する",
    "aliases": [
      "experience:experienced"
    ],
    "guidance": [
      "既に経験がある場合は売上目標だけでなく、案件数増加時の制作時間・営業・修正・サポート負荷を比較する",
      "自分が続ける工程とテンプレート化・外注候補を分ける"
    ],
    "deliverables": [
      "制約一覧",
      "負荷見積り",
      "標準化候補",
      "継続条件"
    ],
    "cautions": [
      "健康や本業への影響を無視して拡大しない",
      "未確認の市場規模や案件数を断定しない"
    ],
    "tasks": [
      "sidejob_planning"
    ],
    "priority": 47,
    "source_urls": [
      "https://www.mhlw.go.jp/content/11201250/001504156.pdf",
      "https://developers.openai.com/api/docs/guides/evaluation-getting-started"
    ],
    "source_summary": "2026-09-25確認。厚生労働省の副業・兼業ガイドと評価ガイドを、経験者の拡張前の負荷確認へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_planning:mode:planning:constraint-matrix-20260925",
    "label": "計画向け：時間・予算・得意・営業可否を比較表へする",
    "aliases": [
      "mode:planning"
    ],
    "guidance": [
      "候補ごとに使える時間、初期予算、必要スキル、営業方法、最初の成果物を同じ軸で比較する",
      "本人が入力した条件だけを使い、年齢・職業等から向き不向きを決めつけない"
    ],
    "deliverables": [
      "条件比較表",
      "候補5つ",
      "最初の一歩",
      "判断基準"
    ],
    "cautions": [
      "属性だけで適性を決めつけない",
      "未確認の成果・売上・成功率を保証しない"
    ],
    "tasks": [
      "sidejob_planning"
    ],
    "priority": 46,
    "source_urls": [
      "https://www.mhlw.go.jp/content/11201250/001504156.pdf"
    ],
    "source_summary": "2026-09-25確認。厚生労働省の副業・兼業ガイドを、本人条件に基づく現実的な副業計画へ反映。"
  },
  {
    "key": "auto:scenario:sidejob_planning:strategy:test:thirty-day-experiment-20260925",
    "label": "小さく試す向け：30日で続ける・修正・やめる基準を作る",
    "aliases": [
      "strategy:test"
    ],
    "guidance": [
      "副業候補は最初から長期投資せず、30日で作れる成果物・接点・応募等の行動指標を決める",
      "検証後に続ける、方向修正する、停止する条件を先に定義する"
    ],
    "deliverables": [
      "週次行動",
      "検証指標",
      "継続/修正/停止基準"
    ],
    "cautions": [
      "短期の収益だけで適性を断定しない",
      "失敗を取り返すための過剰投資を前提にしない"
    ],
    "tasks": [
      "sidejob_planning"
    ],
    "priority": 45,
    "source_urls": [
      "https://www.mhlw.go.jp/content/11201250/001504156.pdf",
      "https://developers.openai.com/api/docs/guides/evaluation-getting-started"
    ],
    "source_summary": "2026-09-25確認。副業・兼業ガイドと評価の考え方を、低コストな短期検証と見直しへ反映。"
  },
  {
    "key": "auto:scenario:sidejob_planning:strategy:repeat:repeatability-check-20260925",
    "label": "継続重視向け：毎週繰り返せる作業量と記録方法を先に決める",
    "aliases": [
      "strategy:repeat"
    ],
    "guidance": [
      "継続を重視する場合は、毎週の制作・営業・納品・学習に必要な時間を分けて予定する",
      "売上だけでなく、作業時間、手戻り、継続できた回数を記録する"
    ],
    "deliverables": [
      "週間配分",
      "作業記録",
      "月次見直し",
      "負荷上限"
    ],
    "cautions": [
      "過労や本業への支障を前提にしない",
      "記録なしに作業量を拡大しない"
    ],
    "tasks": [
      "sidejob_planning"
    ],
    "priority": 44,
    "source_urls": [
      "https://www.mhlw.go.jp/content/11201250/001504156.pdf",
      "https://www.nta.go.jp/taxes/shiraberu/shinkoku/kojin_jigyo/index.htm"
    ],
    "source_summary": "2026-09-25確認。厚生労働省の副業・兼業ガイドと国税庁の記帳情報を、継続可能な運営・記録へ反映。"
  }
]$rows$::jsonb)
  ),
  prepared as (
    select
      item ->> 'key' as key,
      item ->> 'label' as label,
      array(select jsonb_array_elements_text(item -> 'aliases'))::text[] as aliases,
      array(select jsonb_array_elements_text(item -> 'guidance'))::text[] as guidance,
      array(select jsonb_array_elements_text(item -> 'deliverables'))::text[] as deliverables,
      array(select jsonb_array_elements_text(item -> 'cautions'))::text[] as cautions,
      array(select jsonb_array_elements_text(item -> 'tasks'))::text[] as tasks,
      (item ->> 'priority')::smallint as priority,
      array(select jsonb_array_elements_text(item -> 'source_urls'))::text[] as source_urls,
      item ->> 'source_summary' as source_summary
    from raw
  )
  insert into public.knowledge_catalog (
    key, kind, label, parent_label, aliases, guidance, deliverables, cautions,
    tasks, priority, status, source, created_by, release_channel,
    stable_available_at, source_urls, source_summary, source_checked_at,
    catalog_version, updated_at
  )
  select
    key, 'task', label, null, aliases, guidance, deliverables, cautions,
    tasks, priority, 'active', 'admin', null, 'fresh_first',
    stable_at, source_urls, source_summary, now(),
    next_version, now()
  from prepared
  on conflict (key) do update set
    kind = excluded.kind,
    label = excluded.label,
    parent_label = excluded.parent_label,
    aliases = excluded.aliases,
    guidance = excluded.guidance,
    deliverables = excluded.deliverables,
    cautions = excluded.cautions,
    tasks = excluded.tasks,
    priority = excluded.priority,
    status = 'active',
    source = 'admin',
    release_channel = excluded.release_channel,
    stable_available_at = excluded.stable_available_at,
    source_urls = excluded.source_urls,
    source_summary = excluded.source_summary,
    source_checked_at = excluded.source_checked_at,
    catalog_version = excluded.catalog_version,
    updated_at = now();

  update public.knowledge_refresh_channels
  set
    current_version = next_version,
    last_published_at = now(),
    next_refresh_due_at = now() + make_interval(hours => refresh_hours),
    updated_at = now()
  where channel = 'fresh';

  insert into public.knowledge_refresh_requests (
    channel, requested_at, started_at, status, completed_at,
    research_summary, published_knowledge_count, published_prompt_count,
    published_version, change_details
  ) values (
    'fresh', now(), now(), 'completed', now(),
    'Phase 69 Scenario Knowledge: 12副業へ各5件、計60件の状況別Knowledgeを追加。初心者/経験者、制作・販売・集客・営業・調査・運用、媒体、リスク、検証/継続戦略を既存ウィザード入力から自動選択する。',
    60, 0, next_version,
    jsonb_build_object(
      'knowledge', jsonb_build_object(
        'added', 60,
        'updated', 0,
        'unchanged', 0,
        'scenario_dimensions', jsonb_build_array('experience','mode','medium','risk','strategy'),
        'tasks', 12
      ),
      'prompt', jsonb_build_object('added',0,'updated',0,'unchanged',0)
    )
  );
end
$migration$;
