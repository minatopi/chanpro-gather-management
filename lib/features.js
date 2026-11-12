// Gather API(secure.js)の FEATURES と同じキー。app_settings の feature_<key> = false で停止、feature_<key>_message で表示メッセージ
export const FEATURES = [
  {
    "key": "post",
    "label": "投稿の作成",
    "group": "投稿・閲覧",
    "desc": "新しい投稿(画像・アンケート付きを含む)",
    "actions": [
      "post-create"
    ]
  },
  {
    "key": "image",
    "label": "画像アップロード",
    "group": "投稿・閲覧",
    "desc": "投稿・チャット・プロフィールの画像アップロード",
    "actions": [
      "image-upload",
      "image-register"
    ]
  },
  {
    "key": "read",
    "label": "読み込み(タイムライン・投稿閲覧)",
    "group": "投稿・閲覧",
    "desc": "投稿・返信・限定投稿などの読み込み。停止するとほぼ何も表示されません",
    "actions": [
      "db-read-batch",
      "post-read",
      "reply-list",
      "reply-prefetch",
      "limited-post-list",
      "post-view"
    ]
  },
  {
    "key": "delete",
    "label": "投稿・返信の削除",
    "group": "投稿・閲覧",
    "desc": "自分の投稿・返信の削除",
    "actions": [
      "post-delete",
      "reply-delete"
    ]
  },
  {
    "key": "pin",
    "label": "投稿の固定",
    "group": "投稿・閲覧",
    "desc": "投稿のピン留め",
    "actions": [
      "post-pin"
    ]
  },
  {
    "key": "reply",
    "label": "返信",
    "group": "交流",
    "desc": "返信の作成",
    "actions": [
      "reply-create"
    ]
  },
  {
    "key": "like",
    "label": "いいね",
    "group": "交流",
    "desc": "いいねの付与・取り消し",
    "actions": [
      "post-like-toggle"
    ]
  },
  {
    "key": "repost",
    "label": "リポスト",
    "group": "交流",
    "desc": "リポストの付与・取り消し",
    "actions": [
      "repost-toggle"
    ]
  },
  {
    "key": "bookmark",
    "label": "ブックマーク",
    "group": "交流",
    "desc": "ブックマークの追加・解除",
    "actions": [
      "bookmark-toggle"
    ]
  },
  {
    "key": "poll",
    "label": "アンケート",
    "group": "交流",
    "desc": "アンケートの作成(投稿時)と投票",
    "actions": [
      "poll-vote"
    ]
  },
  {
    "key": "follow",
    "label": "フォロー",
    "group": "交流",
    "desc": "フォロー・フォロー解除",
    "actions": [
      "follow-toggle"
    ]
  },
  {
    "key": "report",
    "label": "報告・通報",
    "group": "交流",
    "desc": "ユーザーからの報告・通報の送信",
    "actions": [
      "report",
      "report-create"
    ]
  },
  {
    "key": "dm_send",
    "label": "DM送信",
    "group": "メッセージ",
    "desc": "DMの送信",
    "actions": [
      "dm-send"
    ]
  },
  {
    "key": "dm_read",
    "label": "DM閲覧",
    "group": "メッセージ",
    "desc": "DM一覧・履歴の読み込み",
    "actions": [
      "dm-list",
      "dm-get"
    ]
  },
  {
    "key": "chat",
    "label": "チャット",
    "group": "メッセージ",
    "desc": "チャット履歴の保存・削除・ピン",
    "actions": [
      "chat-history-add",
      "chat-history-delete",
      "chat-pins-save"
    ]
  },
  {
    "key": "notification",
    "label": "通知",
    "group": "メッセージ",
    "desc": "通知の既読処理",
    "actions": [
      "notifications-read"
    ]
  },
  {
    "key": "developer_msg",
    "label": "開発者への連絡",
    "group": "メッセージ",
    "desc": "開発者への問い合わせ・開発者メッセージの既読",
    "actions": [
      "developer-inbox-send",
      "developer-message-read"
    ]
  },
  {
    "key": "points_send",
    "label": "ポイント送信",
    "group": "ポイント",
    "desc": "ユーザー間のポイント送信",
    "actions": [
      "transfer-points"
    ]
  },
  {
    "key": "stamp",
    "label": "スタンプ購入",
    "group": "ポイント",
    "desc": "スタンプの購入",
    "actions": [
      "stamp-purchase"
    ]
  },
  {
    "key": "bonus",
    "label": "ポイント獲得",
    "group": "ポイント",
    "desc": "ログインボーナス・週間ボーナス・チャットポイント",
    "actions": [
      "user-login-streak",
      "weekly-points",
      "chat-points"
    ]
  },
  {
    "key": "profile",
    "label": "プロフィール・設定の更新",
    "group": "アカウント",
    "desc": "プロフィール・アイコン・設定・ユーザー名・パスワードの変更",
    "actions": [
      "user-update",
      "user-settings"
    ]
  },
  {
    "key": "account_delete",
    "label": "アカウント削除",
    "group": "アカウント",
    "desc": "自分のアカウントの削除",
    "actions": [
      "account-delete"
    ]
  }
];
export const FEATURE_GROUPS = [...new Set(FEATURES.map((f) => f.group))];
