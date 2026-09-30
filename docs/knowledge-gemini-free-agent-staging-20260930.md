# 管理者専用 Knowledge Gemini Free エージェント（段階的導入）

## 目的
既存の公式ソース自動監視と管理者レビューを維持し、公開ソース由来の**新規Knowledge提案・再確認理由**をGeminiの無料枠で作成する。記事本文の自動生成、コードの自律修正、セキュリティ監査の自動適用やFresh/Stable自動公開は本フェーズの対象外。

## 無料と費用の境界
- **既存の無料・定型判定**：recheck/retireと本文不足/制限による要再確認はGoogleへの送信なし。
- **任意のGemini Free**：公式資料でFree tierを確認できた `gemini-3.5-flash-lite` のみ。AAS独自上限は1実行3件、**全Worker合計でUTC日次10回**。上限超過は未処理候補として次回へ持ち越し。有料モデルへの代替、429時の連続再試行、検索Groundingは行わない。
- **無課金を保証しない**：Googleの無料枠はプロジェクト単位・モデル単位で異なり変更される。キーが課金設定のあるプロジェクトに属する場合、AASの件数制限だけでは利用料金を防げない。管理者が課金未設定プロジェクト・現在の無料対象をGoogle AI Studioで確認する。管理者がチェックを入れない限りUIからONにできない。
- Free tierで送信された情報はGoogleの製品改善に使われ得る。送信対象は**公開URL（クエリ除去）・タイトル・公開本文抜粋2500文字・HTTP状態・カテゴリ・変更検知理由**のみ。個人情報、記事、元の研究プロンプト、既存非公開Knowledge、内部キー、管理者メモは送らない。公開サイト由来でも個人情報が含まれる場合は、そのソースを対象にしない。
- **自動送信の追加プライバシーゲート**：HTTP 200で一定長の公開抜粋が取得できても、送信予定データにメールアドレス・認証トークンなどの疑いがあればGeminiへのリクエスト前に無料の定型 `recheck` とし、日次API枠も消費しない。検出は保守的なパターン照合であり万能ではない。公開サイトでも個人情報を含むソースは監視対象・送信対象から外し、人が個別確認する。
- 更新(update)は既存内部文面を送信して比較しないため、Gemini提案の結論を常に `recheck` とし管理者へ回す。新規(new)のみ一次ソース抜粋が十分なら未検証提案JSONを作れる。ソースアクセス403/抜粋不足は外部AIへ送らず無料定型判定。

## 移行前から利用できる手動方式（Gemini Web）
管理者向け候補一覧および5件バッチでは「Gemini用公開情報をコピー」→「Gemini Webを開く」を利用できる。通常の研究プロンプトには内部の現行情報が含まれる可能性があるため、**Gemini無料版に貼り付けるのは専用の公開情報プロンプトのみ**とする。コピー後、管理者が個人情報等の混入を目視確認してから貼り付ける。無料のGemini Web側にもログイン・利用制限がある。コピー・起動だけではAASの候補状態・Knowledge・監視状態は変更されない。

## 重要：現時点はステージングコードのみ
PRとPreviewが成功しても、既存の稼働中Supabase Edge Functionが新しいコードに切り替わることはない。**実サービスのAI設定はOFFのまま**。マイグレーションとEdge配布は別承認・別検証。

1. 専用の検証環境でSQL `20260930125200_knowledge_gemini_free_agent_v1.sql` を適用。既存OpenAI鍵は別Vaultに保管して残る。新Geminiキー名は `aas_knowledge_gemini_api_key`。
2. 検証環境の管理者RPCと日次上限制御をテスト：`admin_get_knowledge_gemini_free_agent_status` は管理者のみ、`reserve_knowledge_gemini_free_call` はservice_roleのみ。匿名ユーザー・通常ユーザーは拒否。
3. 対応する `knowledge-research-worker` を**検証環境だけ**に配布し、公式のテスト対象のみで解析を確認。個人情報、秘密情報、アクセス制限されたページを送らない。
4. Google AI Studioで課金未設定のFree利用プロジェクトを作り、管理者がGeminiキーを設定。キーをGitHub Actionsログやブラウザの直接APIに渡さない。
5. Previewの管理者画面で、Gemini切替→無料・データ送信同意→最大1〜3件→明示的にON。1日10回の到達後は未処理候補を保留すること、候補承認・Fresh/Stable公開が独立していることを確認。
6. 現行main Previewが新機能に対応した後も、実機/認証後のE2Eとセキュリティ監査を終えるまでProductionへ適用しない。

## 2026-10-01 検証スナップショット

以下は main `2c374420b3ccd133e25ed0aadc8dd79712902e45` までで確認済み。Productionへ適用済みという意味ではない。

