import { NextResponse } from "next/server";
import { isAdmin } from "./auth";
import { axiomIngest } from "./axiom";

// リクエスト元の情報(IP・UA・Vercelの国/地域/市区町村)
export function reqInfo(req) {
  const h = (k) => req.headers.get(k) || "";
  let city = h("x-vercel-ip-city"); try { city = decodeURIComponent(city); } catch { /* そのまま */ }
  return { ip: (h("x-real-ip") || h("x-forwarded-for") || "unknown").split(",")[0].trim(), ua: h("user-agent").slice(0, 200), country: h("x-vercel-ip-country") || undefined, region: h("x-vercel-ip-country-region") || undefined, city: city || undefined };
}
const lastUnauth = new Map();

export const fail = (msg, status = 400) => NextResponse.json({ error: msg }, { status });
// 全管理APIをこれで包む: 未ログインは401、例外は500
export function guard(handler) {
  return async (req) => {
    if (!(await isAdmin())) {
      const info = reqInfo(req); const now = Date.now();
      if ((lastUnauth.get(info.ip) || 0) < now - 60000) { lastUnauth.set(info.ip, now); await axiomIngest([{ type: "admin_unauthorized", path: new URL(req.url).pathname, ...info }]); }
      return fail("unauthorized", 401);
    }
    try { return await handler(req); }
    catch (e) {
      console.error(e);
      let m = e?.message || "server error";
      if (/schema cache|does not exist/i.test(m)) m += "(Supabaseで sql/setup.sql を実行し、最後に `notify pgrst, 'reload schema';` を実行してください)";
      return fail(m, e?.status || 500);
    }
  };
}
