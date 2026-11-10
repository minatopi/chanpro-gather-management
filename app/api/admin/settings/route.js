import { NextResponse } from "next/server";
import { guard, fail } from "@/lib/api";
import { db } from "@/lib/db";
import { applySetting } from "@/lib/settings";

export const GET = guard(async () => {
  const { data, error } = await db().from("app_settings").select("key,value");
  if (error) throw error;
  return NextResponse.json({ settings: Object.fromEntries((data || []).map((r) => [r.key, r.value])) });
});

export const PUT = guard(async (req) => {
  const { key, value } = await req.json();
  try { await applySetting(key, value); } catch (e) { if (e.status === 400) return fail(e.message); throw e; }
  return NextResponse.json({ ok: true });
});
