import { NextResponse } from "next/server";
import { guard, fail } from "@/lib/api";
import { db } from "@/lib/db";

export const GET = guard(async (req) => {
  const id = (new URL(req.url).searchParams.get("userId") || "").trim();
  if (!id) return fail("userId が必要です");
  const sb = db();
  const { data: u, error } = await sb.from("users").select("id,username,last_login_ip,ip_list").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!u) return fail("ユーザーが見つかりません", 404);
  const list = (Array.isArray(u.ip_list) ? u.ip_list : []).filter((x) => x?.ip).sort((a, b) => String(b.last).localeCompare(String(a.last)));
  const shared = {};
  await Promise.all(list.slice(0, 25).map(async (x) => {
    const { data } = await sb.from("users").select("id,username").contains("ip_list", [{ ip: x.ip }]).neq("id", id).limit(10);
    if (data?.length) shared[x.ip] = data;
  }));
  return NextResponse.json({ last_login_ip: u.last_login_ip || null, ip_list: list, shared });
});
