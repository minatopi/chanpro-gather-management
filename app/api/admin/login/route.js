import { NextResponse } from "next/server";
import { checkPassword, signSession, COOKIE, SESSION_TTL } from "@/lib/auth";
import { axiomIngest } from "@/lib/axiom";
import { db, hashIp } from "@/lib/db";
import { reqInfo } from "@/lib/api";

const fails = new Map();           // インスタンス内の失敗回数
const MAX_FAILS = 5, LOCK_MIN = 15;

// Gather側のIP BAN と、管理ログイン用ロック("adminlock:<hash>")の両方を確認(Vercelの複数インスタンスでも有効)
async function blocked(ip) {
  try {
    const h = hashIp(ip);
    const { data } = await db().from("banned_ip_addresses").select("ip_hash,expires_at").in("ip_hash", [h, "adminlock:" + h]);
    return (data || []).some((r) => !r.expires_at || new Date(r.expires_at).getTime() > Date.now());
  } catch { return false; }
}
async function lockIp(ip) {
  try {
    await db().from("banned_ip_addresses").upsert({ ip_hash: "adminlock:" + hashIp(ip), kind: "admin_lock", reason: "管理サイトのログイン失敗が多いためロック", expires_at: new Date(Date.now() + LOCK_MIN * 60000).toISOString() }, { onConflict: "ip_hash" });
  } catch { /* DB未設定でもメモリ上のロックは有効 */ }
}

export async function POST(req) {
  const m = reqInfo(req);
  const f = fails.get(m.ip) || { n: 0, until: 0 };
  if (f.until > Date.now() || (await blocked(m.ip))) {
    await axiomIngest([{ type: "admin_login_locked", ...m, reason: "ロック中/BAN中のIPからの試行" }]);
    return NextResponse.json({ error: "しばらく待ってから再試行してください" }, { status: 429 });
  }
  const { password } = await req.json().catch(() => ({}));
  if (!checkPassword(password || "")) {
    f.n += 1;
    const locked = f.n >= MAX_FAILS;
    if (locked) { f.until = Date.now() + LOCK_MIN * 60000; await lockIp(m.ip); f.n = 0; }
    fails.set(m.ip, f);
    await new Promise((r) => setTimeout(r, 600));
    await axiomIngest([{ type: "admin_login_failed", ...m, attempt: locked ? MAX_FAILS : f.n }, ...(locked ? [{ type: "admin_login_locked", ...m, reason: `${MAX_FAILS}回失敗のため${LOCK_MIN}分ロック` }] : [])]);
    return NextResponse.json({ error: "パスワードが違います" }, { status: 401 });
  }
  fails.delete(m.ip);
  await axiomIngest([{ type: "admin_login_success", ...m }]);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, signSession(), { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: SESSION_TTL });
  return res;
}
