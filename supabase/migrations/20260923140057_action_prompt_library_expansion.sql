
insert into public.action_prompt_templates
(slug,title,category_key,side_hustle,description,recommended_ai,input_schema,prompt_template,status,sort_order)
values
(
'blog-seo-outline','ブログ・SEO記事の構成','content','ブログ・アフィリエイト',
'検索意図を整理し、読者が行動できる記事構成を作ります。','ChatGPT',
'[{"key":"topic","label":"狙うテーマ・キーワード","placeholder":"例：在宅ワーク 始め方","multiline":false},{"key":"audience","label":"想定読者","placeholder":"例：副業初心者","multiline":false},{"key":"goal","label":"記事の目的","placeholder":"例：選択肢を比較できる状態にする","multiline":false},{"key":"notes","label":"確認済み情報・制約","placeholder":"一次情報、含めたい内容、避けたい断定など","multiline":true}]'::jsonb,
$prompt$あなたは日本語のWeb編集者です。
以下の条件から、検索流入を想定した記事構成を作ってください。

テーマ・キーワード: {{topic}}
想定読者: {{audience}}
記事の目的: {{goal}}
確認済み情報・制約: {{notes}}

検索意図、読者の疑問、タイトル案、H2/H3構成、各見出しの要点、必要な一次情報、読後の行動を整理してください。
検索順位や成果を保証せず、未確認の統計・価格・仕様は断定しないでください。$prompt$,
'active',15
),
(
'content-sales-page','有料コンテンツ販売ページ','content','note・Brain・Tips販売',
'販売する内容と対象読者から、誇張を避けた販売ページ構成を作ります。','Claude',
'[{"key":"topic","label":"販売コンテンツの内容","placeholder":"何を提供するか","multiline":false},{"key":"audience","label":"想定購入者","placeholder":"誰向けか","multiline":false},{"key":"goal","label":"購入後にできるようになること","placeholder":"具体的な到達状態","multiline":false},{"key":"notes","label":"事実として使える情報","placeholder":"目次、特典、価格など確認済み情報のみ","multiline":true}]'::jsonb,
$prompt$デジタルコンテンツの販売ページ案を作成してください。

内容: {{topic}}
想定購入者: {{audience}}
購入後の到達状態: {{goal}}
事実として使える情報: {{notes}}

対象者、抱えている課題、得られる内容、目次・中身、向いている人/向いていない人、購入前の注意点、自然なCTAの順で構成してください。
架空の購入者レビュー、売上、販売数、成果保証、根拠のない限定性は追加しないでください。$prompt$,
'active',18
),
(
'sns-profile-design','SNSプロフィール設計','sns','SNS運用',
'発信テーマと目的から、名前・プロフィール・発信の柱をまとめます。','ChatGPT',
'[{"key":"topic","label":"発信テーマ・ジャンル","placeholder":"例：AI副業、ゲーム、節約","multiline":false},{"key":"audience","label":"届けたい相手","placeholder":"例：副業初心者","multiline":false},{"key":"goal","label":"アカウントの目的","placeholder":"例：記事へ誘導、認知、案件獲得","multiline":false},{"key":"notes","label":"本人について使える事実","placeholder":"経験、得意分野、発信できる内容など","multiline":true}]'::jsonb,
$prompt$SNSアカウントのプロフィール設計をしてください。

発信テーマ: {{topic}}
届けたい相手: {{audience}}
目的: {{goal}}
本人について使える事実: {{notes}}

表示名候補、プロフィール文3案、発信の柱3〜5個、固定投稿の役割、最初の投稿ネタ10個を出してください。
入力されていない肩書き、資格、実績、収益は作らないでください。$prompt$,
'active',22
),
(
'tiktok-content-plan','TikTok・短尺投稿企画','sns','ショート動画運用',
'短尺動画向けに、冒頭フックから本題、CTAまでの企画を量産します。','Gemini',
'[{"key":"topic","label":"発信テーマ","placeholder":"例：AI活用、ゲーム、商品紹介","multiline":false},{"key":"audience","label":"想定視聴者","placeholder":"例：初心者、忙しい会社員","multiline":false},{"key":"goal","label":"投稿の目的","placeholder":"例：保存、フォロー、プロフィール遷移","multiline":false},{"key":"notes","label":"素材・制約","placeholder":"撮影できる内容、顔出し有無、尺など","multiline":true}]'::jsonb,
$prompt$TikTokまたは短尺SNS動画の投稿企画を作成してください。

テーマ: {{topic}}
想定視聴者: {{audience}}
目的: {{goal}}
素材・制約: {{notes}}

冒頭1〜2秒のフック、15〜60秒の構成、画面に出す短い文字、話す内容、CTAを含む企画を5本作ってください。
過度な煽り、虚偽の成果、未確認の数値を使わないでください。$prompt$,
'active',24
),
(
'short-video-script','ショート動画台本','video','YouTube Shorts・TikTok',
'短い尺でも結論が伝わる口語台本を作ります。','ChatGPT',
'[{"key":"topic","label":"動画テーマ・結論","placeholder":"何を一番伝えたいか","multiline":false},{"key":"audience","label":"想定視聴者","placeholder":"誰向けか","multiline":false},{"key":"goal","label":"視聴後の行動","placeholder":"例：保存、コメント、長尺動画を見る","multiline":false},{"key":"notes","label":"尺・素材・口調","placeholder":"例：30秒、テロップ中心","multiline":true}]'::jsonb,
$prompt$短尺動画の台本を作成してください。

テーマ・結論: {{topic}}
想定視聴者: {{audience}}
視聴後の行動: {{goal}}
尺・素材・口調: {{notes}}

フック、本題、具体例または手順、まとめ、CTAの順で、短く話しやすい口語にしてください。
入力されていない体験談や成果を一人称の事実として追加しないでください。$prompt$,
'active',32
),
(
'stream-title-description','配信タイトル・概要欄','video','ゲーム配信',
'配信内容からクリック前に内容が分かるタイトルと概要欄を作ります。','ChatGPT',
'[{"key":"topic","label":"配信内容・ゲーム名","placeholder":"例：初見プレイ、ランク上げ","multiline":false},{"key":"audience","label":"想定視聴者","placeholder":"例：同じゲームの初心者","multiline":false},{"key":"goal","label":"今回の配信目標","placeholder":"配信内で何をするか","multiline":false},{"key":"notes","label":"確認済み情報・条件","placeholder":"配信時間、参加型の有無など","multiline":true}]'::jsonb,
$prompt$YouTube等のゲーム配信用にタイトルと概要欄を作成してください。

配信内容・ゲーム名: {{topic}}
想定視聴者: {{audience}}
今回の目標: {{goal}}
確認済み情報・条件: {{notes}}

タイトル候補5案、概要欄、冒頭に置く短い説明、必要ならハッシュタグ候補を出してください。
ゲームの未確認仕様、実績、ランク、達成内容を勝手に作らないでください。$prompt$,
'active',34
),
(
'youtube-thumbnail-concept','YouTubeサムネイル構成','design','YouTube・配信',
'動画内容から、人物・文字・視線誘導を整理したサムネイル案を作ります。','ChatGPT',
'[{"key":"topic","label":"動画・配信内容","placeholder":"何の動画か","multiline":false},{"key":"audience","label":"想定視聴者","placeholder":"誰に見てほしいか","multiline":false},{"key":"goal","label":"一目で伝えたいこと","placeholder":"例：初心者挑戦、検証、攻略","multiline":false},{"key":"notes","label":"使える素材・条件","placeholder":"人物素材、ゲーム画面、入れたい文字など","multiline":true}]'::jsonb,
$prompt$YouTubeサムネイルの構成案を作成してください。

動画・配信内容: {{topic}}
想定視聴者: {{audience}}
一目で伝えたいこと: {{goal}}
使える素材・条件: {{notes}}

文字は短く、主役、表情/ポーズ、背景、文字配置、視線誘導、強調エフェクト、避ける要素を整理した案を3つ出してください。
実在ブランドのロゴや使えない第三者素材を勝手に追加しないでください。$prompt$,
'active',42
),
(
'digital-product-cover','デジタル商品の表紙・バナー案','design','デジタル商品販売',
'教材・PDF・有料記事などの内容を視覚的に伝えるデザイン指示を作ります。','Claude',
'[{"key":"topic","label":"商品内容・タイトル","placeholder":"何を販売するか","multiline":false},{"key":"audience","label":"想定購入者","placeholder":"誰向けか","multiline":false},{"key":"goal","label":"表紙で伝える印象","placeholder":"例：初心者向け、実践的、落ち着き","multiline":false},{"key":"notes","label":"色・サイズ・素材条件","placeholder":"ブランド色、画像比率など","multiline":true}]'::jsonb,
$prompt$デジタル商品の表紙または販売バナーのデザイン指示を作成してください。

商品内容・タイトル: {{topic}}
想定購入者: {{audience}}
伝えたい印象: {{goal}}
色・サイズ・素材条件: {{notes}}

情報の優先順位、短い見出し、補助文字、レイアウト、配色、背景、アイコン/人物の有無、画像生成AIへ渡す指示を整理してください。
本文のような長文を画像内へ入れないでください。$prompt$,
'active',44
),
(
'affiliate-review-outline','比較・レビュー記事の設計','affiliate','アフィリエイト',
'実体験を捏造せず、確認できる情報と判断軸で比較記事を設計します。','Claude',
'[{"key":"topic","label":"比較する商品・サービス","placeholder":"候補名またはカテゴリ","multiline":false},{"key":"audience","label":"想定読者","placeholder":"どんな人が迷っているか","multiline":false},{"key":"goal","label":"読者が決めたいこと","placeholder":"例：どちらが自分向きか","multiline":false},{"key":"notes","label":"確認済み情報・実体験","placeholder":"公式仕様、実際に使った場合のみ体験内容","multiline":true}]'::jsonb,
$prompt$比較・レビュー記事の構成を作成してください。

比較対象: {{topic}}
想定読者: {{audience}}
読者が決めたいこと: {{goal}}
確認済み情報・実体験: {{notes}}

比較軸、共通点、違い、向いている人、注意点、確認すべき公式情報、結論の出し方を整理してください。
入力されていない使用経験を作らず、価格・在庫・評価・キャンペーンは最新確認なしに断定しないでください。$prompt$,
'active',52
),
(
'affiliate-social-post','アフィリエイトSNS投稿','affiliate','SNSアフィリエイト',
'商品を過度に煽らず、対象者と判断材料が分かる投稿を作ります。','ChatGPT',
'[{"key":"topic","label":"紹介する商品・サービス","placeholder":"名称と確認済み特徴","multiline":false},{"key":"audience","label":"想定読者","placeholder":"誰に合うか","multiline":false},{"key":"goal","label":"投稿の目的","placeholder":"例：比較記事へ誘導、詳細確認","multiline":false},{"key":"notes","label":"確認済み情報・注意点","placeholder":"価格は確認日時も含めるなど","multiline":true}]'::jsonb,
$prompt$SNS向けの商品・サービス紹介投稿を作成してください。

商品・サービス: {{topic}}
想定読者: {{audience}}
目的: {{goal}}
確認済み情報・注意点: {{notes}}

悩み、対象者、特徴、判断材料、注意点、自然なCTAの順で3案作ってください。
実際に使っていない場合は使用感を作らず、成果保証、架空レビュー、未確認の価格・在庫・割引を断定しないでください。$prompt$,
'active',54
),
(
'marketplace-listing','フリマ・EC出品文','sales','物販',
'確認済みの商品状態と仕様から、誤解を生みにくい出品文を作ります。','ChatGPT',
'[{"key":"topic","label":"商品情報","placeholder":"商品名、型番、仕様など","multiline":false},{"key":"audience","label":"想定購入者","placeholder":"どんな用途の人向けか","multiline":false},{"key":"goal","label":"伝えたいポイント","placeholder":"特徴、付属品など","multiline":false},{"key":"notes","label":"状態・傷・付属品・注意点","placeholder":"実物確認した情報のみ","multiline":true}]'::jsonb,
$prompt$フリマアプリまたはEC向けの商品出品文を作成してください。

商品情報: {{topic}}
想定購入者: {{audience}}
伝えたいポイント: {{goal}}
状態・傷・付属品・注意点: {{notes}}

短いタイトル候補、説明文、状態説明、付属品、購入前の確認事項に分けてください。
入力されていない状態、型番、購入時期、使用回数、動作保証は作らないでください。$prompt$,
'active',62
),
(
'digital-product-sales-copy','デジタル商品紹介文','sales','テンプレート・教材販売',
'テンプレートや教材の内容を整理し、販売用の短い紹介文を作ります。','Claude',
'[{"key":"topic","label":"商品内容","placeholder":"テンプレート、PDF、教材など","multiline":false},{"key":"audience","label":"想定購入者","placeholder":"誰向けか","multiline":false},{"key":"goal","label":"購入者が得られる実用価値","placeholder":"何を楽にできるか","multiline":false},{"key":"notes","label":"含まれるもの・制約","placeholder":"ファイル形式、内容、サポート有無など","multiline":true}]'::jsonb,
$prompt$デジタル商品の紹介文を作成してください。

商品内容: {{topic}}
想定購入者: {{audience}}
実用価値: {{goal}}
含まれるもの・制約: {{notes}}

短いキャッチ、対象者、内容、使い方、含まれるもの、注意事項、CTAを作ってください。
入力されていない成果、利用者数、レビュー、サポート範囲を追加しないでください。$prompt$,
'active',64
),
(
'crowdwork-hearing','案件ヒアリング項目','crowdwork','受託副業',
'受注前に確認すべき要件を抜け漏れなく整理します。','ChatGPT',
'[{"key":"topic","label":"案件・作業内容","placeholder":"例：記事執筆、画像制作、SNS運用","multiline":false},{"key":"audience","label":"依頼者・利用者","placeholder":"案件の対象者","multiline":false},{"key":"goal","label":"納品物・完了条件","placeholder":"分かっている範囲で","multiline":false},{"key":"notes","label":"募集文・既知条件","placeholder":"納期、予算、形式など","multiline":true}]'::jsonb,
$prompt$受注前のヒアリング項目を整理してください。

案件・作業内容: {{topic}}
依頼者・利用者: {{audience}}
納品物・完了条件: {{goal}}
募集文・既知条件: {{notes}}

目的、対象、成果物、範囲、素材、納期、修正、納品形式、連絡方法、権利・公開可否など、確認が必要な質問を優先度付きで整理してください。
既に書かれている条件を重複質問しすぎないようにしてください。$prompt$,
'active',72
),
(
'crowdwork-delivery','納品メッセージ作成','crowdwork','受託副業',
'納品物・確認事項・修正方法が分かる簡潔なメッセージを作ります。','ChatGPT',
'[{"key":"topic","label":"納品するもの","placeholder":"ファイル・URL・作業内容","multiline":false},{"key":"audience","label":"依頼者","placeholder":"相手の呼び方や関係","multiline":false},{"key":"goal","label":"確認してほしいこと","placeholder":"例：内容確認、承認","multiline":false},{"key":"notes","label":"補足・修正条件","placeholder":"対応範囲、期限など事実のみ","multiline":true}]'::jsonb,
$prompt$クラウドソーシング案件の納品メッセージを作成してください。

納品するもの: {{topic}}
依頼者: {{audience}}
確認してほしいこと: {{goal}}
補足・修正条件: {{notes}}

挨拶、納品内容、確認方法、補足、修正について、締めの順で簡潔にしてください。
合意していない修正回数や保証を勝手に追加しないでください。$prompt$,
'active',74
),
(
'competitor-comparison','競合比較表の設計','research','市場調査',
'競合を感覚ではなく同じ軸で比較するための調査表を作ります。','Gemini',
'[{"key":"topic","label":"市場・競合候補","placeholder":"サービス名や市場","multiline":false},{"key":"audience","label":"対象顧客","placeholder":"誰向けの市場か","multiline":false},{"key":"goal","label":"比較して決めたいこと","placeholder":"差別化、価格帯、機能など","multiline":false},{"key":"notes","label":"既知情報・調査制約","placeholder":"公式URL、地域、期間など","multiline":true}]'::jsonb,
$prompt$競合比較の調査設計をしてください。

市場・競合候補: {{topic}}
対象顧客: {{audience}}
比較して決めたいこと: {{goal}}
既知情報・調査制約: {{notes}}

比較軸、一次情報の確認先、比較表の列、事実と推測の分け方、更新日を記録すべき項目、最後に判断する観点を整理してください。
最新価格や機能はWebで公式情報を確認する必要があると明示してください。$prompt$,
'active',82
),
(
'keyword-idea-research','キーワード・需要仮説整理','research','コンテンツ企画',
'検索語や悩みの候補を広げ、どれを調べるべきか優先順位を付けます。','Gemini',
'[{"key":"topic","label":"テーマ・ジャンル","placeholder":"例：AI副業、ゲーム配信","multiline":false},{"key":"audience","label":"想定ユーザー","placeholder":"誰の悩みか","multiline":false},{"key":"goal","label":"作りたいコンテンツ","placeholder":"記事、動画、SNSなど","multiline":false},{"key":"notes","label":"既知の候補・制約","placeholder":"既に考えている語など","multiline":true}]'::jsonb,
$prompt$コンテンツ企画のためのキーワード・需要仮説を整理してください。

テーマ: {{topic}}
想定ユーザー: {{audience}}
作りたいコンテンツ: {{goal}}
既知の候補・制約: {{notes}}

悩み語、比較語、方法語、初心者語、具体的なロングテール候補に分けて案を出し、検証優先度を付けてください。
検索数や競合難易度の数値は実データを確認していない限り作らず、「要ツール確認」としてください。$prompt$,
'active',84
),
(
'client-work-checklist','受託作業チェックリスト','efficiency','受託副業',
'依頼受領から納品までの作業を再利用できるチェックリストへ変えます。','ChatGPT',
'[{"key":"topic","label":"受託する作業","placeholder":"例：記事執筆、動画編集","multiline":false},{"key":"audience","label":"依頼者・利用者","placeholder":"誰向けの成果物か","multiline":false},{"key":"goal","label":"納品条件","placeholder":"何をもって完了か","multiline":false},{"key":"notes","label":"現在の手順・制約","placeholder":"納期、使用ツール、確認工程など","multiline":true}]'::jsonb,
$prompt$受託作業を再利用可能なチェックリストにしてください。

作業: {{topic}}
依頼者・利用者: {{audience}}
納品条件: {{goal}}
現在の手順・制約: {{notes}}

受注前、着手、制作、自己チェック、依頼者確認、修正、納品、保存の段階に分け、各段階の完了条件も付けてください。
入力されていない契約条件を作らないでください。$prompt$,
'active',92
),
(
'business-message-draft','仕事メッセージ・返信文','efficiency','業務効率化',
'要点から失礼のない短い連絡文を作ります。','ChatGPT',
'[{"key":"topic","label":"伝えたい要件","placeholder":"例：納期確認、日程変更、質問への回答","multiline":false},{"key":"audience","label":"相手・関係性","placeholder":"例：依頼者、取引先、初回連絡","multiline":false},{"key":"goal","label":"相手にしてほしいこと","placeholder":"例：確認、返信、承認","multiline":false},{"key":"notes","label":"事実・期限・条件","placeholder":"日時、案件名など正確な情報","multiline":true}]'::jsonb,
$prompt$仕事上のメッセージまたは返信文を作成してください。

要件: {{topic}}
相手・関係性: {{audience}}
相手にしてほしいこと: {{goal}}
事実・期限・条件: {{notes}}

結論を先にし、必要な背景、依頼または回答、締めの順で簡潔にしてください。
入力されていない約束、日付、条件、謝罪理由は作らないでください。$prompt$,
'active',94
)
on conflict(slug) do nothing;
