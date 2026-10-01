# AI Action Studio（AAS）

**AI Action Studio（AAS）** は、記事作成・画像計画・SNS運用・公開管理・Knowledge運用・通知・メンバーシップ管理などを、1つのPWAで扱うための制作／運用支援ツールです。

このリポジトリは、AAS PWA本体、Supabase構成、Cloudflare Workers公開設定、管理機能、回帰テスト、公開パイプライン、旧Windows版の凍結資産を管理しています。

> **現在の製品方針:** PWA版が唯一の主製品です。Windows版は復旧・参照用の凍結資産として保持します。

---

## 公開URL

| 用途 | URL / 状態 |
| --- | --- |
| 一般公開PWA | https://ai-article-studio-pwa.ai-article-studio.workers.dev/ |
| Production Canary | https://ai-article-studio-pwa-canary.ai-article-studio.workers.dev/ |
| Preview | GitHub Actionsからmain / PRのexact SHAをPreview Workerへ反映 |
| GitHub Actions | https://github.com/haruharu42/AIActionStudio-Updates/actions |

### 現在の一般公開版

2026-10-01時点のProduction:

- Version: **v0.1.10**
- Build: `bb3cb9a0f1eeb9371efd7ff5d1e4500f9ef8cfd3`
- Production Canary確認済み
- 一般公開済み
- Production公開はCanaryで確認した**同一artifact**を再ビルドせず昇格する方式
- `main` はProductionより先行する場合があり、mainへのmergeだけでは一般公開されません

---

# 搭載機能

## 1. アカウント / 認証 / 利用権

- Email / Passwordログイン
- Google OAuth
- Supabase Auth / PKCE
- 一般ユーザー / 管理者ロール
- PWA利用権管理
- 招待コード / 利用コード
- 利用期限・販売チャネル・外部参照の管理
- 管理者MFA / AAL2
- 一般ユーザーと管理者のアクセス分離
- ユーザー単位のデータ分離

管理系の重要操作はUI表示だけで保護せず、DB / RPC側でもactive admin・AAL2等を再確認します。

---

## 2. ホーム / ダッシュボード

ホームでは以下をまとめて確認できます。

- Creatorステータス / XP / レベル
- 今日のミッション
- ランキング
- メンバーシップ特典
- 最近の記事
- 記事ライブラリ
- note運営状況
- AIアプリ起動
- クイック記事設定
- リリース / Preview状態
- 管理者向けクイック操作

### ホームウィジェット

デスクトップ / モバイルごとに、

- 表示 / 非表示
- 並び順
- サイズ

を設定可能です。

---

## 3. 記事作成

現在の記事作成は**8ステップ**です。

1. 使用AI選択
2. 記事種類 / マガジン選択
3. 画像計画
4. 記事の基本条件
5. タイトル作成
6. 本文作成
7. プレビュー / 画像プロンプト
8. 装飾付きコピー / タグ / 記事ライブラリ保存

### 対応AI

- ChatGPT
- Claude
- Gemini

AAS側では、選択したAI・無料版 / 有料版・文章設定に応じてプロンプトを最適化します。

### 記事条件

- 掲載先: note / Tips / Brain / ブログ
- 無料記事 / 有料記事
- ジャンル / サブジャンル
- 対象年齢
- 性別
- 文字数目安
- 価格
- アフィリエイト設定
- タグ
- マガジン
- アイキャッチ
- 挿絵枚数
- 画像の画風

### タイトル

- AI用タイトルプロンプトを作成
- AIが返した**5候補**をまとめて貼り付け
- 5候補からワンタップ選択
- クリップボード貼り付け
- 外部AI起動前に途中状態を保存

### 本文

- AI用完成記事プロンプト
- 手動本文作成
- AI回答から本文だけを貼り付け
- 先頭の重複タイトルを自動除去
- 有料エリアマーカー
- 挿絵差し込みマーカー
- 外部AIへ移動しても作成途中のステップ / 入力内容を復元

### 掲載用コピー

