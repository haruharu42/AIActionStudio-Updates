# AI Action Studio（AAS）

AI Action Studio（AAS）の更新ファイル・バージョン管理用リポジトリ。

## Current product direction

2026-09-16より **PWA版を唯一の主製品（Primary Product）** として開発・販売準備・運用改善を進める。

- PWA版: 正式な開発・販売対象。新機能、UX、セキュリティ、管理画面、利用権、無料枠、公開検証を集中して進める。
- Windows版: 凍結資産。既存ソース・release・Updater資産は削除せず保管するが、新機能開発・通常保守・新規販売の対象から外す。
- 共通基盤: Supabase Auth / profiles / entitlements / RLS / articles / workspaces / private StorageはPWA基盤として継続利用する。
- 既存Windows entitlementの取り消しや破壊的移行は、この方針変更だけでは実施しない。

詳細:

- [PWA Primary / Windows Freeze Policy](docs/PWA_PRIMARY_WINDOWS_FREEZE_2026-09-16.md)
- [旧 PWA First Product Strategy](docs/PWA_FIRST_PRODUCT_STRATEGY_2026-09-12.md)

## Preview deployment

PWAの実機確認は、GitHub Actionsの **[🚀 Previewへデプロイ](https://github.com/haruharu42/AIArticleStudio-Updates/actions/workflows/pwa-preview-deploy.yml)** から手動実行する。

1. `Run workflow` を開き、確認対象のPRブランチを選ぶ。
2. `expected_sha` に確認対象HEADの40文字コミットSHAを入力する。
3. `confirmation` に `DEPLOY_PREVIEW` と入力する。
4. 実行後、Actions summaryに出るPreview URLでiPhone / Android実機確認を行う。

この操作はPreview専用。workflowはtypecheck / lint / build / regression / dependency audit / Wrangler dry-runを再実行し、`ai-article-studio-pwa-preview` へのPreview version uploadだけを許可する。Productionのworkers.dev routing、custom route、custom domainは変更しない。
