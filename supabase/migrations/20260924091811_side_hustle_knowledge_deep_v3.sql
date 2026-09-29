-- Phase 58: deepen all side-hustle Knowledge areas to at least 5 active source-backed rules.
-- Sources checked 2026-09-24. Fresh-first, then Stable after configured delay.

do $migration$
declare
  next_version bigint;
  stable_delay_hours integer := 168;
  stable_at timestamptz;
begin
  select greatest(current_version + 1, 5)
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
    'auto:cross:copyright:source-rights-check-20260924',
    'combination',
    '画像・文章・素材の権利と出典を公開前に確認する',
    null,
    array['著作権','素材利用','画像利用','引用確認','出典確認']::text[],
    array[
      '他者の文章・画像・動画・音声を使う前に、権利者、利用条件、必要な許諾や出典表示を確認する',
      'ネット上で見つけた素材を自由利用可能とみなさず、公式素材・自作素材・利用条件が明確な素材を優先する',
      '引用や参考情報を使う場合は、自分の成果物と参照部分を区別し、必要な出典情報を残す'
    ]::text[],
    array['使用素材一覧','権利・利用条件チェック','出典一覧','差し替えが必要な素材一覧']::text[],
    array[
      'ネット上に公開されているだけで自由利用可能と断定しない',
      '権利者の許諾や利用条件が不明な素材を商用利用前提で使わない',
      '他者の作品を自作物として表示しない'
    ]::text[],
    array['sidejob_content','sidejob_sns','sidejob_video','sidejob_affiliate','sidejob_digital_product','sidejob_skill_sales']::text[],
    100,'active','admin',null,'fresh_first',stable_at,
    array[
      'https://www.bunka.go.jp/seisaku/chosakuken/taisetsu/point/',
      'https://www.bunka.go.jp/chosakuken/'
    ]::text[],
    '文化庁の著作権案内を確認。ネット上の画像等も原則として権利者が存在し、利用条件・権利者意思の確認が必要という考え方を、制作・販売・SNS・動画へ横断適用するKnowledgeへ整理。',
    now(),next_version,now()
  ),
  (
    'auto:cross:tax:income-expense-records-20260924',
    'combination',
    '副業の収入・経費・証憑を日々記録する',
    null,
    array['記帳','帳簿','副業収入','必要経費','領収書','確定申告準備']::text[],
    array[
      '売上・報酬・仕入れ・経費は、取引日、相手方、内容、金額、関連する請求書や領収書を後から確認できる形で記録する',
      '副業の所得区分や申告要否は活動形態・金額・本人状況で変わるため、個別判断が必要な場合は国税庁の最新情報や税務専門家へ確認する',
      '売上と手取りを混同せず、プラットフォーム手数料、送料、仕入れ等を別項目で記録できる形にする'
    ]::text[],
    array['収入記録項目','経費記録項目','証憑保存チェック','月次集計テンプレート']::text[],
    array[
      '全ての副業収入を一律に同じ所得区分と断定しない',
      '申告不要・経費算入可能などの個別税務判断をAASだけで確定しない',
      '領収書や取引記録を保存しなくてよいと案内しない'
    ]::text[],
    array['sidejob_affiliate','sidejob_resale','sidejob_crowdsourcing','sidejob_skill_sales','sidejob_digital_product','sidejob_planning']::text[],
    99,'active','admin',null,'fresh_first',stable_at,
    array[
      'https://www.nta.go.jp/taxes/shiraberu/shinkoku/kojin_jigyo/index.htm',
      'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1500.htm'
    ]::text[],
    '国税庁の記帳・帳簿保存案内と雑所得案内を確認。副業運営で収入・経費・取引記録を残し、所得区分や申告要否は個別条件で確認するKnowledgeへ整理。',
    now(),next_version,now()
  ),
  (
    'auto:cross:privacy:minimum-customer-data-20260924',
    'combination',
    '顧客・案件情報は必要最小限だけ取り扱う',
    null,
    array['個人情報','顧客情報','案件情報','データ最小化','機密情報']::text[],
    array[
      '案件遂行に必要な情報と不要な情報を分け、目的に不要な個人情報を収集・コピー・AI入力しない',
      '顧客情報や案件データをAIへ入力する前に、契約・社内ルール・利用AIの取扱条件上問題ないか確認する',
      '成果物・作業ログ・テンプレートへ実データを残す必要がない場合は、匿名化した例やダミーデータへ置き換える'
    ]::text[],
    array['必要データ一覧','入力禁止情報一覧','匿名化チェック','削除・保管確認']::text[],
    array[
      '案件に不要な個人情報を念のためという理由だけで集めない',
      '顧客や依頼者の機密情報を公開テンプレートや実績例へ転用しない',
      '個人情報を外部AIへ送信してよいと一律に判断しない'
    ]::text[],
    array['sidejob_crowdsourcing','sidejob_skill_sales','sidejob_outreach','sidejob_efficiency']::text[],
    100,'active','admin',null,'fresh_first',stable_at,
    array[
      'https://www.ppc.go.jp/personalinfo/legal/'
    ]::text[],
    '個人情報保護委員会の個人情報保護法ガイドライン案内を確認。利用目的に沿った適正な取扱いを前提に、案件・顧客データを必要最小限にする実務Knowledgeへ整理。',
    now(),next_version,now()
  ),
  (
    'auto:cross:ecommerce:prepurchase-disclosure-20260924',
    'combination',
    'オンライン販売は申込み前に条件を明確にする',
    null,
    array['通信販売','特定商取引法','販売条件','返品条件','申込み確認']::text[],
    array[
      'オンラインで商品・サービスを販売する場合は、販売者情報、価格や追加費用、支払・提供条件、返品・解約等の必要表示を公開前に確認する',
      '購入直前の画面では、購入者が何をいくらで申し込み、どの条件が適用されるかを確認できる設計を優先する',
      '利用プラットフォームが表示を代行する項目と、販売者自身が設定・記載すべき項目を分けて確認する'
    ]::text[],
    array['販売条件一覧','購入前表示チェック','返品・解約条件確認','販売者情報確認']::text[],
    array[
      '通信販売に必要な表示項目をAASの固定テンプレートだけで満たせると断定しない',
      '購入者が重要条件を確認しにくい表示を推奨しない',
      '返品・解約条件を未確認のまま創作しない'
    ]::text[],
    array['sidejob_content','sidejob_digital_product','sidejob_skill_sales','sidejob_affiliate']::text[],
    100,'active','admin',null,'fresh_first',stable_at,
    array[
      'https://www.no-trouble.caa.go.jp/what/mailorder/advertising.php',
      'https://www.no-trouble.caa.go.jp/qa/advertising.html'
    ]::text[],
    '消費者庁の特定商取引法ガイド（通信販売広告・Q&A）を確認。オンライン販売の広告表示と申込み段階で重要条件を確認できるようにするKnowledgeへ整理。',
    now(),next_version,now()
  ),
  (
    'auto:cross:marketplace:keep-contact-payment-on-platform-20260924',
    'combination',
    '案件・スキル販売は連絡と決済のプラットフォーム規約を守る',
    null,
    array['外部連絡','外部決済','直接取引','案件安全','プラットフォーム決済']::text[],
    array[
      '案件受注やスキル販売では、契約前後の連絡先交換・外部誘導・決済方法について利用サービスの現在ルールを確認する',
      'プラットフォームが仮払い・預かり決済等を提供する場合は、必要な手続き完了を確認してから作業へ進む',
      '外部連絡が例外的に認められる場合でも、申請・承認等の条件があるかを確認する'
    ]::text[],
    array['連絡手段確認','支払方法確認','契約/仮払い確認','外部誘導チェック']::text[],
    array[
      '規約で禁止されている直接取引や外部決済を回避方法付きで案内しない',
      '契約・仮払い等の必要手続き前に完成作業を始める前提にしない',
      '購入者や依頼者から求められたという理由だけで禁止された外部誘導へ応じない'
    ]::text[],
    array['sidejob_crowdsourcing','sidejob_skill_sales','sidejob_outreach']::text[],
    100,'active','admin',null,'fresh_first',stable_at,
    array[
      'https://crowdworks.jp/pages/guidelines/message',
      'https://crowdworks.jp/pages/guidelines/job_offer',
      'https://coconala.com/smartphone/pages/guide_rule'
    ]::text[],
    'クラウドワークスのメッセージ/仕事依頼ガイドラインとココナラのルールを確認。外部連絡・直接取引・外部決済を安易に案内しない案件安全Knowledgeへ整理。',
    now(),next_version,now()
  ),
  (
    'auto:cross:analytics:measure-before-optimizing-20260924',
    'combination',
    'SNS・動画は指標を分けて改善仮説を作る',
    null,
    array['アナリティクス','表示回数','エンゲージメント','視聴時間','改善仮説']::text[],
    array[
      '投稿や動画の改善では、表示・到達、クリックや反応、視聴継続など異なる段階の指標を分けて確認する',
      '一つの指標だけで良し悪しを決めず、目的に対応する複数指標と実際の内容を合わせて改善仮説を作る',
      '期間やコンテンツ形式を揃えて比較し、変更した要素と結果を改善ログへ残す'
    ]::text[],
    array['目的指標','到達指標','反応指標','継続指標','改善ログ']::text[],
    array[
      '表示回数やクリック率だけを最終成果として扱わない',
      '単発の好成績だけで再現性を保証しない',
      'プラットフォームの指標定義が将来も固定と断定しない'
    ]::text[],
    array['sidejob_sns','sidejob_video']::text[],
    97,'active','admin',null,'fresh_first',stable_at,
    array[
      'https://help.x.com/ja/using-x/view-counts',
      'https://help.x.com/ja/using-x/media-studio-analytics',
      'https://support.google.com/youtube/answer/9002587?hl=ja'
    ]::text[],
    'X公式の表示回数/Media StudioアナリティクスとYouTube公式Analytics案内を確認。到達・反応・視聴継続等を分け、単一指標だけで最適化しないKnowledgeへ整理。',
    now(),next_version,now()
  ),
  (
    'auto:cross:research:multi-source-grounding-20260924',
    'combination',
    '時点依存情報は一次情報を複数確認して根拠を残す',
    null,
    array['Web調査','一次情報','最新情報','複数ソース','根拠確認']::text[],
    array[
      '価格、規約、機能、制度、統計など変動する情報はWeb検索だけでなく参照元ページを開き、対象日・地域・プラン等の条件を確認する',
      '重要判断に使う情報は可能な範囲で複数の信頼できる情報源を照合し、公式一次情報を優先する',
      '確認できた事実、推定、未確認事項を分け、後から再確認できるURLと確認日を残す'
    ]::text[],
    array['確認済み事実','根拠URL','確認日','食い違い一覧','未確認事項']::text[],
    array[
      '検索結果スニペットだけで重要事項を断定しない',
      '複数サイトに同じ記述があるだけで一次情報確認済みとみなさない',
      '古いページと最新ページが食い違う場合に都合のよい方だけを採用しない'
    ]::text[],
    array['sidejob_research','sidejob_planning','sidejob_content','sidejob_affiliate']::text[],
    99,'active','admin',null,'fresh_first',stable_at,
    array[
      'https://developers.openai.com/api/docs/guides/tools-web-search',
      'https://docs.anthropic.com/zh-CN/docs/agents-and-tools/tool-use/web-search-tool',
      'https://ai.google.dev/gemini-api/docs/google-search'
    ]::text[],
    'OpenAI・Anthropic・Googleの公式Web検索/グラウンディング文書を確認。検索結果から一次情報へ戻り、複数根拠と確認日を残すリサーチKnowledgeへ整理。',
    now(),next_version,now()
  ),
  (
    'auto:cross:ai-workflow:evaluate-human-review-20260924',
    'combination',
    'AI成果物は代表例評価と人の確認を通す',
    null,
    array['AI品質管理','Evals','人による確認','代表例','回帰確認']::text[],
    array[
      'AIを業務へ組み込む前に、通常例・難しい例・失敗しやすい例を含む代表例で期待品質を確認する',
      'プロンプト・モデル・Knowledgeを変更した時は同じ評価例で比較し、改善と回帰を記録する',
      '外部公開、納品、重要判断へ使う最終成果物は、AI出力だけで完了扱いにせず人が事実・条件・体裁を確認する'
    ]::text[],
    array['代表例セット','品質基準','評価結果','人による最終確認表','変更履歴']::text[],
    array[
      '一度成功した例だけで自動化の品質を保証しない',
      'AI評価スコアだけで事実性や契約条件の確認を省略しない',
      '評価データへ顧客の機密情報を無断で含めない'
    ]::text[],
    array['sidejob_research','sidejob_efficiency','sidejob_crowdsourcing','sidejob_content']::text[],
    99,'active','admin',null,'fresh_first',stable_at,
    array[
      'https://developers.openai.com/api/docs/guides/evaluation-getting-started',
      'https://developers.openai.com/api/docs/guides/evals'
    ]::text[],
    'OpenAI公式のDatasets/Evalsガイドを確認。代表例で変更前後を評価し、人による最終確認を残すAI業務品質管理Knowledgeへ整理。',
    now(),next_version,now()
  ),
  (
    'auto:task:sidejob_resale:price-fee-shipping-margin-20260924',
    'task',
    '販売価格・手数料・送料を分けて利益を確認する',
    null,
    array['販売価格','送料','手数料','利益','価格設定']::text[],
    array[
      '価格を決める前に、商品の状態、類似商品の価格、販売手数料、送料等を別項目で確認する',
      '表示価格と実際の手取りを区別し、値下げ後も想定する最低受取額を下回らないか確認する',
      '送料や手数料はサービス・配送方法で変動するため、出品時点の公式表示を確認して計算する'
    ]::text[],
    array['価格比較','手数料確認','送料確認','想定手取り','最低価格ライン']::text[],
    array[
      '現在の手数料率や送料をKnowledge内の固定値として断定しない',
      '相場検索だけで商品の真贋や状態差を無視した価格を決めない',
      '利益を保証する価格として提示しない'
    ]::text[],
    array['sidejob_resale']::text[],
    97,'active','admin',null,'fresh_first',stable_at,
    array[
      'https://help.jp.mercari.com/guide/articles/64/',
      'https://help.jp.mercari.com/guide/articles/107/'
    ]::text[],
    'メルカリ公式の価格設定と送料負担の案内を確認。状態・相場・送料・手数料を分けて想定手取りを確認する物販Knowledgeへ整理。',
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
    'Phase 58 Deep Knowledge: 9件を追加し、12副業タスクすべてを出典付きCloud Knowledge 5件以上へ拡張。著作権・税務記録・個人情報・通信販売・外部決済・分析・根拠確認・AI品質・物販利益管理を追加。',
    9, 0, next_version,
    jsonb_build_object(
      'knowledge', jsonb_build_object(
        'added', 9,
        'updated', 0,
        'unchanged', 0,
        'items', jsonb_build_array(
          jsonb_build_object('item_type','knowledge','key','auto:cross:copyright:source-rights-check-20260924','label','画像・文章・素材の権利と出典を公開前に確認する','action','added','changed_fields',jsonb_build_array('new','tasks','sources'),'source_summary','文化庁'),
          jsonb_build_object('item_type','knowledge','key','auto:cross:tax:income-expense-records-20260924','label','副業の収入・経費・証憑を日々記録する','action','added','changed_fields',jsonb_build_array('new','tasks','sources'),'source_summary','国税庁'),
          jsonb_build_object('item_type','knowledge','key','auto:cross:privacy:minimum-customer-data-20260924','label','顧客・案件情報は必要最小限だけ取り扱う','action','added','changed_fields',jsonb_build_array('new','tasks','sources'),'source_summary','個人情報保護委員会'),
          jsonb_build_object('item_type','knowledge','key','auto:cross:ecommerce:prepurchase-disclosure-20260924','label','オンライン販売は申込み前に条件を明確にする','action','added','changed_fields',jsonb_build_array('new','tasks','sources'),'source_summary','消費者庁'),
          jsonb_build_object('item_type','knowledge','key','auto:cross:marketplace:keep-contact-payment-on-platform-20260924','label','案件・スキル販売は連絡と決済のプラットフォーム規約を守る','action','added','changed_fields',jsonb_build_array('new','tasks','sources'),'source_summary','クラウドワークス/ココナラ'),
          jsonb_build_object('item_type','knowledge','key','auto:cross:analytics:measure-before-optimizing-20260924','label','SNS・動画は指標を分けて改善仮説を作る','action','added','changed_fields',jsonb_build_array('new','tasks','sources'),'source_summary','X/YouTube公式'),
          jsonb_build_object('item_type','knowledge','key','auto:cross:research:multi-source-grounding-20260924','label','時点依存情報は一次情報を複数確認して根拠を残す','action','added','changed_fields',jsonb_build_array('new','tasks','sources'),'source_summary','OpenAI/Anthropic/Google公式'),
          jsonb_build_object('item_type','knowledge','key','auto:cross:ai-workflow:evaluate-human-review-20260924','label','AI成果物は代表例評価と人の確認を通す','action','added','changed_fields',jsonb_build_array('new','tasks','sources'),'source_summary','OpenAI公式'),
          jsonb_build_object('item_type','knowledge','key','auto:task:sidejob_resale:price-fee-shipping-margin-20260924','label','販売価格・手数料・送料を分けて利益を確認する','action','added','changed_fields',jsonb_build_array('new','tasks','sources'),'source_summary','メルカリ公式')
        )
      ),
      'prompt', jsonb_build_object('added',0,'updated',0,'unchanged',0,'items',jsonb_build_array())
    )
  );
end
$migration$;
