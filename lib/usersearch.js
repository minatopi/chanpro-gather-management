import { db } from "./db";
import { axiomQuery } from "./axiom";
import { similarity } from "./similar";
import { isIpLike } from "./logkinds";

const FIELDS = "id,username,role,verified,ban_until,ban_count,points,icon_url";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
export const normIp = (ip) => { let v = String(ip || "").trim().toLowerCase(); if (v.startsWith("::ffff:")) v = v.slice(7); return v; };

export const SEARCH_MODES = [["auto", "自動判定"], ["name", "ユーザー名"], ["similar", "似た名前"], ["ip", "IP"], ["device", "端末"], ["id", "ID"]];

// 入力から検索の種類を推測
export function detectMode(q) {
  const t = String(q || "").trim();
  if (UUID.test(t)) return "id";
  if (isIpLike(t) || /^(\d{1,3}\.){1,3}\*?$/.test(t)) return "ip";
  if (/^(device:)?[a-f0-9]{16,128}$/i.test(t)) return "device";
  return "name";
}

async function fetchUsers(ids) {
  const out = [];
  for (const part of chunk([...new Set(ids)], 80)) { const { data } = await db().from("users").select(FIELDS).in("id", part); out.push(...(data || [])); }
  return out;
}
const sortName = (a, b) => a.username.localeCompare(b.username);

/* ---- ID ---- */
export async function usersById(q) {
  const { data } = await db().from("users").select(FIELDS).eq("id", String(q).trim().toLowerCase()).limit(1);
  return (data || []).map((u) => ({ ...u, matched: ["id"] }));
}

/* ---- ユーザー名(部分一致。完全一致→前方一致→部分一致の順) ---- */
export async function usersByName(q) {
  const t = String(q).trim().replace(/[%,()]/g, "");
  const { data, error } = await db().from("users").select(FIELDS).ilike("username", `%${t}%`).limit(80);
  if (error) throw error;
  const low = t.toLowerCase(); const rank = (u) => { const n = u.username.toLowerCase(); return n === low ? 0 : n.startsWith(low) ? 1 : 2; };
  return (data || []).map((u) => ({ ...u, matched: [rank(u) === 0 ? "exact" : "partial"] })).sort((a, b) => rank(a) - rank(b) || sortName(a, b));
}

/* ---- 似た名前(表記ゆれ・似た文字・ひらがな/カタカナ・全角半角を吸収) ---- */
async function allUsernames() {
  const rows = [];
  for (let i = 0; i < 6000; i += 1000) { const { data, error } = await db().from("users").select("id,username").range(i, i + 999); if (error) throw error; rows.push(...(data || [])); if (!data || data.length < 1000) break; }
  return rows;
}
export async function usersSimilar(q) {
  const t = String(q).trim();
  const scored = (await allUsernames()).map((u) => ({ id: u.id, score: similarity(t, u.username) })).filter((x) => x.score >= 0.5).sort((a, b) => b.score - a.score).slice(0, 50);
  const users = await fetchUsers(scored.map((x) => x.id)); const byId = new Map(users.map((u) => [u.id, u]));
  return scored.map((x) => ({ ...byId.get(x.id), score: x.score, matched: ["similar"] })).filter((u) => u.username);
}

/* ---- 端末(端末ハッシュの全体または先頭8文字以上) ---- */
export async function usersByDevice(raw) {
  const h = String(raw || "").trim().toLowerCase().replace(/^device:/, "");
  if (!/^[a-f0-9]{8,128}$/.test(h)) return [];
  const { data, error } = await db().from("user_devices").select("user_id,device_hash,last_login_at").ilike("device_hash", h + "%").limit(300);
  if (error) throw error;
  const last = new Map(); for (const r of data || []) { const cur = last.get(r.user_id); if (!cur || new Date(r.last_login_at) > new Date(cur.last)) last.set(r.user_id, { last: r.last_login_at, hash: r.device_hash }); }
  const users = await fetchUsers([...last.keys()]);
  return users.map((u) => ({ ...u, matched: ["device"], device_last: last.get(u.id)?.last, device_hash: last.get(u.id)?.hash })).sort((a, b) => new Date(b.device_last || 0) - new Date(a.device_last || 0));
}

/* ---- IP(完全一致 / 「203.0.113.」「203.0.113.*」のような前方一致) ---- */
export async function usersByIp(rawIp) {
  const raw = String(rawIp || "").trim(); const prefix = /[.*]$/.test(raw) && !/^(\d{1,3}\.){3}\d{1,3}$/.test(raw);
  const ip = normIp(raw.replace(/\*$/, ""));
  if (!/^[0-9a-f:.%]{2,100}$/.test(ip)) return [];
  const sb = db(); const map = new Map();
  const add = (u, via) => { const e = map.get(u.id) || { ...u, matched: [] }; if (!e.matched.includes(via)) e.matched.push(via); map.set(u.id, e); };
  const queries = prefix ? [sb.from("users").select(FIELDS).ilike("last_login_ip", ip + "%").limit(80)] : [sb.from("users").select(FIELDS).eq("last_login_ip", ip).limit(60), sb.from("users").select(FIELDS).contains("ip_list", [{ ip }]).limit(60)];
  const res = await Promise.all(queries);
  for (const r of res) if (r.error) throw new Error(/does not exist/.test(r.error.message) ? r.error.message + "(Supabaseで sql/setup.sql を実行してください)" : r.error.message);
  (res[0].data || []).forEach((u) => add(u, "last")); (res[1]?.data || []).forEach((u) => add(u, "list"));
  try {
    const ds = (process.env.AXIOM_DATASET || "chanpro").replace(/[^\w-]/g, "");
    const cond = prefix ? `ip startswith ${JSON.stringify(ip)}` : `ip == ${JSON.stringify(ip)}`;
    const rows = await axiomQuery(`['${ds}'] | where _time > ago(30d) | where ${cond} | where isnotempty(username) | summarize n=count() by username | take 60`);
    const names = [...new Set(rows.map((r) => r.username).filter(Boolean))];
    for (const part of chunk(names, 60)) { const { data } = await sb.from("users").select(FIELDS).in("username", part); (data || []).forEach((u) => add(u, "log")); }
  } catch { /* Axiom未設定でもDBの結果は返す */ }
  return [...map.values()].sort(sortName);
}

export async function searchUsers({ q, mode = "auto" }) {
  const m = mode === "auto" ? detectMode(q) : mode;
  const users = m === "id" ? await usersById(q) : m === "ip" ? await usersByIp(q) : m === "device" ? await usersByDevice(q) : m === "similar" ? await usersSimilar(q) : await usersByName(q);
  return { users, mode: m };
}
