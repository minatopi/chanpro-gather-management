import crypto from "node:crypto";
import { db, hashIp, validIp } from "./db";
import { axiomQuery, axiomIngest, axiomIngestStrict } from "./axiom";
import { aplFor, TYPES } from "./logkinds";
import { loadStatus, STATUSES } from "./status";
import { planUserBan, executeUserBan, unbanUser } from "./userban";
import { applySetting, BOOL, TEXT, FEATURE } from "./settings";
import { usersByIp } from "./usersearch";
import { isIpLike } from "./logkinds";

const ds = () => (process.env.AXIOM_DATASET || "chanpro").replace(/[^\w-]/g, "");
const clip = (v, n = 160) => (typeof v === "string" ? v.slice(0, n) : v);
const slim = (rows, max = 40) => rows.slice(0, max).map((r) => Object.fromEntries(Object.entries(r).filter(([k, v]) => !["_rowId", "_sysTime", "source", "ip_hash", "ua"].includes(k) && v != null && v !== "").map(([k, v]) => [k, typeof v === "object" ? clip(JSON.stringify(v), 200) : clip(v)])));
const UF = "id,username,role,verified,ban_until,ban_count,points";
const S = (props, required = []) => ({ type: "object", properties: props, required, additionalProperties: false });
const str = (d) => ({ type: "string", description: d }), int = (d) => ({ type: "integer", description: d }), bool = (d) => ({ type: "boolean", description: d });

export const TOOLS = [
  // ---------- 読み取り(自動実行) ----------
  { name: "get_overview", write: false, description: "全体の概要(ユーザー数・BAN中・有効なBAN数・未対応の報告・停止設定・機能ステータス)を取得する", parameters: S({}) },
  { name: "get_settings", write: false, description: "停止設定(ログイン/新規作成/管理者ログイン/サーバー全体)の現在値を取得する", parameters: S({}) },
  { name: "log_summary", write: false, description: "直近N時間のAxiomログの集計(種別ごとの件数、ログイン失敗の理由、エラー、アクセスの多いIP、失敗の多いIP)", parameters: S({ hours: int("1〜168") }, ["hours"]) },
  { name: "query_logs", write: false, description: "Axiomのログを検索して新しい順に返す(最大40件)。kind: " + Object.keys(TYPES).join(" / "), parameters: S({ kind: { type: "string", enum: Object.keys(TYPES) }, hours: int("1〜720"), username: str("ユーザー名で絞り込み(任意)"), ip: str("IPで絞り込み(任意)"), limit: int("件数(最大40)") }, ["kind", "hours"]) },
  { name: "search_users", write: false, description: "ユーザー名の部分一致、またはIPアドレス(そのIPを使ったことのあるユーザー)で検索する", parameters: S({ query: str("ユーザー名またはIP") }, ["query"]) },
  { name: "get_user", write: false, description: "ユーザーの詳細(権限・BAN・ポイント・使ったIP一覧・同じIPを使う他のユーザー・端末数)", parameters: S({ username: str("ユーザー名(完全一致)") }, ["username"]) },
  { name: "list_bans", write: false, description: "有効なIP/端末BANの一覧(最大40件)", parameters: S({}) },
  { name: "get_reports", write: false, description: "ユーザーからの報告(gather)と通報(user)の一覧", parameters: S({ status: { type: "string", enum: ["open", "resolved"] } }, ["status"]) },
  // ---------- 書き込み(ユーザーの許可が必要) ----------
  { name: "set_setting", write: true, description: "停止設定を変更する。BOOL: " + BOOL.join(", ") + "(false=停止) / TEXT(表示メッセージ): " + TEXT.join(", "), parameters: S({ key: { type: "string", enum: [...BOOL, ...TEXT] }, value: { description: "BOOLは true/false、TEXTは文字列", anyOf: [{ type: "boolean" }, { type: "string" }] } }, ["key", "value"]) },
  { name: "ban_user", write: true, description: "ユーザー名でBANする(アカウント+過去のIP+端末、同じ端末のアカウントも芋づる式)", parameters: S({ username: str("ユーザー名"), minutes: int("0=無期限"), reason: str("理由"), with_ip: bool("過去のIPもBAN"), with_device: bool("端末もBAN"), cascade: bool("同じ端末のアカウントも芋づる式にBAN") }, ["username", "minutes"]) },
  { name: "unban_user", write: true, description: "ユーザー名のBAN(IP・端末・同じ端末のアカウント)をまとめて解除する", parameters: S({ username: str("ユーザー名") }, ["username"]) },
  { name: "ip_ban", write: true, description: "IPアドレスをBANする", parameters: S({ ip: str("IPアドレス"), minutes: int("1〜525600"), reason: str("理由") }, ["ip", "minutes"]) },
  { name: "ip_unban", write: true, description: "IPアドレスのBANを解除する", parameters: S({ ip: str("IPアドレス") }, ["ip"]) },
  { name: "set_user_role", write: true, description: "ユーザーの権限を変更する(user/admin/developer)", parameters: S({ username: str("ユーザー名"), role: { type: "string", enum: ["user", "admin", "developer"] } }, ["username", "role"]) },
  { name: "set_verified", write: true, description: "公式バッジ(verified)を付与/解除する", parameters: S({ username: str("ユーザー名"), verified: bool("true=付与") }, ["username", "verified"]) },
  { name: "log_feature_status", write: true, description: "機能の停止・復旧などをAxiomにログとして記録する(機能そのものは操作しない)", parameters: S({ feature: str("機能名(例: いいね)"), status: { type: "string", enum: STATUSES }, message: str("メッセージ(任意)") }, ["feature", "status"]) },
  { name: "resolve_report", write: true, description: "報告/通報を対応済み等にする", parameters: S({ source: { type: "string", enum: ["gather", "user"] }, id: str("報告ID"), status: { type: "string", enum: ["resolved", "dismissed", "open"] } }, ["source", "id"]) },
];
export const isWrite = (name) => !!TOOLS.find((t) => t.name === name)?.write;
export const toolSpecs = () => TOOLS.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));