完成記事は、

- タイトルを個別コピー
- 本文を**装飾付きコピー**
- 見出し
- 太字
- 引用
- リスト
- 挿絵位置
- 有料エリア位置

を保持しやすい形で、note / Tips / Brain / ブログへ移せます。

---

## 4. 記事ライブラリ

- 記事一覧
- 検索 / 絞り込み
- 再編集
- ステータス管理
- 掲載先管理
- マガジン管理
- 記事Workspace
- 画像計画
- 公開状態
- revision競合防止
- ユーザー別保存上限

### 本番の保存上限

2026-10-01時点でProduction発効済み:

| プラン | 記事保存上限 |
| --- | ---: |
| 無料 | 5件 |
| Creator Club | 15件 |
| Creator Club Plus | 30件 |
| Creator Club Pro | 無制限 |

設定値と発効操作は分離しており、ProductionでのON操作は管理者MFA / AAL2と事前readiness checkを要求します。

---

## 5. 画像作成支援

記事条件と完成本文から、

- アイキャッチ用プロンプト
- 挿絵用プロンプト
- 全画像をまとめた一括プロンプト
- 画像ごとの個別プロンプト
- 推奨ファイル名
- 挿入位置マーカー

を生成します。

画風はアニメ風、漫画風、イラスト風、図解、水彩、写真風などから選択できます。

> ChatGPTで画像生成する場合、AAS内の案内では通常チャットを使用し、一時チャットは使用しない運用です。

---

## 6. SNS / 公開 / 運営支援

### SNS投稿支援

記事から以下向けの投稿用プロンプトを作成します。

- X
- Instagram
- Threads

### 公開管理

記事を、

- 完成
- 公開待ち
- 公開済み
- 公開予定日時
- 公開URL

として管理できます。

### note運営

- note向け運営画面
- 記事 / マガジン運用
- 月間計画
- 投稿スケジュール支援
- メンバーシップ運用支援
- 公開前チェック

外部サービスへの完全自動投稿は、OAuth / 正式API接続が完了した機能だけを対象とし、未接続サービスでは手動公開を前提にします。

---

## 7. Creator機能

- Creator XP
- レベル
- 連続利用
- ミッション
- ランキング
- プロフィール
- Creator Club
- Creator Club Plus
- Creator Club Pro
- プラン別機能
- プラン別記事保存上限

---

## 8. 無料利用枠

Productionの現在設定（管理画面から変更可能）:

| 項目 | 1日上限 |
| --- | ---: |
| 総利用回数 | 5回 |
| 記事生成 | 3回 |
| タイトル生成 | 5回 |
| リライト | 3回 |
| SNS生成 | 5回 |
| 画像生成 | 1回 |
| AI補助 | 5回 |

- リセット: **Asia/Tokyo 00:00**
- 永続無料の日次利用モード対応
- 残り利用回数をホーム上部に表示
- 詳細表示は折りたたみ可能
- 利用回数変更はイベントで即時反映

---

## 9. 通知センター / Web Push

通知対象:

- AASアップデート
- 機能公開
- メンテナンス
- Knowledge更新
- 管理者からのお知らせ
- システム通知

機能:

- AAS内通知
- 未読件数
- 一括既読
- Web Push
- PWA Badge
- 端末別Push購読
- 通知カテゴリ別ON / OFF
- 管理者から全体 / tester / admin宛て通知

iOS / iPadOSではホーム画面へ追加したWebアプリでWeb Pushを利用します。

---

## 10. Knowledge / Prompt運用

AASにはKnowledge / Promptの管理基盤があります。

- Fresh / Stableチャンネル
- 公式 / 一次ソース監視
- ソース変更検知
- ETag / Last-Modified / Content Hash
- Review Candidate
- 新規 / 更新 / 再確認 / 廃止候補
- Knowledge差分確認
- Prompt optimization
- 管理者レビュー
- 公開前Quality Gate
- Fresh → Stable昇格

### 自動化の境界

