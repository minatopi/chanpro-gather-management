// Axiomのログ種別(Gather API / 管理サイトが送る type)ごとのグループ
export const TYPES = {
  login: ["login_success", "login_failed", "login_blocked", "register_created", "register_failed", "register_blocked"],
  access: ["access", "db_read_batch"],
  adminlogin: ["admin_login_success", "admin_login_failed", "admin_login_locked", "admin_logout"],
  adminops: ["admin_user_update", "admin_setting_changed", "admin_ip_ban", "admin_ip_unban", "admin_user_ban", "admin_user_unban", "admin_post", "admin_post_delete", "admin_ai_query", "admin_ai_action"],
  activity: ["post_created", "post_deleted", "reply_created", "reply_deleted", "like_toggled", "repost_toggled", "bookmark_toggled", "poll_voted", "follow_toggled", "dm_sent", "report_submitted", "points_transferred", "stamp_purchased", "chat_points", "user_updated", "account_deleted", "image_upload", "admin_api_action"],
  error: ["api_error"],
  status: ["feature_status"],
  ip: ["ip_banned_request", "device_banned_request", "ip_rate_limited", "server_blocked", "admin_ip_ban", "admin_ip_unban", "admin_user_ban", "admin_user_unban"],
  admin: { prefix: "admin_" }, // 管理サイトのログイン・操作(admin_ で始まるすべて)
};

export const isIpLike = (t) => /^(\d{1,3}\.){3}\d{1,3}$/.test(t) || (t.includes(":") && /^[0-9a-f:.]+$/i.test(t));

export function aplFor({ kind, hours = 24, username = "", ip = "", take = 300 }) {
  const k = TYPES[kind] ? kind : "login";
  const T = TYPES[k];
  const ds = (process.env.AXIOM_DATASET || "chanpro").replace(/[^\w-]/g, "");
  const cond = T.prefix ? `type startswith ${JSON.stringify(T.prefix)}` : `type in (${T.map((t) => JSON.stringify(t)).join(", ")})`;
  let apl = `['${ds}'] | where _time > ago(${Math.max(1, Math.min(24 * 30, Number(hours) || 24))}h) | where ${cond}`;
  if (username) apl += ` | where username == ${JSON.stringify(String(username).slice(0, 100))}`;
  if (ip && /^[0-9a-fA-F:.%]{2,100}$/.test(ip)) apl += ` | where ip == ${JSON.stringify(ip)}`;
  return apl + ` | sort by _time desc | take ${Math.max(1, Math.min(300, take))}`;
}
