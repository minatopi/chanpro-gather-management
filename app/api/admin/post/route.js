import { NextResponse } from "next/server";
import { guard, fail } from "@/lib/api";
import { db } from "@/lib/db";
import { axiomIngest } from "@/lib/axiom";
import { allowedPostUserIds } from "@/lib/postas";

const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

async function accounts() {
  const ids = allowedPostUserIds();
  const { data, error } = await db().from("users").select("id,username,icon_url,verified,role").in("id", ids);
  if (error) throw error;
  return ids.map((id) => (data || []).find((u) => u.id === id)).filter(Boolean);
}

export const GET = guard(async (req) => {
  const accts = await accounts();
  const want = new URL(req.url).searchParams.get("userId") || accts[0]?.id;
  if (!want) return NextResponse.json({ accounts: [], posts: [] });
  if (!allowedPostUserIds().includes(want)) return fail("このアカウントでは投稿できません", 403);
  const { data: posts, error } = await db().from("posts").select("id,content,image_url,is_limited,views,created_at").eq("user_id", want).order("created_at", { ascending: false }).limit(20);
  if (error) throw error;
  return NextResponse.json({ accounts: accts, posts: posts || [], allowedCount: allowedPostUserIds().length });
});

// body: { userId, content, image_url?, is_limited?, notify? }
export const POST = guard(async (req) => {
  const b = await req.json();
  const userId = String(b.userId || "");
  if (!allowedPostUserIds().includes(userId)) return fail("このアカウントでは投稿できません", 403);
  const content = String(b.content || "");
  const imageUrl = b.image_url ? String(b.image_url).trim() : null;
  if (!content.trim() && !imageUrl) return fail("投稿内容を入力してください");
  if (content.length > 100000) return fail("投稿内容が長すぎます");
  if (imageUrl && (imageUrl.length > 10000 || !/^https?:\/\//i.test(imageUrl))) return fail("画像URLは http(s) で始まる URL にしてください");

  const sb = db();
  const { data: user, error: ue } = await sb.from("users").select("id,username,verified").eq("id", userId).maybeSingle();
  if (ue) throw ue;
  if (!user) return fail("アカウントが見つかりません", 404);
  const isLimited = !!b.is_limited && !!user.verified;

  const { data: post, error } = await sb.from("posts").insert({ user_id: userId, content, image_url: imageUrl, is_limited: isLimited, quote_post_id: null, poll: null, views: 0 }).select("*").single();
  if (error) throw error;

  // フォロワーへの通知(Gather APIの post-create と同じ内容)
  let notified = 0;
  if (b.notify !== false) {
    try {
      const { data: follows } = await sb.from("follows").select("follower_id").eq("following_id", userId);
      let ids = [...new Set((follows || []).map((f) => f.follower_id).filter((id) => id && String(id) !== userId))];
      if (isLimited && ids.length) {
        const parts = await Promise.all(chunk(ids, 200).map((p) => sb.from("users").select("id").in("id", p).eq("verified", true)));
        ids = parts.flatMap((r) => (r.data || []).map((v) => v.id));
      }
      const rows = ids.map((uid) => ({ user_id: uid, actor_id: userId, type: "post", post_id: post.id }));
      for (const part of chunk(rows, 500)) { const { error: ne } = await sb.from("notifications").insert(part); if (!ne) notified += part.length; }
    } catch (e) { console.warn("notify failed", e?.message); }
  }
  await axiomIngest([{ type: "admin_post", user_id: userId, username: user.username, post_id: String(post.id), is_limited: isLimited, notified }]);
  return NextResponse.json({ ok: true, post, notified, limitedIgnored: !!b.is_limited && !isLimited });
});

// body: { id, userId }
export const DELETE = guard(async (req) => {
  const { id, userId } = await req.json();
  if (!allowedPostUserIds().includes(String(userId))) return fail("権限がありません", 403);
  const { data: post } = await db().from("posts").select("id,user_id").eq("id", id).maybeSingle();
  if (!post || post.user_id !== userId) return fail("投稿が見つかりません", 404);
  const { error } = await db().from("posts").delete().eq("id", post.id);
  if (error) throw error;
  await axiomIngest([{ type: "admin_post_delete", user_id: userId, post_id: String(id) }]);
  return NextResponse.json({ ok: true });
});