Knowledgeは**自動収集しても自動公開しません**。

基本フロー:

```text
公式ソース監視
  ↓
変更候補
  ↓
自動 / AI分析
  ↓
管理者レビュー
  ↓
差分確認
  ↓
承認
  ↓
Fresh / Stableへ公開
```

AI出力は未信頼ドラフトとして扱い、最終公開は管理者確認を必須にしています。

### Gemini Freeエージェント

管理者向けKnowledge補助として、Gemini Free tierを使う検証導線があります。

- 公開情報だけを送信対象に限定
- 内部Knowledge / 記事本文 / 秘密情報を送らない
- 日次利用上限
- 個人情報・token疑いを事前検知
- 有料モデルへの自動フォールバックなし
- 自動公開なし

---

## 11. 副業支援

AAS内に副業系ツール / ウィザードを搭載しています。

- AI副業プランナー
- 副業ロードマップ
- コンテンツ販売
- アフィリエイト
- SNS運用
- デジタル商品
- 動画 / 配信系
- 記事制作支援
- 各種Knowledge連携

スコアや候補表示はAAS内の比較ロジックであり、収益保証や成功確率を示すものではありません。

---

## 12. 販売 / 利用プラン

搭載済み:

- 利用プラン表示
- Billing基盤
- 外部販売導線
- 利用コード
- 利用権
- 特定商取引法表示
- 問い合わせ導線
- 販売ready状態チェック
- 管理者側販売設定

### 現在の販売状態

2026-10-01時点では、一般公開PWAは利用可能ですが、**新規有料販売は停止状態**です。

Stripe LIVEや新規販売開始は、販売readiness・法務・決済確認を通した別工程として扱います。

---

# 管理者機能

`/admin` 配下では以下を管理します。

- ユーザー管理
- PWA利用権
- 招待 / 利用コード
- 無料利用枠
- メンバーシップ
- プラン別機能
- 記事保存上限
- 全機能管理センター
- Feature rollout
- メンテナンスモード
- Knowledge
- Prompt
- 通知
- 販売
- Promotion
- Infrastructure usage
- Security
- MFA
- Release
- Production Canary
- Public release
- 問い合わせ

---

# 全機能管理センター

コードの配布と機能の公開範囲を分離しています。

ユーザー向け機能は原則として、

1. 管理者のみ
2. 指定テスター
3. 全一般ユーザー

の3段階で公開できます。

さらに機能単位でメンテナンスモードを設定できます。

これにより、アプリ全体を停止せず、問題のある機能だけを停止して管理者 / testerで確認後に再公開できます。

---

# リリース仕様

AASのProduction公開は、通常のmain pushとは分離されています。

```text
feature branch
  ↓
Pull Request
  ↓
PWA Phase 9-17 CI
  ↓
Production Preflight
  ↓
main merge
  ↓
Preview
  ↓
Release Candidate
  ↓
Production Canary
  ↓
指定テスター確認
  ↓
Canary確認済み
  ↓
全一般ユーザーへ公開
```

## Production Canary

Canaryでは以下を確認します。

- exact SHA
- exact Preview build
- Cloudflare認証
- Wrangler dry-run
- Production相当Canary
- 指定テスター
- 実機
- rollback経路
- 重大障害の有無

## Public昇格

一般公開では、Canaryで確認したartifactを再ビルドせず、そのままProduction Workerへ昇格します。

これにより、

> 「Canaryで確認したもの」と「本番で公開したもの」が別buildになる

ことを防止します。

---

# 主要ルート

| Route | 用途 |
| --- | --- |
| `/` | ホーム / 記事ライブラリ |
| `/create` | 記事作成 |
| `/images` | 画像作成支援 |
| `/sns` | SNS投稿支援 |
| `/workflow` | 運営ワークフロー |
| `/note-operations` | note運営 |
| `/publish` | 公開管理 |
| `/analytics` | 内部コンテンツ分析 |
| `/prompts` | Promptライブラリ |
| `/notifications` | 通知 |
| `/missions` | ミッション |
| `/ranking` | ランキング |
| `/membership` | メンバーシップ |
| `/sidejob` | 副業支援 |
| `/side-hustle-roadmaps` | 副業ロードマップ |
| `/plans` | 利用プラン |
| `/support` | 問い合わせ案内 |
| `/manual` | 使い方 |
| `/faq` | FAQ |
| `/admin` | 管理ダッシュボード |

