import { NextResponse } from "next/server";
import { COOKIE, isAdmin } from "@/lib/auth";
import { axiomIngest } from "@/lib/axiom";
import { reqInfo } from "@/lib/api";

export async function POST(req) {
  if (await isAdmin()) await axiomIngest([{ type: "admin_logout", ...reqInfo(req) }]);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
