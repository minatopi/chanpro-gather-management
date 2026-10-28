# Chanpro 管理サイト(admin-site)

Next.js(App Router)製。Vercelに【新しいプロジェクト】としてデプロイします。
(Gather本体のAPI用 `vercel.json`(CORS `*`)はここに置かないでください)

## セットアップ(4ステップ)

1. **SQL**: Supabase の SQL Editor で `sql/setup.sql` を全部実行
   (`app_settings` / `gather_reports` / `banned_ip_addresses` と不足列を作成。既にあるものは変わりません)
2. **Gather API を更新**: 同梱ではなく別ファイルの `secure.js` で `api/secure.js` を上書きして再デプロイ
   (端末BAN・ログイン停止・新規作成停止・Axiomログに対応済み)
3. **管理サイトをデプロイ**: このフォルダをVercelに追加し、下の環境変数を設定
4. `https://(管理サイトのURL)/login` を開き、`ADMIN_PASSWORD` でログイン

## 環境変数(管理サイト)

| 変数 | 必須 | 説明 |
|---|---|---|
| `ADMIN_PASSWORD` | ✅ | ログインパスワード。20文字以上のランダム文字列を推奨 |
| `ADMIN_SESSION_SECRET` | 任意 | ログインCookieの署名鍵。未設定なら `ADMIN_PASSWORD` を使用。別の値にしておくと、鍵を変えて全管理セッションを無効化できます |
| `SUPABASE_URL` | ✅ | Gather本体と同じ Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Gather本体と同じ service_role キー(サーバー専用。公開禁止) |
| `IP_HASH_SECRET` | ✅ | **Gather APIと同じ値**。違うとIP BANが効きません。API側が未設定で `SUPABASE_SERVICE_ROLE_KEY` を使っている場合も、同じ状態にしてください |
| `AXIOM_TOKEN` | ✅ | Axiom のAPIトークン。対象データセットの **Query(read)** と **Ingest** の両方の権限が必要 |
| `AXIOM_DATASET` | 任意 | データセット名(既定 `chanpro`)。Gather APIと同じにする |
| `POSTHOG_PERSONAL_API_KEY` | 任意 | PostHog の Personal API key(Query read権限)。送信用の `phc_...` とは別物。ユーザー別アクセス先の表示に使用 |
| `POSTHOG_PROJECT_ID` | 任意 | PostHog のプロジェクトID(URLの `/project/12345` の数字) |
| `POSTHOG_APP_HOST` | 任意 | 既定 `https://us.posthog.com`。EUなら `https://eu.posthog.com`(取り込み用 `us.i.posthog.com` ではありません) |

## Gather API 側(既存プロジェクト)に必要な環境変数

| 変数 | 説明 |
|---|---|
| `AXIOM_TOKEN` | Ingest権限のトークン(管理サイトと同じものでも可) |
| `AXIOM_DATASET` | 管理サイトと同じデータセット名 |
| `IP_HASH_SECRET` | 管理サイトと同じ値 |

## 画面

- **ダッシュボード**: ユーザー数・BAN中・有効なBAN・未対応の報告、ログイン/新規作成の状態、直近24時間のAxiom集計
- **ユーザー**: 検索/絞り込み → 行をクリックで詳細パネル(ロール変更、公式バッジ、アカウントBAN〔1時間〜無期限〕、PostHogのアクセス履歴)
- **BAN管理**: ユーザー名でBAN(プレビュー→実行、IP・端末・同じ端末のアカウントを芋づる式)、IP直接BAN、BAN一覧と解除。端末BANもIP BANと同じ `banned_ip_addresses` で管理
- **報告・通報**: `gather_reports`(ユーザーからの報告)と、既存の `reports`(ユーザー・投稿の通報)
- **アクセスログ**: Axiomのログイン/アクセス/IP・端末制限を、期間・ユーザー名で絞り込み(自動更新あり)
- **停止設定**: ログイン停止/新規作成停止(スイッチ+表示メッセージ)。停止中も admin / developer はログイン可能

## 補足

- 端末BANはAPIの**ログイン・新規作成時**に判定します(admin / developer は対象外)
- ユーザー名BANのIPは、Axiomに記録されたログインとアクセスのIPから取得します(取得できなければ警告し、アカウント・端末のみBAN)
- Axiom には平文IPが保存されます。保持期間は短めに設定してください
- 既存SQL関数(`guard_ip_request` / `register_account_limited`)と `reports` テーブルは、これまで通り存在する前提です
