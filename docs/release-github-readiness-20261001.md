# GitHub公開連携：読み取り診断と安全な配布ゲート

更新：2026-10-01 JST。既存のCloudflare Worker名・公開URL・Auth設定は変更しない。

## 目的と制限

リポジトリ改名後、Supabase Edge Function `pwa-release-deploy` 内の **AAS_GITHUB_RELEASE_TOKEN** が新リポジトリ `haruharu42/AIActionStudio-Updates` と公開ワークフロー `pwa-admin-public-release.yml` を読めるか、**実際の公開workflow_dispatchを発行せずに**管理者画面から確認する。

新しい `github_readiness` アクションは以下の順序で実行する。

1. 現行の `admin_list_app_release_deployments` RPCを呼び、**元のユーザーJWTを使って管理者認可**する。失敗時はGitHubにアクセスしない。
2. サーバー側のトークン設定有無を確認する。トークン文字列やGitHubレスポンス本文は返さない。
3. 設定があればGitHub RESTのリポジトリと既存公開ワークフローに対して **GETのみ** 行い、読取成否の真偽値を返す。
4. **Actions:write / workflow_dispatchが実行可能かは判断できない。** `dispatchPermissionTested: false` を必ず返す。公開操作やデータベース書込は行わない。

既存Workerがこのアクションを実装していない期間は、status応答に `supportsGithubReadiness` がないため管理画面の診断ボタンは**非表示**となる。コードのmain統合だけではSupabase Workerの稼働バージョンは変わらない。

## 管理者確認手順

1. PRのCI・Production Preflightとmain Previewを確認する。
2. **本番とは分離された認証付き検証用Supabase** を確保し、検証用リポジトリ権限を持つ適切なトークンを**Supabase Secretへ直接**登録する。チャット／GitHubソース／CIログには貼らない。
3. 対応Workerを検証環境**だけ**に配布し、検証管理者でログインしたPreviewのアップデート管理で「GitHub公開連携を安全に確認」を押す。
4. 新リポジトリとワークフローの読取結果、一般ユーザーでの認可拒否、トークン値がUI・ログに出ないことを確認する。
5. **GET成功はdispatch権限の証明ではない**。公開配布の実動作は別の明示承認・公開前チェック・ロールバック手順が必要。本番 `pwa-release-deploy` の更新も独立して承認する。

## 2026-10-01 現況スナップショット（再取得必須）

- 2026-10-01 05:20 JST前後の再確認でも、本番 `pwa-release-deploy` は **v4**、旧リポジトリ `haruharu42/AIArticleStudio-Updates` 参照のまま。GitHub main側は新リポジトリ対応済みだが、本番Workerは未更新。
- 旧Cloudflare公開URL・OAuth設定・ユーザーデータを改名作業に便乗して変更しない。
- GitHub main HEADは `2c374420b3ccd133e25ed0aadc8dd79712902e45`、Previewは `BUILD 2C37442` まで追従確認済み。一般公開PWAと本番Supabase Workerへの昇格は別ゲート。
- Gemini検証環境・本番DB移行・AI自動解析は別課題。未検証でONにしない。
