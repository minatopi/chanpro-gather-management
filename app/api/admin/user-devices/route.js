import { NextResponse } from "next/server";
import { guard, fail } from "@/lib/api";
import { db } from "@/lib/db";

// ?userId=...  そのユーザーが使った端末(端末ハッシュ・端末情報・最終ログイン)
export const GET = guard(async (req) => {
  const id = (new URL(req.url).searchParams.get("userId") || "").trim();
  if (!id) return fail("userId が必要です");
  const { data, error } = await db().from("user_devices").select("device_hash,device_info,last_login_at").eq("user_id", id).order("last_login_at", { ascending: false }).limit(30);
  if (error) throw error;
  return NextResponse.json({ devices: data || [] });
});
