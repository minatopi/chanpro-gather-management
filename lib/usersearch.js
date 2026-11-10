import { db } from "./db";
import { axiomQuery } from "./axiom";

const FIELDS = "id,username,role,verified,ban_until,ban_count,points,icon_url";
export const normIp = (ip) => { let v = String(ip || "").trim().toLowerCase(); if (v.startsWith("::ffff:")) v = v.slice(7); return v; };

// そのIPを使ったことのあるユーザー: users.last_login_ip / users.ip_list(DB) + Axiomのログ(過去30日)
export async function usersByIp(rawIp) {
  const ip = normIp(rawIp);
  if (!/^[0-9a-f:.%]{2,100}$/.test(ip)) return [];
  const sb = db();
  const [a, b] = await Promise.all([
    sb.from("users").select(FIELDS).eq("last_login_ip", ip).limit(60),
    sb.from("users").select(FIELDS).contains("ip_list", [{ ip }]).limit(60),
  ]);
  for (const r of [a, b]) if (r.error) throw new Error(/does not exist/.test(r.error.message) ? r.error.message + "(Supabaseで sql/setup.sql を実行してください)" : r.error.message);
  const map = new Map();
  const add = (u, via) => { const e = map.get(u.id) || { ...u, matched: [] }; if (!e.matched.includes(via)) e.matched.push(via); map.set(u.id, e); };
  (a.data || []).forEach((u) => add(u, "last"));
  (b.data || []).forEach((u) => add(u, "list"));
  try {
    const ds = (process.env.AXIOM_DATASET || "chanpro").replace(/[^\w-]/g, "");
    const rows = await axiomQuery(`['${ds}'] | where _time > ago(30d) | where ip == ${JSON.stringify(ip)} | where isnotempty(username) | summarize n=count() by username | take 40`);
    const names = [...new Set(rows.map((r) => r.username).filter(Boolean))];
    if (names.length) {
      const { data } = await sb.from("users").select(FIELDS).in("username", names);
      (data || []).forEach((u) => add(u, "log"));
    }
  } catch { /* Axiom未設定でもDBの結果は返す */ }
  return [...map.values()].sort((x, y) => x.username.localeCompare(y.username));
}