const userByName = async (username) => {
  const { data, error } = await db().from("users").select(UF).eq("username", String(username || "").trim()).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`ユーザー「${username}」が見つかりません`);
  return data;
};
const head = { count: "exact", head: true };
const cnt = async (q) => { try { const { count, error } = await q; if (error) throw error; return count || 0; } catch { return null; } };

/* ================= 読み取りツール ================= */
export async function runRead(name, a = {}) {
  const sb = db();
  switch (name) {
    case "get_overview": {
      const now = new Date().toISOString();
      const [users, verified, banned, bans, rep1, rep2, st] = await Promise.all([
        cnt(sb.from("users").select("id", head)), cnt(sb.from("users").select("id", head).eq("verified", true)), cnt(sb.from("users").select("id", head).gt("ban_until", now)),
        cnt(sb.from("banned_ip_addresses").select("ip_hash", head).neq("kind", "admin_lock").or(`expires_at.is.null,expires_at.gt.${now}`)),
        cnt(sb.from("gather_reports").select("id", head).eq("status", "open")), cnt(sb.from("reports").select("id", head).neq("status", "resolved")),
        sb.from("app_settings").select("key,value"),
      ]);
      let feature = null; try { feature = (await loadStatus(30)).current.map((e) => ({ feature: e.feature, status: e.status, message: e.message, at: e._time })); } catch { /* Axiom未設定 */ }
      return { users, verified, banned_accounts: banned, active_ip_device_bans: bans, open_reports: rep1, open_user_reports: rep2, settings: Object.fromEntries((st.data || []).map((r) => [r.key, r.value])), feature_status: feature };
    }
    case "get_settings": { const { data } = await sb.from("app_settings").select("key,value"); return Object.fromEntries((data || []).map((r) => [r.key, r.value])); }
    case "log_summary": {
      const h = Math.max(1, Math.min(168, Number(a.hours) || 24)); const q = (s) => axiomQuery(`['${ds()}'] | where _time > ago(${h}h) | ${s}`);
      const jobs = { by_type: `summarize n=count() by type | order by n desc | take 30`, login_fail_reasons: `where type=="login_failed" | summarize n=count() by reason | order by n desc | take 12`, register_fail_reasons: `where type=="register_failed" | summarize n=count() by reason | order by n desc | take 12`, errors: `where type=="api_error" | summarize n=count() by action, status | order by n desc | take 12`, top_ips: `where type=="access" | summarize n=count(), users=dcount(username) by ip | order by n desc | take 10`, fail_ips: `where type=="login_failed" | summarize n=count(), names=dcount(username) by ip | where n >= 3 | order by n desc | take 10` };
      const keys = Object.keys(jobs); const res = await Promise.allSettled(keys.map((k) => q(jobs[k])));
      return { hours: h, ...Object.fromEntries(keys.map((k, i) => [k, res[i].status === "fulfilled" ? slim(res[i].value, 30) : `取得失敗: ${res[i].reason?.message}`])) };
    }
    case "query_logs": { const rows = await axiomQuery(aplFor({ kind: a.kind, hours: a.hours, username: a.username || "", ip: a.ip || "", take: Math.min(40, Number(a.limit) || 40) })); return { count: rows.length, rows: slim(rows, 40) }; }
    case "search_users": {
      const q = String(a.query || "").trim();
      if (isIpLike(q)) return { ip: q, users: (await usersByIp(q)).map((u) => ({ username: u.username, role: u.role, verified: u.verified, ban_until: u.ban_until, matched: u.matched })) };
      const { data, error } = await sb.from("users").select(UF).ilike("username", `%${q.replace(/[%,()]/g, "")}%`).limit(20); if (error) throw error; return { users: data };
    }
    case "get_user": {
      const u = await userByName(a.username);
      const { data: x } = await sb.from("users").select("last_login_ip,ip_list").eq("id", u.id).maybeSingle();
      const list = (Array.isArray(x?.ip_list) ? x.ip_list : []).filter((i) => i?.ip).sort((p, q) => String(q.last).localeCompare(String(p.last))).slice(0, 15);
      const shared = {};
      await Promise.all(list.slice(0, 8).map(async (i) => { const { data } = await sb.from("users").select("username").contains("ip_list", [{ ip: i.ip }]).neq("id", u.id).limit(8); if (data?.length) shared[i.ip] = data.map((d) => d.username); }));
      const dev = await cnt(sb.from("user_devices").select("device_hash", head).eq("user_id", u.id));
      return { ...u, last_login_ip: x?.last_login_ip || null, ips: list, shared_ip_users: shared, device_count: dev };
    }
    case "list_bans": { const { data, error } = await sb.from("banned_ip_addresses").select("ip_hash,reason,expires_at,kind,username").neq("kind", "admin_lock").order("expires_at", { ascending: false }).limit(40); if (error) throw error; return (data || []).map((b) => ({ kind: b.kind || "ip", target: b.username || "(手動)", hash: String(b.ip_hash).slice(0, 14), reason: b.reason, expires_at: b.expires_at })); }
    case "get_reports": {
      const open = a.status !== "resolved";
      let g = sb.from("gather_reports").select("id,username,content,status,created_at").order("created_at", { ascending: false }).limit(15); g = open ? g.eq("status", "open") : g.eq("status", "resolved");
      let r = sb.from("reports").select("*").order("created_at", { ascending: false }).limit(15); r = open ? r.neq("status", "resolved") : r.eq("status", "resolved");
      const [gr, rr] = await Promise.all([g, r]);
      return { gather: (gr.data || []).map((x) => ({ ...x, content: clip(x.content, 300) })), user_reports: (rr.data || []).map((x) => ({ id: x.id, reporter_id: x.reporter_id, target_user_id: x.target_user_id, post_id: x.post_id, reason: clip(x.reason, 300), created_at: x.created_at })) };
    }
    default: throw new Error("不明なツール: " + name);
  }
}