---

# 技術構成

## Frontend / PWA

- React 19
- Next.js 16
- TypeScript 5.9
- Vite 8
- Vinext
- Cloudflare Vite Plugin
- Wrangler
- Service Worker / PWA
- Node.js 22+

## Backend

- Supabase Auth
- PostgreSQL
- Row Level Security
- FORCE RLS
- SECURITY DEFINER RPC
- Private Storage
- Supabase Vault
- Edge Functions
- Scheduled jobs / pg_net

## Infrastructure

- Cloudflare Workers
- GitHub Actions
- Preview Worker
- Production Canary Worker
- Production Worker

---

# セキュリティ原則

- service role keyをブラウザへ配布しない
- API secretをGitHubへ保存しない
- 秘密情報はSupabase Vault / GitHub Secrets等の適切な秘密管理へ置く
- 一般ユーザーは自分のデータだけへアクセス
- RLS / FORCE RLSを維持
- 管理操作はDB / RPC側で権限を再確認
- 重要なProduction操作はAAL2必須
- Knowledge / AI出力をそのまま自動公開しない
- Production Canaryを経由して一般公開
- Production DB migrationは履歴を保持し、既存migrationを破壊的に書き換えない

---

# Windows版について

Windows版は削除せず、凍結資産として保持しています。

- `src/ai_article_studio/**`
- `release/**`
- 既存Updater
- 既存Windows entitlement

新機能開発・通常保守・新規販売はPWA版を基準にします。

詳細:

- [PWA Primary / Windows Freeze Policy](docs/PWA_PRIMARY_WINDOWS_FREEZE_2026-09-16.md)

---

# 開発 / 検証

PWA:

```bash
cd pwa
npm ci
npm run typecheck
npm run lint
npm run build
npm test
```

Production前はさらに、

- dependency audit
- Wrangler dry-run
- release regression
- Preview smoke test
- Supabase migration / RLS確認
- Production Canary

を通します。

---

# Preview deployment

Preview workflow: [🚀 Previewへデプロイ](https://github.com/haruharu42/AIActionStudio-Updates/actions/workflows/pwa-preview-deploy.yml)

通常の確認はmain merge後のPreview自動反映、または専用GitHub Actionsを使用します。

手動Previewを行う場合:

1. GitHub ActionsのPreview workflowを開く
2. 対象branchを選ぶ
3. exact SHAを入力
4. Preview専用確認文字列を入力
5. Preview URLで実機確認

Preview操作ではProduction Workerの一般公開routingを変更しません。

---

# 関連ドキュメント

- [PWA Primary / Windows Freeze Policy](docs/PWA_PRIMARY_WINDOWS_FREEZE_2026-09-16.md)
- [Feature Control Center](docs/feature-control-center.md)
- [Notification Center / Web Push](docs/notification-center-web-push.md)
- [Knowledge / Prompt Auto Update](docs/knowledge-prompt-auto-update.md)
- [Knowledge Web Automation](docs/knowledge-web-automation.md)
- [Production Rollout](docs/pwa-production-rollout.md)
- [Commerce Implementation Status](docs/commerce-implementation-status.md)
- [Article Workflow Validation](docs/phase1-article-workflow-validation-20260928.md)
- [Release GitHub Readiness](docs/release-github-readiness-20261001.md)

---

## 運用上の注意

READMEは主要仕様の概要です。詳細なDB契約、RLS、Release Gate、Knowledge運用、販売条件、migration履歴は各docs / migration / testを正とします。

機能追加・仕様変更時は、コードだけでなくREADMEと関連ドキュメントも更新してください。
