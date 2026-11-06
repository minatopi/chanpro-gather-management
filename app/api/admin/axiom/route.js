import { NextResponse } from "next/server";
import { guard } from "@/lib/api";
import { axiomQuery } from "@/lib/axiom";

// kind: login / access / activity / error / ip / status / admin
const TYPES = {
  login: ["login_success", "login_failed", "register_created", "login_blocked", "register_blocked"],
  access: ["access", "db_read_batch"],
  adminlogin: ["admin_login_success", "admin_login_failed", "admin_login_locked", "admin_logout"],
  adminops: ["admin_user_update", "admin_setting_changed", "admin_ip_ban", "admin_ip_unban", "admin_user_ban", "admin_user_unban", "admin_post", "admin_post_delete"],
  activity: ["post_created", "post_deleted", "reply_created", "reply_deleted", "like_toggled", "repost_toggled", "bookmark_toggled", "poll_voted", "follow_toggled", "dm_sent", "report_submitted", "points_transferred", "stamp_purchased", "chat_points", "user_updated", "account_deleted", "admin_api_action"],
  error: ["api_error"],
  status: ["feature_status"],
  ip: ["ip_banned_request", "device_banned_request", "ip_rate_limited", "admin_ip_ban", "admin_ip_unban", "admin_user_ban", "admin_user_unban"],
  admin: { prefix: "admin_" }, // 管理サイトのログイン・操作の履歴(admin_ で始まるすべて)
};

export const GET = guard(async (req) => {
  const sp = new URL(req.url).searchParams;
  const kind = TYPES[sp.get("kind")] ? sp.get("kind") : "login";
  const hours = Math.max(1, Math.min(24 * 30, parseInt(sp.get("hours"), 10) || 24));
  const username = (sp.get("username") || "").trim().slice(0, 100);
  const ds = (process.env.AXIOM_DATASET || "chanpro").replace(/[^\w-]/g, "");
  const T = TYPES[kind];
  const cond = T.prefix ? `type startswith ${JSON.stringify(T.prefix)}` : `type in (${T.map((t) => JSON.stringify(t)).join(", ")})`;
  let apl = `['${ds}'] | where _time > ago(${hours}h) | where ${cond}`;
  if (username) apl += ` | where username == ${JSON.stringify(username)}`;
  apl += " | sort by _time desc | take 300";
  return NextResponse.json({ rows: await axiomQuery(apl) });
});