/* ================= 書き込みツール: 説明(承認画面用) と 実行 ================= */
const minutesText = (m) => (Number(m) === 0 ? "無期限" : `${Number(m)}分`);
export async function describeWrite(name, a = {}) {
  switch (name) {
    case "set_setting": {
      const f = FEATURE[a.key];
      if (BOOL.includes(a.key)) return { title: `「${f}」を${a.value ? "再開" : "停止"}しようとしています`, lines: [`設定: ${a.key} = ${a.value}`, ...(a.key === "server_enabled" && !a.value ? ["⚠ Gather APIへのすべての通信が拒否されます(管理サイトは使えます)"] : []), ...(a.key === "admin_login_enabled" && !a.value ? ["⚠ admin / developer もGatherにログインできなくなります"] : [])], danger: !a.value };
      return { title: `表示メッセージ(${a.key})を変更しようとしています`, lines: [`新しい内容: ${a.value}`], danger: false };
    }
    case "ban_user": {
      try {
        const plan = await planUserBan({ username: a.username, withIp: a.with_ip !== false, withDevice: a.with_device !== false, cascade: a.cascade !== false });
        return { title: `ユーザー「${a.username}」をBANしようとしています(${minutesText(a.minutes)})`, lines: [`アカウント(${plan.accounts.length}): ${plan.accounts.map((x) => x.username).join(", ")}`, `IP: ${plan.ips.length}件${plan.ips.length ? "(" + plan.ips.slice(0, 5).join(", ") + (plan.ips.length > 5 ? " ほか" : "") + ")" : ""}`, `端末: ${plan.devices.length}件`, ...plan.warnings.map((w) => "⚠ " + w), ...(a.reason ? [`理由: ${a.reason}`] : [])], danger: true };
      } catch (e) { return { title: `ユーザー「${a.username}」のBANは実行できません`, lines: [e.message], danger: true }; }
    }
    case "unban_user": return { title: `ユーザー「${a.username}」のBANを解除しようとしています`, lines: ["IP・端末のBANと、同じ端末のアカウントのBANをまとめて解除します"], danger: false };
    case "ip_ban": return { title: `IP ${a.ip} をBANしようとしています(${minutesText(a.minutes)})`, lines: a.reason ? [`理由: ${a.reason}`] : [], danger: true };
    case "ip_unban": return { title: `IP ${a.ip} のBANを解除しようとしています`, lines: [], danger: false };
    case "set_user_role": return { title: `「${a.username}」の権限を ${a.role} に変更しようとしています`, lines: a.role !== "user" ? ["⚠ 管理系の権限を付与します"] : [], danger: a.role !== "user" };
    case "set_verified": return { title: `「${a.username}」の公式バッジを${a.verified ? "付与" : "解除"}しようとしています`, lines: [], danger: false };
    case "log_feature_status": return { title: `「${a.feature}」を「${a.status}」としてAxiomに記録しようとしています`, lines: a.message ? [`メッセージ: ${a.message}`] : ["(機能そのものは操作しません)"], danger: false };
    case "resolve_report": return { title: `報告(${a.source === "user" ? "通報" : "ユーザー報告"} #${a.id})を「${a.status || "resolved"}」にしようとしています`, lines: [], danger: false };
    default: return { title: name, lines: [JSON.stringify(a)], danger: true };
  }
}

