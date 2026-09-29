-- Phase 56: source-backed side-hustle Knowledge Pack baseline.
-- Goal: every sidejob_* task has at least one active Cloud Knowledge rule.
-- Sources checked 2026-09-24. Fresh-first, then Stable after configured delay.

do $migration$
declare
  next_version bigint;
  stable_delay_hours integer := 168;
  stable_at timestamptz;
begin
  select greatest(current_version + 1, 3)
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

  insert into public.knowledge_catalog (
    key, kind, label, parent_label, aliases, guidance, deliverables, cautions,
    tasks, priority, status, source, created_by, release_channel,
    stable_available_at, source_urls, source_summary, source_checked_at,
    catalog_version, updated_at
  ) values
  (
    'auto:task:sidejob_content:paid-content-value-design-20260924',
    'task',
    '有料コンテンツの価値設計と無料範囲',
    null,
    array['有料記事','コンテンツ販売','無料範囲','有料範囲']::text[],
    array[
      '無料部分では対象読者・課題・記事で分かることを明確にし、有料部分で提供する具体的価値を事前に説明する',
      '有料部分は手順、判断基準、テンプレート、事例、チェックリストなど購入後に使える成果物を中心に構成する',
      '価格や公開範囲は利用サービスの現在仕様を確認し、AAS側で固定値として断定しない'
    ]::text[],
    array['無料部分の役割','有料部分の成果物一覧','購入前に伝える対象読者と提供価値']::text[],
    array[
      '本文にない成果や収益を販売文だけで約束しない',
      '購入者に提供される内容・範囲を曖昧にしない'
    ]::text[],
    array['sidejob_content']::text[],
    94,'active','admin',null,'fresh_first',stable_at,
    array[
      'https://note.com/info/n/na5f43ec69740',
      'https://note.com/help/pg/membership'
    ]::text[],
    'note公式の有料記事設定とメンバーシップ運営ガイドを確認。無料/有料境界、提供価値、継続提供の考え方を汎用的なコンテンツ販売Knowledgeへ整理。',
    now(),next_version,now()
  ),
  (
    'auto:task:sidejob_sns:authentic-nonspam-operation-20260924',
    'task',
    'SNS運用の真正性とスパム回避',
    null,
    array['SNS運用','X運用','スパム回避','真正性']::text[],
    array[
      '同一またはほぼ同一の投稿や返信を大量に繰り返さず、投稿ごとに相手・目的・文脈へ合わせる',
      '人工的な拡散やエンゲージメント操作ではなく、読者にとって役立つ情報・会話・明確なCTAを設計する',
      '自動化や一括運用を提案する場合は、利用するSNSの現在の自動化・スパムポリシーを確認する'
    ]::text[],
    array['投稿の柱','投稿ごとの目的','重複投稿チェック','CTA案']::text[],
    array[
      '大量の重複投稿・重複返信・無差別な働きかけを推奨しない',
      'フォロワー数や拡散数を人為的に水増しする施策を提案しない'
    ]::text[],
    array['sidejob_sns']::text[],
    96,'active','admin',null,'fresh_first',stable_at,
    array[
      'https://help.x.com/ja/rules-and-policies/authenticity',
      'https://help.x.com/ja/rules-and-policies/x-rules'
    ]::text[],
    'X公式の信頼性・プラットフォーム操作/スパムに関する規定を確認。SNS運用全般で安全側に使える真正性・重複回避ルールへ整理。',
    now(),next_version,now()
  ),
  (
    'auto:task:sidejob_video:youtube-title-thumbnail-20260924',
    'task',
    '動画タイトル・サムネイルの内容一致と改善',
    null,
    array['YouTube','動画タイトル','サムネイル','CTR']::text[],
    array[
      'タイトルとサムネイルは動画内容を正確に表し、視聴者が何を見られるか判断できるようにする',
      'タイトルは重要な語を前方へ置き、短く明確にし、サムネイルは複雑にしすぎず読みやすさを優先する',
      '公開後は分析指標を確認し、必要に応じてタイトル・サムネイルの仮説を更新する'
    ]::text[],
    array['タイトル案','サムネイル構図案','検証する分析指標']::text[],
    array[
      '動画内容と一致しない釣りタイトル・誤認させるサムネイルを作らない',
      '再生数やCTRの上昇を保証しない'
    ]::text[],
    array['sidejob_video']::text[],
    96,'active','admin',null,'fresh_first',stable_at,
    array[
      'https://support.google.com/youtube/answer/12340300?hl=ja',
      'https://support.google.com/youtube/answer/9229980?hl=ja'
    ]::text[],
    'YouTube公式のタイトル/サムネイルのヒントとポリシーを確認。内容一致、簡潔さ、視認性、公開後検証を動画副業Knowledgeへ整理。',
    now(),next_version,now()
  ),
  (
    'auto:task:sidejob_affiliate:ad-disclosure-20260924',
    'task',
    'アフィリエイト・広告表示の識別可能性',
    null,
    array['アフィリエイト','PR表記','広告表示','ステマ対策']::text[],
    array[
      '広告・宣伝に該当する可能性がある投稿では、読者が広告であることを判別できる表示を前提に構成する',
      '商品・サービスの利点だけでなく、対象条件・注意点・確認が必要な事項も分けて書く',
      '広告主・媒体・案件ごとの表示ルールがある場合は、公開前に現在の規約と法令を確認する'
    ]::text[],
    array['広告関係の明示位置','比較軸','注意点','公開前チェック']::text[],
    array[
      '広告であることを隠す構成を推奨しない',
      '未使用の商品を実体験として語らない',
      '成果・効果・収益を根拠なく断定しない'
    ]::text[],
    array['sidejob_affiliate']::text[],
    100,'active','admin',null,'fresh_first',stable_at,
    array[
      'https://www.caa.go.jp/policies/policy/representation/fair_labeling/stealth_marketing',
      'https://www.caa.go.jp/policies/policy/representation/fair_labeling/faq/stealth_marketing/'
    ]::text[],
    '消費者庁のステルスマーケティング告示解説とQ&Aを確認。広告であることの識別可能性をアフィリエイト制作の基本Knowledgeへ反映。',
    now(),next_version,now()
  ),
  (
    'auto:task:sidejob_resale:listing-accuracy-and-inventory-20260924',
    'task',
    'フリマ出品の正確性・在庫・禁止事項確認',
    null,
    array['物販','フリマ','メルカリ','出品','在庫']::text[],
    array[
      '商品説明は現物の状態・付属品・傷や注意点など購入判断に必要な事実を、確認できた範囲で正確に整理する',
      '出品前に利用サービスの禁止出品物・禁止行為を確認する',
      '在庫や発送方法は実際に対応できる条件だけを記載し、手元にない商品の販売可否は利用サービスの規約を優先する'
    ]::text[],
    array['商品状態チェック','説明文','付属品一覧','発送前確認']::text[],
    array[
      '他者の画像や文章を無断使用する前提で出品文を作らない',
      '手元にない商品や禁止物の出品を当然に可能と扱わない',
      '商品の状態・真贋・性能を未確認で断定しない'
    ]::text[],
    array['sidejob_resale']::text[],
    98,'active','admin',null,'fresh_first',stable_at,
    array[
      'https://help.jp.mercari.com/guide/articles/258/',
      'https://help.jp.mercari.com/guide/articles/259/',
      'https://help.jp.mercari.com/guide/articles/866/'
    ]::text[],
    'メルカリ公式の禁止行為・禁止出品物・手元にない商品の出品ルールを確認。物販の説明精度・在庫確認・規約確認へ一般化。',
    now(),next_version,now()
  ),
  (
    'auto:task:sidejob_crowdsourcing:contract-flow-20260924',
    'task',
    'クラウドソーシングの応募・条件合意・納品フロー',
    null,
    array['クラウドソーシング','案件応募','仮払い','納品']::text[],
    array[
      '案件詳細を読み、求められる成果物・納期・報酬・修正条件・必要スキルを応募前に整理する',
      '応募文では関連する経験・スキル・応募理由と、今回の案件にどう対応するかを具体的に示す',
      '条件合意と利用サービス上の契約・仮払い等の必要手続きを確認してから作業を開始する'
    ]::text[],
    array['案件要件整理','応募文','確認質問','納品チェックリスト']::text[],
    array[
      '契約条件が曖昧なまま作業開始を促さない',
      '実績・資格・経験を創作して応募文へ入れない',
      '利用サービス外の危険な支払いや連絡方法を当然の前提にしない'
    ]::text[],
    array['sidejob_crowdsourcing']::text[],
    97,'active','admin',null,'fresh_first',stable_at,
    array[
      'https://crowdworks.jp/pages/guides/employee/index',
      'https://crowdworks.jp/pages/guides/employee/fixed_price'
    ]::text[],
    'クラウドワークス公式の受注フローを確認。仕事探し、応募、条件相談、契約、仮払い確認、業務、納品の流れを案件受注Knowledgeへ整理。',
    now(),next_version,now()
  ),
  (
    'auto:task:sidejob_skill_sales:service-productization-20260924',
    'task',
    'スキル販売のサービス商品化と納品設計',
    null,
    array['スキル販売','ココナラ','サービス出品','納品']::text[],
    array[
      '誰のどんな課題を、どの成果物または支援で解決するサービスかを一文で定義する',
      'サービス内容、価格、購入前のお願い、必要な入力、納品物、納期、修正範囲を分けて整理する',
      '購入後のやり取りから正式納品までの流れを想定し、追加確認が必要な項目をテンプレート化する'
    ]::text[],
    array['サービス名','対象顧客','提供範囲','購入前確認事項','納品物','取引メッセージ案']::text[],
    array[
      '提供できないスキル・実績をあるように見せない',
      '納品範囲や修正回数を曖昧にしたまま販売文を作らない'
    ]::text[],
    array['sidejob_skill_sales']::text[],
    95,'active','admin',null,'fresh_first',stable_at,
    array[
      'https://coconala.com/pages/guide_sell',
      'https://coconala.com/pages/guide_market'
    ]::text[],
    'ココナラ公式のサービス出品と取引の流れを確認。カテゴリ/タイトル、サービス内容、購入時のお願い、イメージ、やり取り、正式納品を汎用的なスキル販売Knowledgeへ整理。',
    now(),next_version,now()
  ),
  (
    'auto:task:sidejob_digital_product:delivery-scope-20260924',
    'task',
    'デジタル商品の提供範囲と購入後価値の明確化',
    null,
    array['デジタル商品','教材販売','テンプレート販売','有料コンテンツ']::text[],
    array[
      '購入者が受け取るものをファイル・記事・テンプレート・更新・サポートなどの単位で明確に列挙する',
      '無料説明部分では対象者・前提・含まれる内容・含まれない内容を示し、購入判断に必要な情報を先に出す',
      '継続更新型の場合は更新頻度・提供方法・終了条件を、単発売切り型の場合は納品範囲を区別する'
    ]::text[],
    array['商品構成','対象者','含まれるもの/含まれないもの','利用手順','購入後の導線']::text[],
    array[
      '中身を過度に隠して購入を迫る構成にしない',
      '購入後の成果や収益を保証しない',
      '販売先のデジタル商品の可否・規約は最新確認なしに断定しない'
    ]::text[],
    array['sidejob_digital_product']::text[],
    94,'active','admin',null,'fresh_first',stable_at,
    array[
      'https://note.com/info/n/na5f43ec69740',
      'https://note.com/help/pg/membership'
    ]::text[],
    'note公式の有料記事とメンバーシップ運営情報を参照し、購入前説明・有料範囲・継続提供の考え方を媒体非依存のデジタル商品Knowledgeへ整理。',
    now(),next_version,now()
  ),
  (
    'auto:task:sidejob_outreach:proposal-specificity-20260924',
    'task',
    '案件提案の個別化と条件確認',
    null,
    array['営業','案件獲得','提案文','応募文']::text[],
    array[
      '相手の募集・依頼内容から、目的、成果物、納期、必須条件、懸念点を先に抽出してから提案文を作る',
      '提案文は相手の課題に対して何を提供できるかを具体化し、関連する実績はユーザーが入力した事実だけを使う',
      '曖昧な条件は質問として明示し、対応範囲・納期・見積りの前提を分けて提示する'
    ]::text[],
    array['相手要件の要約','提案文','確認質問','対応範囲と前提']::text[],
    array[
      '同一文面の大量送信を前提にしない',
      '存在しない実績・顧客・成果を作らない',
      '契約前に無償で完成品全体を渡すことを当然の前提にしない'
    ]::text[],
    array['sidejob_outreach']::text[],
    96,'active','admin',null,'fresh_first',stable_at,
    array[
      'https://crowdworks.jp/pages/guides/employee/index'
    ]::text[],
    'クラウドワークス公式が応募時の経歴・スキル・応募動機、条件相談を案内している点を参照し、個別案件に合わせた提案・条件確認へ一般化。',
    now(),next_version,now()
  ),
  (
    'auto:task:sidejob_efficiency:sop-input-output-verification-20260924',
    'task',
    '業務効率化のSOP化・入力出力・検証設計',
    null,
    array['業務効率化','SOP','定型業務','AI自動化']::text[],
    array[
      '対象業務を入力、前処理、判断、出力、確認の工程に分け、AIへ任せる工程と人が確認する工程を区別する',
      'AIへ渡す指示は目的・前提・制約・期待する出力形式を明確にし、再利用時に差し替える入力項目を分離する',
      '代表的な正常例・例外例で出力を確認し、失敗パターンが見つかったらSOPとプロンプトを更新する'
    ]::text[],
    array['業務フロー','SOP','入力テンプレート','出力形式','人による確認チェック']::text[],
    array[
      '完全自動化を前提にして事実確認・承認工程を削除しない',
      '機密情報や個人情報を利用AIへ送信してよいか未確認のまま投入しない'
    ]::text[],
    array['sidejob_efficiency']::text[],
    95,'active','admin',null,'fresh_first',stable_at,
    array[
      'https://help.openai.com/en/articles/10032626-prompt-engineering-best-practices-for-chatgpt',
      'https://developers.openai.com/api/docs/guides/prompt-engineering'
    ]::text[],
    'OpenAI公式の明確で具体的な指示、出力形式、反復改善の推奨を、定型業務のSOP化と人による検証を含む業務効率化Knowledgeへ整理。',
    now(),next_version,now()
  ),
  (
    'auto:task:sidejob_planning:work-rule-and-load-check-20260924',
    'task',
    '副業開始前の就業ルール・負荷・継続条件確認',
    null,
    array['副業選び','兼業','副業計画','働き方']::text[],
    array[
      '副業候補を選ぶ前に、本業の就業規則・契約、使える時間、初期費用、必要スキル、継続可能性を確認項目として分ける',
      '時間や収益だけでなく、本業との両立、健康管理、情報管理、競業・利益相反など確認が必要な点をチェックする',
      '候補比較では「今すぐ小さく試せるか」「成果物を作って適性を確認できるか」を判断軸に含める'
    ]::text[],
    array['副業候補比較表','開始前チェックリスト','小さく試す初回タスク']::text[],
    array[
      '勤務先のルールを確認せず副業可能と断定しない',
      '個別の労務・法律判断を一般論だけで確定しない',
      '高収益だけを理由に候補を順位付けしない'
    ]::text[],
    array['sidejob_planning']::text[],
    99,'active','admin',null,'fresh_first',stable_at,
    array[
      'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000192188.html'
    ]::text[],
    '厚生労働省の副業・兼業情報とガイドライン案内を確認。本業との両立やルール確認を含む、副業選定前の確認Knowledgeへ整理。',
    now(),next_version,now()
  ),
  (
    'auto:cross:promotion:disclosure-and-claims-20260924',
    'combination',
    '販売・広告コンテンツの表示と根拠チェック',
    null,
    array['PR','広告','販売文','訴求','表示']::text[],
    array[
      '販売や広告を含む成果物では、広告関係・提供条件・根拠の有無を読者が判断できる形で整理する',
      '価格・割引・比較・効果・実績など判断へ強く影響する情報は、公開時点の根拠を確認してから記載する',
      'ユーザーが提供していない体験・レビュー・購入経験を補完せず、事実と例を分ける'
    ]::text[],
    array['根拠確認欄','広告/PR表示確認','誇張表現チェック']::text[],
    array[
      '広告であることを隠す表現を作らない',
      '合理的根拠のない効果・優位性・成果保証を追加しない'
    ]::text[],
    array['sidejob_content','sidejob_sns','sidejob_affiliate','sidejob_digital_product','sidejob_skill_sales']::text[],
    100,'active','admin',null,'fresh_first',stable_at,
    array[
      'https://www.caa.go.jp/policies/policy/representation/fair_labeling',
      'https://www.caa.go.jp/policies/policy/representation/fair_labeling/stealth_marketing'
    ]::text[],
    '消費者庁の景品表示法・ステルスマーケティング案内を確認。販売・広告コンテンツで共通利用する表示・根拠確認Knowledgeへ整理。',
    now(),next_version,now()
  ),
  (
    'auto:cross:service-work:scope-before-work-20260924',
    'combination',
    '受託サービスの作業前条件整理',
    null,
    array['受託','案件','見積り','納品条件','修正範囲']::text[],
    array[
      '作業開始前に成果物、納期、報酬、入力素材、連絡方法、修正範囲、完了条件を確認する',
      '条件が決まっていない項目は推測で埋めず、質問または仮定として分ける',
      '納品時は依頼条件に対して何を納品したか確認できるチェックリストを付ける'
    ]::text[],
    array['条件確認表','見積り前提','納品チェック']::text[],
    array[
      '不明確な条件を既定事項として扱わない',
      'ユーザーが合意していない追加作業を当然の範囲に含めない'
    ]::text[],
    array['sidejob_crowdsourcing','sidejob_skill_sales','sidejob_outreach']::text[],
    97,'active','admin',null,'fresh_first',stable_at,
    array[
      'https://crowdworks.jp/pages/guides/employee/index',
      'https://coconala.com/pages/guide_market'
    ]::text[],
    'クラウドワークスとココナラの公式取引フローを確認。受託型副業に共通する条件合意・やり取り・納品確認へ一般化。',
    now(),next_version,now()
  )
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
    'Phase 56 Knowledge Pack baseline: 12副業タスクのうち既存Researchを除く11タスク＋横断2件、合計13件を公式ソース付きでFreshへ追加。',
    13, 0, next_version,
    jsonb_build_object(
      'knowledge', jsonb_build_object(
        'added', 13,
        'updated', 0,
        'unchanged', 0,
        'items', jsonb_build_array(
          jsonb_build_object('item_type','knowledge','key','auto:task:sidejob_content:paid-content-value-design-20260924','label','有料コンテンツの価値設計と無料範囲','action','added','changed_fields',jsonb_build_array('new','guidance','deliverables','cautions','tasks','sources'),'source_summary','note公式'),
          jsonb_build_object('item_type','knowledge','key','auto:task:sidejob_sns:authentic-nonspam-operation-20260924','label','SNS運用の真正性とスパム回避','action','added','changed_fields',jsonb_build_array('new','guidance','deliverables','cautions','tasks','sources'),'source_summary','X公式'),
          jsonb_build_object('item_type','knowledge','key','auto:task:sidejob_video:youtube-title-thumbnail-20260924','label','動画タイトル・サムネイルの内容一致と改善','action','added','changed_fields',jsonb_build_array('new','guidance','deliverables','cautions','tasks','sources'),'source_summary','YouTube公式'),
          jsonb_build_object('item_type','knowledge','key','auto:task:sidejob_affiliate:ad-disclosure-20260924','label','アフィリエイト・広告表示の識別可能性','action','added','changed_fields',jsonb_build_array('new','guidance','deliverables','cautions','tasks','sources'),'source_summary','消費者庁'),
          jsonb_build_object('item_type','knowledge','key','auto:task:sidejob_resale:listing-accuracy-and-inventory-20260924','label','フリマ出品の正確性・在庫・禁止事項確認','action','added','changed_fields',jsonb_build_array('new','guidance','deliverables','cautions','tasks','sources'),'source_summary','メルカリ公式'),
          jsonb_build_object('item_type','knowledge','key','auto:task:sidejob_crowdsourcing:contract-flow-20260924','label','クラウドソーシングの応募・条件合意・納品フロー','action','added','changed_fields',jsonb_build_array('new','guidance','deliverables','cautions','tasks','sources'),'source_summary','クラウドワークス公式'),
          jsonb_build_object('item_type','knowledge','key','auto:task:sidejob_skill_sales:service-productization-20260924','label','スキル販売のサービス商品化と納品設計','action','added','changed_fields',jsonb_build_array('new','guidance','deliverables','cautions','tasks','sources'),'source_summary','ココナラ公式'),
          jsonb_build_object('item_type','knowledge','key','auto:task:sidejob_digital_product:delivery-scope-20260924','label','デジタル商品の提供範囲と購入後価値の明確化','action','added','changed_fields',jsonb_build_array('new','guidance','deliverables','cautions','tasks','sources'),'source_summary','note公式'),
          jsonb_build_object('item_type','knowledge','key','auto:task:sidejob_outreach:proposal-specificity-20260924','label','案件提案の個別化と条件確認','action','added','changed_fields',jsonb_build_array('new','guidance','deliverables','cautions','tasks','sources'),'source_summary','クラウドワークス公式'),
          jsonb_build_object('item_type','knowledge','key','auto:task:sidejob_efficiency:sop-input-output-verification-20260924','label','業務効率化のSOP化・入力出力・検証設計','action','added','changed_fields',jsonb_build_array('new','guidance','deliverables','cautions','tasks','sources'),'source_summary','OpenAI公式'),
          jsonb_build_object('item_type','knowledge','key','auto:task:sidejob_planning:work-rule-and-load-check-20260924','label','副業開始前の就業ルール・負荷・継続条件確認','action','added','changed_fields',jsonb_build_array('new','guidance','deliverables','cautions','tasks','sources'),'source_summary','厚生労働省'),
          jsonb_build_object('item_type','knowledge','key','auto:cross:promotion:disclosure-and-claims-20260924','label','販売・広告コンテンツの表示と根拠チェック','action','added','changed_fields',jsonb_build_array('new','guidance','deliverables','cautions','tasks','sources'),'source_summary','消費者庁'),
          jsonb_build_object('item_type','knowledge','key','auto:cross:service-work:scope-before-work-20260924','label','受託サービスの作業前条件整理','action','added','changed_fields',jsonb_build_array('new','guidance','deliverables','cautions','tasks','sources'),'source_summary','クラウドワークス/ココナラ公式')
        )
      ),
      'prompt', jsonb_build_object('added',0,'updated',0,'unchanged',0,'items',jsonb_build_array())
    )
  );
end
$migration$;
