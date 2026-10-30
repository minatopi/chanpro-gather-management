import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { loadStatus } from "@/lib/status";

// 機能ステータス閲覧用の読み取り専用API。STATUS_FEED_KEY を Bearer で送ると、Axiomの feature_status を返す
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Max-Age": "86400" };
const sha = (v) => crypto.createHash("sha256").update(String(v)).digest();
const reply = (body, status = 200) => NextResponse.json(body, { status, headers: { ...cors, "Cache-Control": "no-store" } });

export const OPTIONS = () => new NextResponse(null, { status: 204, headers: cors });

export async function GET(req) {
  const key = process.env.STATUS_FEED_KEY || "";
  if (!key) return reply({ error: "STATUS_FEED_KEY が未設定です" }, 503);
  const given = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!given || !crypto.timingSafeEqual(sha(given), sha(key))) return reply({ error: "APIキーが違います" }, 401);
  try {
    const days = Math.max(1, Math.min(365, parseInt(new URL(req.url).searchParams.get("days"), 10) || 30));
    return reply(await loadStatus(days));
  } catch (e) { return reply({ error: e.message || "取得に失敗しました" }, 500); }
}
