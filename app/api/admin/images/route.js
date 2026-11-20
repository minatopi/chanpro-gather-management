import { NextResponse } from "next/server";
import { guard } from "@/lib/api";
import { db } from "@/lib/db";
import { axiomQuery } from "@/lib/axiom";
import { withUsernames, userIdOf } from "@/lib/enrich";

const http = (u) => typeof u === "string" && /^https?:\/\//i.test(u.trim());
const KIND_JA = { post: "投稿", chat: "チャット", music: "音楽画像", upload: "AIへ送信", generated: "AI生成" };

// ?source=all|post|chat|profile|ai&username=..&limit=80
export const GET = guard(async (req) => {
  const sp = new URL(req.url).searchParams;
  const source = sp.get("source") || "all";
  const username = (sp.get("username") || "").trim();
  const limit = Math.max(1, Math.min(300, parseInt(sp.get("limit"), 10) || 80));
  const uid = username ? await userIdOf(username) : "";
  if (username && !uid) return NextResponse.json({ images: [], note: "ユーザーが見つかりません" });
  const sb = db(); const want = (k) => source === "all" || source === k;
  const items = []; const notes = [];

  const jobs = [];
  if (want("chat")) jobs.push((async () => {
    let q = sb.from("chat_image_assets").select("*").limit(400); if (uid) q = q.eq("user_id", uid);
    const { data, error } = await q; if (error) { notes.push("チャット画像: " + error.message); return; }
    for (const r of data || []) if (http(r.image_url)) items.push({ url: r.image_url, source: "chat", label: "チャット", user_id: r.user_id, at: r.created_at || null, delete_url: r.delete_url || null });
  })());
  if (want("post")) jobs.push((async () => {
    let q = sb.from("posts").select("id,user_id,image_url,created_at").not("image_url", "is", null).order("created_at", { ascending: false }).limit(250); if (uid) q = q.eq("user_id", uid);
    const { data, error } = await q; if (error) { notes.push("投稿画像: " + error.message); return; }
    for (const r of data || []) if (http(r.image_url)) items.push({ url: r.image_url, source: "post", label: "投稿", user_id: r.user_id, at: r.created_at, ref: String(r.id) });
  })());
  if (want("profile")) jobs.push((async () => {
    let q = sb.from("users").select("id,username,icon_url,cover_url").or("icon_url.not.is.null,cover_url.not.is.null").limit(250); if (uid) q = q.eq("id", uid);
    const { data, error } = await q; if (error) { notes.push("プロフィール画像: " + error.message); return; }
    for (const r of data || []) { if (http(r.icon_url)) items.push({ url: r.icon_url, source: "profile", label: "アイコン", user_id: r.id, username: r.username, at: null }); if (http(r.cover_url)) items.push({ url: r.cover_url, source: "profile", label: "カバー画像", user_id: r.id, username: r.username, at: null }); }
  })());
  if (want("ai") || want("post") || want("chat")) jobs.push((async () => {
    // Axiom: image_upload(投稿・チャット・音楽画像) / ai_image_upload(AIへ送信・AI生成)。URLを記録するAPIの新しい版で表示されます
    const ds = (process.env.AXIOM_DATASET || "chanpro").replace(/[^\w-]/g, "");
    try {
      const types = source === "ai" ? '"ai_image_upload"' : source === "all" ? '"image_upload","ai_image_upload"' : '"image_upload"';
      const rows = await axiomQuery(`['${ds}'] | where _time > ago(90d) | where type in (${types}) | where isnotempty(url) | sort by _time desc | take 250`);
      for (const r of rows) {
        if (!http(r.url)) continue; if (uid && r.user_id !== uid) continue;
        const ai = r.type === "ai_image_upload"; const kind = ai ? r.kind : r.kind || "post";
        if (source === "chat" && kind !== "chat") continue; if (source === "post" && kind === "chat") continue;
        items.push({ url: r.url, source: ai ? "ai" : kind, label: KIND_JA[kind] || kind, user_id: r.user_id, username: r.username, at: r._time, delete_url: r.delete_url || null, extra: r.prompt || null });
      }
    } catch (e) { notes.push("Axiom: " + e.message); }
  })());
  await Promise.all(jobs);

  // 重複除去(同じURLは新しい情報を優先) → 新しい順 → ユーザー名を補う
  const byUrl = new Map();
  for (const it of items) { const cur = byUrl.get(it.url); if (!cur) byUrl.set(it.url, it); else byUrl.set(it.url, { ...cur, ...Object.fromEntries(Object.entries(it).filter(([, v]) => v != null && v !== "")) }); }
  let list = [...byUrl.values()].sort((a, b) => (b.at ? new Date(b.at).getTime() : 0) - (a.at ? new Date(a.at).getTime() : 0)).slice(0, limit);
  list = await withUsernames(list);
  return NextResponse.json({ images: list, notes });
});
