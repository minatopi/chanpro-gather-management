// すべてのログ種別(Axiomの type)を、分類と日本語の文章に変換する
export const CATEGORIES = {
  auth: { label: "認証", tone: "blue" },
  read: { label: "読み込み", tone: "gray" },
  change: { label: "変更", tone: "green" },
  account: { label: "アカウント", tone: "orange" },
  admin: { label: "管理操作", tone: "violet" },
  security: { label: "セキュリティ", tone: "red" },
  error: { label: "エラー", tone: "red" },
  status: { label: "ステータス", tone: "amber" },
  other: { label: "その他", tone: "gray" },
};

export const READ_ACTIONS = ["post-read", "reply-list", "reply-prefetch", "limited-post-list", "dm-list", "dm-get", "post-view", "db-read-batch", "check-ip"];
export const ACTION_JA = {
  "post-create": "投稿の作成", "post-read": "投稿の閲覧", "post-delete": "投稿の削除", "post-view": "閲覧数の加算", "post-pin": "投稿の固定", "limited-post-list": "限定投稿の読み込み",
  "reply-create": "返信の作成", "reply-list": "返信一覧の読み込み", "reply-prefetch": "返信の先読み", "reply-delete": "返信の削除",
  "post-like-toggle": "いいねの切り替え", "repost-toggle": "リポストの切り替え", "bookmark-toggle": "ブックマークの切り替え", "poll-vote": "アンケート投票", "follow-toggle": "フォローの切り替え",
  "notifications-read": "通知の既読化", "report-create": "通報", "report": "報告", "report-resolve": "通報の解決(管理)",
  "dm-list": "DM一覧の読み込み", "dm-get": "DMの取得", "dm-send": "DM送信", "chat-history-add": "チャット履歴の保存", "chat-history-delete": "チャット履歴の削除", "chat-pins-save": "チャットのピン保存",
  "user-update": "プロフィール・アカウント情報の更新", "user-settings": "設定の保存", "account-delete": "アカウント削除",
  "stamp-purchase": "スタンプ購入", "transfer-points": "ポイント送信", "chat-points": "チャットポイント", "user-login-streak": "ログインボーナス", "weekly-points": "週間ボーナス",
  "image-upload": "画像アップロード", "image-register": "画像の登録", "developer-inbox-send": "開発者への連絡", "developer-message-read": "開発者メッセージの既読",
  "db-read-batch": "データの読み込み", "check-ip": "IPチェック", ban: "BAN(管理)", "admin-user-update": "ユーザー更新(管理)", "ip-ban": "IP BAN(管理)", "ip-unban": "IP BAN解除(管理)",
};
const FIELD_JA = { icon_url: "アイコン", cover_url: "カバー画像", profile: "プロフィール文", program_urls: "プログラムURL", profile_music: "プロフィール音楽", settings: "設定", username: "ユーザー名", password: "パスワード" };
export const REASON_JA = { user_not_found: "ユーザー名が存在しない", wrong_password: "パスワードが違う", account_banned: "アカウントがBAN中", device_banned: "端末がBAN中", ip_banned: "IPがBAN中", rate_limited: "アクセス集中による制限", login_disabled: "ログイン停止中", admin_login_disabled: "管理者ログイン停止中", register_disabled: "新規作成停止中", banned_device_account: "BANされたアカウントの端末", device_limit: "端末のアカウント作成上限", username_taken: "ユーザー名が使用済み", invalid_input: "入力内容が不正", feature_disabled: "機能が停止中", error: "その他のエラー" };
const SETTING_JA = { login_enabled: "ログイン", register_enabled: "新規アカウント作成", admin_login_enabled: "管理者ログイン", server_enabled: "サーバー全体" };
const OP_JA = { ban: "ユーザーBAN", "admin-user-update": "ユーザー情報の更新", "ip-ban": "IP BAN", "ip-unban": "IP BAN解除" };
const ROLE_JA = { user: "一般", admin: "管理者", developer: "開発者" };

const tablesOf = (r) => { let x = r.reads; if (typeof x === "string") { try { x = JSON.parse(x); } catch { x = null; } } return Array.isArray(x) ? [...new Set(x.map((i) => i?.table).filter(Boolean))].join("・") : ""; };
const fieldsJa = (f) => String(f || "").split(",").filter(Boolean).map((k) => FIELD_JA[k] || k).join("・");
const kb = (n) => (Number(n) >= 1024 ? `${(Number(n) / 1024).toFixed(1)}KB` : `${Number(n) || 0}B`);

