# AAS 通知センター / Web Push

## 目的

AAS内通知と、スマホ・PCのOS通知を同じ通知基盤で管理します。

対象:
- AASアップデート
- 機能公開段階の変更
- メンテナンス開始 / 終了
- Knowledge / Prompt更新の反映
- 管理者からの手動お知らせ
- システム通知

## UI

ホーム等のAAS共通ヘッダー右上にベルを表示します。
ベルはミッションアイコンの左側です。

未読がある場合:
- ベルに未読件数
- 対応ブラウザではPWAアイコンへBadge

/notifications で一覧を確認・既読化できます。

## 設定

設定 → 通知

個別設定:
- AAS内通知 ON/OFF
- スマホ・PC端末通知 ON/OFF
- アップデート
- メンテナンス
- Knowledge更新
- 管理者からのお知らせ

通知許可はブラウザ/OS側の許可も必要です。

## Web Push

標準Web Pushを使用します。

- Push API
- Notifications API
- Service Worker
- VAPID

VAPID公開鍵はDBから認証済みユーザーへ返します。
VAPID秘密鍵はSupabase Vaultに保存し、GitHub・ブラウザへ出しません。

秘密鍵名: aas_notification_vapid_private_key
Push Worker認証トークン: aas_notification_push_worker_token
Edge Function: notification-push-worker

Workerはカスタムtoken認証を行うため verify_jwt=false です。

## 配信

通知作成時に、PushをONにしている対象ユーザーの購読だけをdelivery queueへ登録します。
通常はnotification insert triggerからPush Workerを即時起動します。
取りこぼし回復用として5分ごとのCronもあります。
期限切れPush endpointが404/410を返した場合、その購読を無効化します。

## 自動通知

### AASリリース
app_releases.status が published へ遷移した時に全体通知。

### 機能公開 / メンテナンス
app_feature_controls の rollout stage / maintenance mode変更時に自動通知。

公開範囲:
- admin → 管理者のみ
- tester → 管理者 + 指定一般ユーザーテスター
- public → 全一般ユーザー

### Knowledge
knowledge_refresh_requests.status が completed へ遷移した時に全体通知。

## 管理者通知

/admin/notifications

管理者は以下へ任意通知を送信できます。
- 全ユーザー
- 指定一般ユーザーテスター
- 管理者のみ

通知種類・タイトル・本文・AAS内移動先を指定できます。

## iPhone / iPad

iOS / iPadOSではホーム画面へ追加したWebアプリでWeb Pushを使用します。
通知許可は「設定 → 通知」のボタン操作から要求します。

## PC

Push API対応ブラウザでは、PWAインストールの有無とは別にWeb Pushを利用できる場合があります。
ブラウザ・OS双方で通知が許可されている必要があります。

## セキュリティ

通知本文へ以下を含めない運用です。
- パスワード
- Cookie
- Authorization
- Access / Refresh Token
- Supabase / Stripe / OpenAI secret
- APIキー
- 記事本文全文
- AIプロンプト全文

通知テーブルはRLS + FORCE RLSで直接ブラウザアクセスを禁止し、RPCからのみ利用します。

## 最終Preview検証

通知センター・Web Push・自動通知トリガーを含めてPreview CIで回帰確認します。

Service Worker通知対応に伴うcache generation v6を含めて再検証します。


## 段階公開

通知機能そのものも全機能管理センターの対象です。初期状態は管理者のみで、指定一般ユーザーテスター、全一般ユーザーの順に公開します。未許可ユーザーはベル・通知設定が非表示になり、通知RPC / Push購読もDB側で拒否されます。

最終検証では通知機能の段階公開RPCガードも含めて確認します。
