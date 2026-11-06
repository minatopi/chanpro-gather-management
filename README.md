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
| `ADMIN_POST_USER_IDS` | 任意 | 管理サイトから投稿できるアカウントのID(カンマ区切り)。未設定なら `04dd75ae-dd2e-4fe4-ade1-fc19a2f65b06` のみ。ここに無いIDでは投稿できません |
| `STATUS_FEED_KEY` | 任意 | 機能ステータス閲覧用API(`/api/status-feed`)のキー。`status-viewer.html` から使う場合に設定(ランダムな長い文字列) |
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

## PostHog連携(ユーザー詳細パネル)

PostHogのPerson(distinct_id)がSupabaseのユーザーIDと同じ前提で、次を表示します(期間は7/30/90日)。
Personのプロパティ、イベント数・セッション数・最終アクセス、アクセス元IP(国・市区町村つき)、使用ブラウザ/OS/デバイス、よく見たページ、最近のアクセス履歴、PostHogで開くリンク。
IPはフロントのイベントに加え、Gather APIが送るセキュリティイベント(`user_id` 付き。ログイン時のIP)からも集めます。
Personが出ない場合は、フロントのログイン後に `posthog.identify(user.id, { username })` が呼ばれているか確認してください。

## アクセスマップ(PostHog GeoIP)

「アクセスマップ」画面で、PostHogのイベントに付くGeoIP(IPからの推定位置)を地図にします。
- **日本(都道府県)**: 都道府県ごとのアクセス数を色の濃さで表示。赤い丸が推定位置(大きいほど多い)。丸や県をクリックすると、その地域のユーザー一覧に絞り込み
- **世界**: 国ごとの色分けと赤い丸
- ユーザー別に「どのユーザーがどの県・市区町村か」を一覧表示(ユーザー名をクリックでユーザー詳細へ)。ログイン時のサーバー側イベント(`user_id` 付き)も加えて集計します
- 位置は市区町村レベルのおおよその場所で、実際の居場所とは限りません(VPN・携帯回線などでずれます)
- 地図の背景は jsDelivr から読み込みます(`world-atlas` / `dataofjapan/land`)。読み込めない場合も、赤い丸とランキングは表示されます
- 必要なもの: PostHogのGeoIPが有効なこと(既定で有効)、フロントで `posthog.identify(user.id)` を呼んでいること

## ユーザー名BAN × PostHog Person

BAN管理の「ユーザー名でBAN」で、IPの取得元を **PostHogのPerson / Axiom / 両方** から選べます(既定は両方)。
PostHogはPerson(= SupabaseのユーザーID)のイベントからIPを集め、国・市区町村・最終アクセスも表示します。プレビューで内容を確認してから実行してください。

## 機能ステータス(Axiomに「停止しました/復旧しました」を残す)

「機能ステータス」画面で、機能(いいね・投稿・DM など、自由入力も可)と状態(停止 / 復旧 / 不具合 / 調査中 / メンテナンス)、メッセージを選んで記録すると、Axiomに `type = "feature_status"` のログが残ります。
- ダッシュボードと同画面に、機能ごとの最新状態と履歴を表示します
- 「アクセスログ」の「機能ステータス」からも読めます
- 停止設定でログイン・新規作成を停止/再開すると、自動で `feature_status`(停止/復旧)も記録されます
- ※記録するだけで、機能そのものを止める/戻すことはしません
- Gather API側から自動で残したい場合は、API内で次のように呼べます:
  `await axiomLog("feature_status", ip, { feature: "いいね", status: "停止", message: "原因" });`
- Axiomのトークンには Ingest 権限が必要です。記録が検索できるまで数秒かかることがあります

## 機能ステータス閲覧HTML(status-viewer.html)

別ファイルの `status-viewer.html` をブラウザで開き、次のどちらかを入力すると、機能ステータスのログを表示します。
- **管理サイトAPI**(推奨): URL に `https://(管理サイト)/api/status-feed`、キーに環境変数 `STATUS_FEED_KEY` の値
- **Axiom直接**: Axiomのトークン(Query権限)とデータセット名。ブラウザからAxiomに直接つなぐため、CORSで拒否される場合があります(その場合は管理サイトAPIを使用)

## 投稿(管理アカウントとして)

「投稿」画面から、許可したアカウント(既定 `04dd75ae-dd2e-4fe4-ade1-fc19a2f65b06`)として投稿できます。
- 内容・画像URL・限定投稿(認証済みアカウントのみ有効)・フォロワー通知を指定。投稿前に確認ダイアログが出ます
- 最近の投稿の一覧と、削除ができます(許可アカウントの投稿のみ)
- 操作はAxiomに `admin_post` / `admin_post_delete` として記録されます
- 任意のアカウントになりすませないよう、投稿可能なIDは `ADMIN_POST_USER_IDS` の許可リストに限定しています

## スマホ対応

画面幅640px以下で、ナビは上部の横スクロール、モーダルは下からのシート、詳細パネルは全幅、表は不要な列を隠して横スクロールになります。入力欄は16pxでiOSの自動ズームを防ぎます。地図は、拡大前は1本指でページをスクロール、2本指ピンチまたは＋/－ボタンで拡大し、拡大後は1本指で移動できます。

## ログ表示について(新しいAPI対応)

「アクセスログ」の「アクセス」に、Gather APIの `db_read_batch`(DB読み込み)も表示します。読み込み件数と、読んだテーブル(クエリのキーつき)を1行にまとめ、未ログインの読み込みは「未ログイン」と表示します。ユーザー名やIPでも絞り込めます。

## 管理ログ(管理サイト自身のログ)

サイドバーの「管理ログ」で管理サイトのログを確認します。
- **ログイン履歴**: 成功・失敗・ロック・ログアウトを、IP・場所・ブラウザ/OSつきで表示。直近24時間の失敗数・ロック数・最後の成功を集計し、失敗/ロックの行からそのIPを24時間BANできます(自分のIPは「あなた」と表示され、BANできません)
- **操作履歴**: ユーザー変更・設定変更・BAN/解除・投稿/削除などの管理操作
- 管理サイトのログインは5回失敗すると、そのIPを15分ロックします。ロックは `banned_ip_addresses` に `adminlock:` つきで保存され、複数のサーバーインスタンスでも有効です。Gather本体には影響しません(BAN管理の「管理ロック」で確認・解除できます)
- Gather側でIP BANされているIPからは、管理サイトにもログインできません

## 補足

- 端末BANはAPIの**ログイン・新規作成時**に判定します(admin / developer は対象外)
- ユーザー名BANのIPは、Axiomに記録されたログインとアクセスのIPから取得します(取得できなければ警告し、アカウント・端末のみBAN)
- Axiom には平文IPが保存されます。保持期間は短めに設定してください
- 既存SQL関数(`guard_ip_request` / `register_account_limited`)と `reports` テーブルは、これまで通り存在する前提です
