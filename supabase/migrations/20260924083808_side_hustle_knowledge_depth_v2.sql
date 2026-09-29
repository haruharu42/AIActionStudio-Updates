-- Phase 57: deepen all side-hustle Knowledge areas to at least 3 active source-backed rules.
-- Sources checked 2026-09-24. Fresh-first, then Stable after configured delay.

do $migration$
declare
  next_version bigint;
  stable_delay_hours integer := 168;
  stable_at timestamptz;
begin
  select greatest(current_version + 1, 4)
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
    'auto:cross:commercial:prepublish-claims-check-20260924',
    'combination',
    '販売前の事実・広告表示・提供範囲チェック',
    null,
    array['販売前チェック','広告表示','有料コンテンツ確認','アフィリエイト確認']::text[],
    array[
      '販売・紹介コンテンツでは、広告関係、価格・条件、提供範囲、比較根拠を公開前に分けて確認する',
      '読者の購入判断へ影響する表現は、確認済み事実・ユーザー提供情報・例示を区別して構成する',
      '有料部分やデジタル商品の説明では、購入後に受け取れる内容と対象外の内容を事前に明確にする'
    ]::text[],
    array['公開前ファクトチェック','広告/PR表示確認','提供範囲一覧','購入前説明チェック']::text[],
    array[
      '広告関係を隠す表現を作らない',
      '未確認の価格・割引・販売数・効果・実績を追加しない',
      '購入後の成果や収益を保証しない'
    ]::text[],
    array['sidejob_content','sidejob_digital_product','sidejob_affiliate']::text[],
    100,'active','admin',null,'fresh_first',stable_at,
    array[
      'https://www.caa.go.jp/policies/policy/representation/fair_labeling/stealth_marketing',
      'https://www.caa.go.jp/policies/policy/representation/fair_labeling',
      'https://note.com/info/n/na5f43ec69740'
    ]::text[],
    '消費者庁の景品表示法・ステルスマーケティング案内とnote公式の有料記事案内を確認。販売前に広告関係、根拠、提供範囲を分離して確認する横断Knowledgeへ整理。',
    now(),next_version,now()
  ),
  (
    'auto:cross:sns-outreach:automation-consent-personalization-20260924',
    'combination',
    'SNS・営業自動化の同意・個別化・重複回避',
    null,
    array['SNS自動化','営業自動化','重複回避','個別化']::text[],
    array[
      '自動化を使う場合でも、投稿や連絡の目的・対象・文脈を明確にし、同一またはほぼ同一の大量送信を避ける',
      '他者アカウントを使う自動処理では、実行内容を明確に説明し、必要な同意・停止方法を確認する',
      '営業文や返信は相手の募集・発言・課題に合わせ、差し替え箇所を明示したテンプレートとして作る'
    ]::text[],
    array['自動化前チェック','個別化項目','停止条件','重複投稿/送信チェック']::text[],
    array[
      '無差別な大量送信や重複投稿を推奨しない',
      '同意なく他者アカウントで自動操作する前提にしない',
      '自動化によるフォロワー・反応・案件獲得を保証しない'
    ]::text[],
    array['sidejob_sns','sidejob_outreach']::text[],
    99,'active','admin',null,'fresh_first',stable_at,
    array[
      'https://help.x.com/en/rules-and-policies/x-automation',
      'https://help.x.com/ja/rules-and-policies/authenticity'
    ]::text[],
    'X公式Automation RulesとAuthenticity規定を確認。重複回避、明示的な自動化、アカウント利用時の同意という考え方をSNS運用・案件営業へ安全側に一般化。',
    now(),next_version,now()
  ),
  (
    'auto:task:sidejob_video:retention-improvement-loop-20260924',
    'task',
    '視聴者維持率から動画構成を改善する',
    null,
    array['視聴者維持率','YouTube Analytics','動画改善','冒頭改善']::text[],
    array[
      '公開後は視聴者維持率の山・谷・離脱箇所を確認し、どの場面が維持や離脱に関係したか仮説を作る',
      '冒頭ではタイトル・サムネイルから生じた期待と動画内容が一致しているかを確認する',
      '後半に高い反応がある場面がある場合は、次回企画で重要部分をより早く提示する案を検討する'
    ]::text[],
    array['冒頭30秒チェック','維持率の山谷メモ','次回改善仮説','再編集候補']::text[],
    array[
      '単一動画の維持率だけで普遍的な成功法則を断定しない',
      '再生数や維持率の改善を保証しない'
    ]::text[],
    array['sidejob_video']::text[],
    97,'active','admin',null,'fresh_first',stable_at,
    array[
      'https://support.google.com/youtube/answer/9314415?hl=ja',
      'https://support.google.com/youtube/answer/9313698?hl=ja'
    ]::text[],
    'YouTube公式の視聴者維持率とエンゲージメント分析を確認。冒頭の期待一致、離脱箇所、トップモーメントを次回改善へつなぐ実務Knowledgeへ整理。',
    now(),next_version,now()
  ),
  (
    'auto:task:sidejob_video:title-thumbnail-analytics-loop-20260924',
    'task',
    'タイトル・サムネイルを分析指標で検証する',
    null,
    array['YouTubeタイトル','サムネイル分析','CTR','インプレッション']::text[],
    array[
      'タイトル・サムネイル案は対象視聴者と動画内容を基準に作り、公開後の分析で仮説を検証する',
      'タイトルとサムネイルの評価では、インプレッション、クリック率、視聴への接続を単独ではなく組み合わせて確認する',
      '検索意図を狙う案と興味喚起を狙う案を目的に応じて分け、動画内容と一致する範囲で試す'
    ]::text[],
    array['タイトル仮説','サムネイル仮説','公開後確認指標','改善ログ']::text[],
    array[
      'CTRだけを成功の唯一の指標として扱わない',
      '動画内容と一致しない誇張表現をクリック率目的で追加しない'
    ]::text[],
    array['sidejob_video']::text[],
    96,'active','admin',null,'fresh_first',stable_at,
    array[
      'https://support.google.com/youtube/answer/12340300?hl=ja',
      'https://support.google.com/youtube/answer/9314486?hl=ja'
    ]::text[],
    'YouTube公式のタイトル/サムネイルのヒントとインプレッション・クリック率の分析案内を確認。制作→公開→指標確認→改善のループへ整理。',
    now(),next_version,now()
  ),
  (
    'auto:task:sidejob_resale:listing-completeness-20260924',
    'task',
    '商品名・状態・付属品を正確に揃える出品設計',
    null,
    array['商品説明','出品タイトル','商品状態','付属品']::text[],
    array[
      '出品前に商品名、ブランド・型番等の識別情報、状態、傷や不具合、付属品を現物確認して整理する',
      '検索されやすさのための語句を入れる場合も、現物で確認できない固有名詞や仕様を推測で追加しない',
      '商品カテゴリに応じて購入判断へ必要な状態情報を洗い出し、説明と写真で矛盾がないようにする'
    ]::text[],
    array['現物確認表','商品名','状態説明','付属品一覧','撮影カット一覧']::text[],
    array[
      '未確認の型番・仕様・動作・購入時期を作らない',
      '傷や不具合を意図的に隠す説明を作らない'
    ]::text[],
    array['sidejob_resale']::text[],
    98,'active','admin',null,'fresh_first',stable_at,
    array[
      'https://help.jp.mercari.com/guide/articles/62/',
      'https://help.jp.mercari.com/guide/articles/273/'
    ]::text[],
    'メルカリ公式の出品フローと商品別出品ガイドを確認。商品名・状態・補足情報を現物ベースで揃える出品Knowledgeへ整理。',
    now(),next_version,now()
  ),
  (
    'auto:task:sidejob_resale:packing-shipping-transaction-check-20260924',
    'task',
    '梱包・発送・発送通知の取引チェック',
    null,
    array['梱包','発送','発送通知','取引チェック']::text[],
    array[
      '商品特性に合わせて水濡れ・衝撃・型崩れ等のリスクを確認し、必要な梱包材と固定方法を決める',
      '発送前に取引商品・付属品・配送方法・宛先処理が一致しているか確認する',
      '発送通知は実際の発送手続き完了後に行い、取引画面上の期限や案内に従う'
    ]::text[],
    array['梱包チェック','発送前照合','発送通知確認','取引完了までの確認項目']::text[],
    array[
      '発送前に発送通知を行う手順を推奨しない',
      '送料・サイズ・配送条件を最新確認なしに固定値として扱わない'
    ]::text[],
    array['sidejob_resale']::text[],
    97,'active','admin',null,'fresh_first',stable_at,
    array[
      'https://help.jp.mercari.com/guide/articles/63/',
      'https://help.jp.mercari.com/guide/articles/89/'
    ]::text[],
    'メルカリ公式の商品販売後フローと梱包ガイドを確認。梱包、発送前照合、発送通知を一連のチェックリストへ整理。',
    now(),next_version,now()
  ),
  (
    'auto:cross:crowd-efficiency:contract-time-worklog-20260924',
    'combination',
    '固定報酬・時間単価に合わせた作業管理',
    null,
    array['固定報酬','時間単価','作業ログ','工数管理']::text[],
    array[
      '案件が成果物ベースか時間ベースかを確認し、完了条件・作業時間・報告方法を契約形式に合わせて整理する',
      '固定報酬では成果物と検収条件、時間単価では稼働時間と作業内容の記録を分けてSOPへ落とす',
      '作業前に納期、報酬、修正範囲、連絡方法、必要な記録方法を確認する'
    ]::text[],
    array['契約形式確認','作業ログ','成果物チェック','報告テンプレート']::text[],
    array[
      '固定報酬と時間単価の管理方法を混同しない',
      '合意していない作業時間や追加成果物を請求前提として扱わない'
    ]::text[],
    array['sidejob_crowdsourcing','sidejob_efficiency']::text[],
    96,'active','admin',null,'fresh_first',stable_at,
    array[
      'https://crowdworks.jp/pages/guides/employee/fixed_price',
      'https://crowdworks.jp/pages/guides/employee/hourly'
    ]::text[],
    'クラウドワークス公式の固定報酬制と時間単価制の受注フローを確認。契約形式ごとの成果物・時間記録・報告方法を業務管理Knowledgeへ整理。',
    now(),next_version,now()
  ),
  (
    'auto:cross:research-efficiency:evaluation-dataset-loop-20260924',
    'combination',
    '代表例データでAI業務を評価・改善する',
    null,
    array['評価','Evals','データセット','品質改善','プロンプト検証']::text[],
    array[
      'AIを使う定型業務では、期待する品質基準を明文化し、代表的な正常例・難しい例・失敗例で確認する',
      'プロンプトやモデルを変更した時は、同じ代表例で比較し、改善した点と悪化した点を記録する',
      '評価結果を根拠にSOP・入力テンプレート・出力形式を更新し、一度の成功例だけで完成と判断しない'
    ]::text[],
    array['品質基準','代表例セット','評価結果表','改善履歴']::text[],
    array[
      '少数の都合の良い例だけで精度を保証しない',
      '評価対象に個人情報・機密情報を無断で含めない'
    ]::text[],
    array['sidejob_research','sidejob_efficiency']::text[],
    98,'active','admin',null,'fresh_first',stable_at,
    array[
      'https://developers.openai.com/api/docs/guides/evaluation-getting-started',
      'https://developers.openai.com/api/docs/guides/evals'
    ]::text[],
    'OpenAI公式のDatasets/Evalsガイドを確認。指定した品質基準に対して代表例でモデル・プロンプト変更を評価する考え方を、リサーチと業務効率化へ一般化。',
    now(),next_version,now()
  ),
  (
    'auto:cross:research-planning:evidence-matrix-20260924',
    'combination',
    '副業候補を確認済み事実と未確認事項で比較する',
    null,
    array['副業比較','根拠マトリクス','確認事項','意思決定']::text[],
    array[
      '副業候補ごとに必要時間、初期費用、必要スキル、就業ルール、契約上の注意を同じ比較軸で整理する',
      '各項目を確認済み・ユーザー入力・未確認に分け、未確認項目は判断前に調べるリストへ回す',
      '制度や勤務ルールなど時点依存の情報は、最新の公式情報と本人の勤務先ルールを確認する'
    ]::text[],
    array['副業比較表','確認済み/未確認マトリクス','追加調査リスト','小さく試す計画']::text[],
    array[
      '一般的な副業ガイドだけで本人の勤務先が副業可能と断定しない',
      '収益見込みを未確認の市場データから保証しない'
    ]::text[],
    array['sidejob_research','sidejob_planning']::text[],
    99,'active','admin',null,'fresh_first',stable_at,
    array[
      'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000192188.html',
      'https://developers.openai.com/api/docs/guides/tools-web-search'
    ]::text[],
    '厚生労働省の副業・兼業ガイドライン案内とOpenAI公式Web検索ガイドを確認。副業候補の時点依存条件を根拠付きで比較するKnowledgeへ整理。',
    now(),next_version,now()
  ),
  (
    'auto:task:sidejob_planning:workload-health-hours-20260924',
    'task',
    '本業との両立・労働時間・健康管理を開始条件にする',
    null,
    array['副業両立','労働時間','健康管理','本業']::text[],
    array[
      '副業開始前に本業と副業の予定時間を可視化し、睡眠・休息・移動等を含めて継続可能な上限を考える',
      '雇用される形の副業では、労働時間管理に関する最新の制度・勤務先の運用を確認する',
      '副業候補は収益性だけでなく、継続可能性、健康、本業への影響、情報管理を比較軸に含める'
    ]::text[],
    array['週間時間配分','継続上限','本業ルール確認','健康・休息チェック']::text[],
    array[
      '長時間労働を前提に副業を推奨しない',
      '個別の労働法上の判断を一般情報だけで確定しない',
      '健康状態を推測して可否を断定しない'
    ]::text[],
    array['sidejob_planning']::text[],
    100,'active','admin',null,'fresh_first',stable_at,
    array[
      'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000192188.html'
    ]::text[],
    '厚生労働省の副業・兼業ガイドライン、労働時間通算、健康確保に関する案内を確認。本業との両立と継続可能性を副業選定の開始条件へ反映。',
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
    'Phase 57 Knowledge Depth: 10件を追加し、12副業タスクすべてを出典付きCloud Knowledge 3件以上へ拡張。Compiler側は関連Cloud Knowledge最大5件に制限。',
    10, 0, next_version,
    jsonb_build_object(
      'knowledge', jsonb_build_object(
        'added', 10,
        'updated', 0,
        'unchanged', 0,
        'items', jsonb_build_array(
          jsonb_build_object('item_type','knowledge','key','auto:cross:commercial:prepublish-claims-check-20260924','label','販売前の事実・広告表示・提供範囲チェック','action','added','changed_fields',jsonb_build_array('new','tasks','sources'),'source_summary','消費者庁/note公式'),
          jsonb_build_object('item_type','knowledge','key','auto:cross:sns-outreach:automation-consent-personalization-20260924','label','SNS・営業自動化の同意・個別化・重複回避','action','added','changed_fields',jsonb_build_array('new','tasks','sources'),'source_summary','X公式'),
          jsonb_build_object('item_type','knowledge','key','auto:task:sidejob_video:retention-improvement-loop-20260924','label','視聴者維持率から動画構成を改善する','action','added','changed_fields',jsonb_build_array('new','tasks','sources'),'source_summary','YouTube公式'),
          jsonb_build_object('item_type','knowledge','key','auto:task:sidejob_video:title-thumbnail-analytics-loop-20260924','label','タイトル・サムネイルを分析指標で検証する','action','added','changed_fields',jsonb_build_array('new','tasks','sources'),'source_summary','YouTube公式'),
          jsonb_build_object('item_type','knowledge','key','auto:task:sidejob_resale:listing-completeness-20260924','label','商品名・状態・付属品を正確に揃える出品設計','action','added','changed_fields',jsonb_build_array('new','tasks','sources'),'source_summary','メルカリ公式'),
          jsonb_build_object('item_type','knowledge','key','auto:task:sidejob_resale:packing-shipping-transaction-check-20260924','label','梱包・発送・発送通知の取引チェック','action','added','changed_fields',jsonb_build_array('new','tasks','sources'),'source_summary','メルカリ公式'),
          jsonb_build_object('item_type','knowledge','key','auto:cross:crowd-efficiency:contract-time-worklog-20260924','label','固定報酬・時間単価に合わせた作業管理','action','added','changed_fields',jsonb_build_array('new','tasks','sources'),'source_summary','クラウドワークス公式'),
          jsonb_build_object('item_type','knowledge','key','auto:cross:research-efficiency:evaluation-dataset-loop-20260924','label','代表例データでAI業務を評価・改善する','action','added','changed_fields',jsonb_build_array('new','tasks','sources'),'source_summary','OpenAI公式'),
          jsonb_build_object('item_type','knowledge','key','auto:cross:research-planning:evidence-matrix-20260924','label','副業候補を確認済み事実と未確認事項で比較する','action','added','changed_fields',jsonb_build_array('new','tasks','sources'),'source_summary','厚生労働省/OpenAI公式'),
          jsonb_build_object('item_type','knowledge','key','auto:task:sidejob_planning:workload-health-hours-20260924','label','本業との両立・労働時間・健康管理を開始条件にする','action','added','changed_fields',jsonb_build_array('new','tasks','sources'),'source_summary','厚生労働省')
        )
      ),
      'prompt', jsonb_build_object('added',0,'updated',0,'unchanged',0,'items',jsonb_build_array())
    )
  );
end
$migration$;