export async function runWrite(name, a = {}) {
  const sb = db();
  switch (name) {
    case "set_setting": await applySetting(a.key, a.value, "AI"); return `設定 ${a.key} を ${JSON.stringify(a.value)} に変更しました`;
    case "ban_user": {
      const plan = await planUserBan({ username: a.username, withIp: a.with_ip !== false, withDevice: a.with_device !== false, cascade: a.cascade !== false });
      const r = await executeUserBan(plan, { minutes: Number(a.minutes), reason: a.reason || "AIアシスタントからのBAN" });
      return `BANしました: アカウント${r.accounts}件 / IP ${r.ips}件 / 端末${r.devices}件${r.permanent ? "(無期限)" : ""}`;
    }
    case "unban_user": { const r = await unbanUser(String(a.username).trim()); return `解除しました: BAN行${r.removed}件 / アカウント${r.accounts}件`; }
    case "ip_ban": {
      const ip = String(a.ip || "").trim(); if (!validIp(ip)) throw new Error("IPアドレスの形式が不正です");
      const minutes = Math.max(1, Math.min(525600, Number(a.minutes) || 60));
      const { error } = await sb.from("banned_ip_addresses").upsert({ ip_hash: hashIp(ip), reason: String(a.reason || "AIアシスタントからのIP BAN").slice(0, 300), expires_at: new Date(Date.now() + minutes * 60000).toISOString() }, { onConflict: "ip_hash" });
      if (error) throw error; await axiomIngest([{ type: "admin_ip_ban", ip, minutes, via: "AI" }]); return `IP ${ip} を${minutes}分BANしました`;
    }
    case "ip_unban": {
      const ip = String(a.ip || "").trim(); if (!validIp(ip)) throw new Error("IPアドレスの形式が不正です");
      const { error } = await sb.from("banned_ip_addresses").delete().eq("ip_hash", hashIp(ip)); if (error) throw error; await axiomIngest([{ type: "admin_ip_unban", ip, via: "AI" }]); return `IP ${ip} のBANを解除しました`;
    }
    case "set_user_role": {
      if (!["user", "admin", "developer"].includes(a.role)) throw new Error("ロールが不正です");
      const u = await userByName(a.username); const { error } = await sb.from("users").update({ role: a.role }).eq("id", u.id); if (error) throw error;
      await axiomIngest([{ type: "admin_user_update", target_user_id: u.id, username: u.username, patch: { role: a.role }, via: "AI" }]); return `「${u.username}」の権限を ${a.role} にしました`;
    }
    case "set_verified": {
      const u = await userByName(a.username); const { error } = await sb.from("users").update({ verified: !!a.verified }).eq("id", u.id); if (error) throw error;
      await axiomIngest([{ type: "admin_user_update", target_user_id: u.id, username: u.username, patch: { verified: !!a.verified }, via: "AI" }]); return `「${u.username}」の公式バッジを${a.verified ? "付与" : "解除"}しました`;
    }
    case "log_feature_status": {
      if (!STATUSES.includes(a.status)) throw new Error("ステータスが不正です");
      await axiomIngestStrict([{ type: "feature_status", feature: String(a.feature).slice(0, 50), status: a.status, message: String(a.message || "").slice(0, 300) }]); return `「${a.feature}」を「${a.status}」として記録しました`;
    }
    case "resolve_report": {
      const status = ["resolved", "dismissed", "open"].includes(a.status) ? a.status : "resolved";
      const q = a.source === "user" ? sb.from("reports").update({ status: status === "open" ? "pending" : "resolved" }).eq("id", a.id) : sb.from("gather_reports").update({ status }).eq("id", a.id);
      const { error } = await q; if (error) throw error; return `報告 #${a.id} を ${status} にしました`;
    }
    default: throw new Error("不明な操作: " + name);
  }
}

/* ================= 署名(AIが提案した内容だけを実行できるようにする) ================= */
const secret = () => process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "";
export function signAction({ name, args }) {
  const payload = Buffer.from(JSON.stringify({ name, args, exp: Date.now() + 10 * 60000 })).toString("base64url");
  return payload + "." + crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}
export function verifyAction(token) {
  const [payload, sig] = String(token || "").split(".");
  if (!payload || !sig || !secret()) throw Object.assign(new Error("承認トークンが不正です"), { status: 400 });
  const exp = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(exp);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw Object.assign(new Error("承認トークンが不正です"), { status: 400 });
  const d = JSON.parse(Buffer.from(payload, "base64url").toString());
  if (!d.exp || d.exp < Date.now()) throw Object.assign(new Error("承認の有効期限(10分)が切れました。もう一度AIに依頼してください"), { status: 400 });
  if (!isWrite(d.name)) throw Object.assign(new Error("不正な操作です"), { status: 400 });
  return d;
}