- disposable PostgreSQLで管理者/一般ユーザー権限、UTC日次上限、30並列要求の原子性を確認し、**30件中10件許可・20件拒否・最終カウント10** を確認済み。
- `supabase/postgres:17.6.1.173` の実Vault拡張で、偽Geminiキーの暗号化保存・復号・ローテーション、service_role限定quotaを確認済み。
- PR #233でGitHub Actions内の**フルローカルSupabase**を起動し、実GoTrue/Auth JWTで通常ユーザー拒否・管理者許可・Gemini 1実行3件への上限クランプ・非許可モデル拒否・Vault秘密値非露出・quota RPCのブラウザ拒否を確認。CI成功後mainへ統合済み。
- Previewは `BUILD 2C37442` まで反映済み。
- Google公式の2026-10-01時点情報で `gemini-3.5-flash-lite` の存在、Free Tierの無料入出力、`v1beta/models/...:generateContent` と `x-goog-api-key` のREST方式を再確認済み。
- 本番Supabaseは `ACTIVE_HEALTHY`。Gemini migration `20260930125200_knowledge_gemini_free_agent_v1.sql` は**未適用**、本番 `knowledge-research-worker` はv11、AI設定はOpenAI / `gpt-5.6` / OFFのまま。
- したがって次の本番ゲートは、対応migration・Worker・実Geminiキーを**別承認で**段階的に投入し、OFFのまま認証済み管理者E2Eを再確認してからONを判断する。

## 2026-10-01 Managed Staging Supabase 検証

本番とは別のFreeプロジェクト `AI Action Studio Staging` を東京リージョン（`ap-northeast-1`）に作成した。Project refは `swwbfrhvsvouiwobodwh`。本番 `nwttfmjsgzpjqqubxbff` のデータはコピーしていない。

- Staging PostgreSQL: 17.11系、状態 `ACTIVE_HEALTHY`。
- 初期2本の古いMigration artifactが現行GitHubに存在しないため、本番の現行定義を読み取り、Gemini検証に必要な最小の `profiles` / `private.is_active_admin()` / `knowledge_automation_settings` だけをStagingへ構造再現した。これは本番全体のクローンではない。
- `20260930125200_knowledge_gemini_free_agent_v1.sql` をStagingへ適用成功。
- 適用直後は `ai_enrichment_enabled=false`、provider=`openai`、model=`gpt-5.6`、Gemini日次使用0、`aas_knowledge_gemini_api_key` 未設定。Geminiは自動で有効化されていない。
- `admin_get_knowledge_gemini_free_agent_status` と `admin_set_knowledge_automation_ai_config` はauthenticatedから呼び出し可能だが、関数本体でactive adminを要求する。
- `reserve_knowledge_gemini_free_call()` はauthenticatedにEXECUTE権限がなく、service_roleのみ実行可能であることをStagingで確認。
- Security Advisorの追加指摘はRPC専用設定テーブルの「RLS enabled / policyなし」INFOと、意図した管理RPCのSECURITY DEFINER WARN。Performance Advisorは新規環境ゆえの未使用インデックスINFOのみ。
- 実Geminiキー、Workerトークン、Production秘密情報はStagingへコピーしていない。
- Knowledge automationの最小依存（空のCatalog 2テーブル、Source/Run/Candidate 3テーブル、Catalog Snapshot / Worker AI Config RPC）を構造のみ再現。全件数0を確認。
- `knowledge-research-worker` をStagingへv1として配布し `ACTIVE` を確認。カスタムWorkerトークンは作成しておらず、設定DB側も `enabled=false` / `ai_enrichment_enabled=false` の二重ロック。実行はまだ行わない。


### Managed Staging 実DBガード検証（2026-10-01）

Staging実DB上で外部Gemini APIを呼ばず、一時データをサブトランザクション内だけに作成して自動ロールバックする方式で追加確認した。

- active adminなしでは `admin_get_knowledge_gemini_free_agent_status` / `admin_set_knowledge_automation_ai_config` が `42501 active admin required` で拒否されることを確認。
- 一時的なactive admin相当のJWT claimsで、Gemini Free status取得、許可モデル `gemini-3.5-flash-lite` の選択、1実行上限を99指定しても3へクランプされることを確認。
- 非許可モデルは `22023` で拒否。
- 偽キー `AAS_STAGING_FAKE_GEMINI_KEY_DO_NOT_USE` をVaultへ保存し、暗号化保存後の復号一致を確認。テスト終了後はロールバックしVaultに残っていないことを確認。
- Managed Staging上で日次予約を12回実行し、10回許可・2回拒否。UTC日付を前日にした状態からの次回予約でcount=1へリセットされることも確認。
- テスト終了後は `profiles=0`、Gemini secret=0、Worker token=0、AI OFF / OpenAI / `gpt-5.6` / daily count 0へ戻っている。

## 監査・エラー方針
公開情報のハッシュ差分は変更の**兆候**であり規則の改訂を保証しない。AIによる根拠URLも未確認。HTTP403の制限を迂回しない。外部APIエラーは本文や秘密キーを記録せずHTTP番号だけを記録する。429時はその実行の残りGemini解析を停止する。日次上限に達した場合は候補を保留する。データベースの上限RPCが欠落していれば外部APIを呼ばず失敗閉鎖する。

## 公式参照（運用時に再確認）
- [Gemini 3.5 Flash-Liteモデル](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite)
- [料金と無料枠](https://ai.google.dev/gemini-api/docs/pricing)
- [プロジェクト別のレート制限](https://ai.google.dev/gemini-api/docs/rate-limits)
- [REST generateContent](https://ai.google.dev/api/generate-content)
- [Supabase Vault](https://supabase.com/docs/guides/database/vault)