export function describeLog(r) {
  const who = r.username ? `「${r.username}」` : "未ログインのユーザー";
  const t = r.type; const out = (cat, text, extra = {}) => ({ cat, text, ...extra });
  switch (t) {
    // ---- 認証 ----
    case "login_success": return out("auth", `${who}がログインしました`);
    case "login_failed": return out("auth", `「${r.username || "?"}」のログインに失敗しました`, { reason: REASON_JA[r.reason] || r.reason, tone: "red" });
    case "login_blocked": return out("auth", `「${r.username || "?"}」のログインを拒否しました`, { reason: REASON_JA[r.reason] || "ログイン停止中", tone: "amber" });
    case "register_created": return out("account", `${who}が新規アカウントを作成しました`);
    case "register_failed": return out("auth", `新規アカウントの作成に失敗しました(「${r.username || "?"}」)`, { reason: REASON_JA[r.reason] || r.reason, tone: "red" });
    case "register_blocked": return out("auth", `新規アカウントの作成を拒否しました(「${r.username || "?"}」)`, { reason: "新規作成停止中", tone: "amber" });
    // ---- 読み込み ----
    case "db_read_batch": return out("read", `${who}がデータを読み込みました`, { detail: `${r.request_count ?? ""}件${tablesOf(r) ? ` / ${tablesOf(r)}` : ""}` });
    case "access": { const a = ACTION_JA[r.action] || r.action || "操作"; const read = READ_ACTIONS.includes(r.action); return out(read ? "read" : "change", `${who}が「${a}」を${read ? "読み込みました" : "実行しました"}`, { detail: r.page ? `ページ: ${r.page}` : "" }); }
    // ---- 変更(ユーザーの操作) ----
    case "post_created": return out("change", `${who}が投稿を作成しました`, { detail: [`${r.length ?? 0}文字`, r.has_image && "画像あり", r.has_poll && "アンケート付き", r.has_quote && "引用", r.is_limited && "限定投稿", r.bonus > 0 && `ボーナス+${r.bonus}pt`].filter(Boolean).join(" / ") });
    case "post_deleted": return out("change", `${who}が投稿を削除しました`, { detail: r.post_id && `投稿ID ${r.post_id}` });
    case "reply_created": return out("change", `${who}が返信しました`, { detail: `${r.length ?? 0}文字 / 投稿ID ${r.post_id}` });
    case "reply_deleted": return out("change", `${who}が返信を削除しました`);
    case "like_toggled": return out("change", `${who}が投稿に${r.liked ? "いいねしました" : "付けたいいねを取り消しました"}`, { detail: r.post_id && `投稿ID ${r.post_id}` });
    case "repost_toggled": return out("change", `${who}が${r.reposted ? "リポストしました" : "リポストを取り消しました"}`);
    case "bookmark_toggled": return out("change", `${who}が${r.bookmarked ? "ブックマークしました" : "ブックマークを解除しました"}`);
    case "poll_voted": return out("change", `${who}がアンケートに投票しました`, { detail: `選択肢 ${Number(r.option) + 1}` });
    case "follow_toggled": return out("change", `${who}が${r.following ? "ユーザーをフォローしました" : "フォローを解除しました"}`);
    case "dm_sent": return out("change", `${who}がDMを送信しました`, { detail: `${r.length ?? 0}文字` });
    case "report_submitted": return out("change", `${who}が${r.kind === "user" ? "ユーザーを通報しました" : "運営へ報告しました"}`);
    case "points_transferred": return out("change", `ポイントが送信されました(${r.amount}pt)`, { detail: `送信者ID ${r.from_user_id} → 受信者ID ${r.to_user_id}` });
    case "stamp_purchased": return out("change", `${who}がスタンプを購入しました`, { detail: `購入後 ${r.points_after}pt` });
    case "chat_points": return out("change", `${who}のチャットポイントが${Number(r.amount) >= 0 ? "加算" : "減算"}されました(${r.amount}pt)`);
    case "user_updated": return out("account", `${who}がアカウント情報を更新しました`, { detail: [fieldsJa(r.fields), r.new_username && `新ユーザー名「${r.new_username}」`].filter(Boolean).join(" / ") });
    case "image_upload": return out("change", `${who}が画像をアップロードしました`, { detail: `${r.kind === "chat" ? "チャット" : r.kind === "music" ? "音楽" : "投稿"} / ${kb(r.size_bytes)}` });
    case "account_deleted": return r.by_admin
      ? out("account", `管理者${who}がアカウント「${r.target_username || r.target_id}」を削除しました`, { tone: "red", detail: r.target_role ? `権限: ${ROLE_JA[r.target_role] || r.target_role}` : "" })
      : out("account", `${who}がアカウントを削除しました`, { tone: "red", detail: [r.role && `権限: ${ROLE_JA[r.role] || r.role}`, r.points != null && `残りポイント ${r.points}pt`, r.verified && "公式バッジあり"].filter(Boolean).join(" / ") });
    // ---- セキュリティ ----
    case "ip_banned_request": return out("security", "BAN中のIPからのアクセスを拒否しました", { reason: r.reason, tone: "red" });
    case "device_banned_request": return out("security", "BAN中の端末からのアクセスを拒否しました", { reason: r.reason, tone: "red" });
    case "ip_rate_limited": return out("security", "アクセスが集中したIPを一時的に制限しました", { tone: "amber" });
    case "server_blocked": return out("security", "サーバー全体停止中のため、アクセスを拒否しました", { tone: "red" });
    case "feature_blocked": return out("security", `機能「${r.feature_label || r.feature}」が停止中のため、${who}の操作を拒否しました`, { tone: "amber", detail: ACTION_JA[r.action] || r.action });
    // ---- エラー ----
    case "api_error": return out("error", `${who}の「${ACTION_JA[r.action] || r.action || "操作"}」でエラーが発生しました`, { reason: r.message, tone: "red", detail: `HTTP ${r.status}` });
    // ---- ステータス ----
    case "feature_status": return out("status", `機能「${r.feature}」を「${r.status}」として記録しました`, { detail: r.message, tone: { 停止: "red", 復旧: "green", 不具合: "amber", 調査中: "blue", メンテナンス: "violet" }[r.status] });
    // ---- 管理サイト ----
    case "admin_login_success": return out("admin", "管理サイトにログインしました", { tone: "green" });
    case "admin_login_failed": return out("security", "管理サイトのログインに失敗しました", { tone: "red" });
    case "admin_login_locked": return out("security", "管理サイトのログインをロックしました", { tone: "amber", reason: r.reason });
    case "admin_logout": return out("admin", "管理サイトからログアウトしました");
    case "admin_setting_changed": return out("admin", `停止設定「${SETTING_JA[r.key] || r.key}」を変更しました`, { detail: typeof r.value === "boolean" ? (r.value ? "→ 再開" : "→ 停止") : `→ ${r.value}` });
    case "admin_user_update": return out("admin", `ユーザー「${r.username || r.target_user_id}」の情報を更新しました`, { detail: typeof r.patch === "object" ? JSON.stringify(r.patch) : r.patch });
    case "admin_user_ban": return out("admin", `ユーザー「${r.username}」をBANしました`, { tone: "red", detail: [r.accounts && `アカウント: ${[].concat(r.accounts).join("・")}`, r.device_count != null && `端末${r.device_count}件`, r.reason].filter(Boolean).join(" / ") });
    case "admin_user_unban": return out("admin", `ユーザー「${r.username}」のBANを解除しました`);
    case "admin_ip_ban": return out("admin", `IP ${r.ip || ""} をBANしました`, { tone: "red", detail: r.minutes != null ? `${r.minutes}分` : "" });
    case "admin_ip_unban": return out("admin", "IPのBANを解除しました");
    case "admin_post": return out("admin", `管理者が「${r.username || ""}」として投稿しました`);
    case "admin_post_delete": return out("admin", "管理者が投稿を削除しました");
    case "admin_ai_query": return out("admin", "AIアシスタントに質問しました", { detail: r.question });
    case "admin_ai_action": return out("admin", `AIが提案した操作「${r.op}」を${r.approved ? (r.ok ? "許可して実行しました" : "許可しましたが失敗しました") : "拒否しました"}`, { tone: r.approved ? "violet" : "gray", detail: r.result });
    case "admin_api_action": return out("admin", `管理者がAPI経由で「${OP_JA[r.op] || r.op}」を行いました`, { detail: [r.role && `権限→${ROLE_JA[r.role] || r.role}`, typeof r.verified === "boolean" && `公式バッジ→${r.verified ? "付与" : "解除"}`, r.ip, r.minutes != null && `${r.minutes}分`].filter(Boolean).join(" / ") });
    default: return out("other", `${t}`, { detail: r.message });
  }
}

export function metaOf(r) {
  const place = [r.country, r.region, r.city].filter(Boolean).join(" ");
  return [r.ip && `IP ${r.ip}`, place, r.ms != null && `${r.ms}ms`, r.status != null && r.type === "access" && `HTTP ${r.status}`].filter(Boolean);
}
