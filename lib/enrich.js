import { db } from "./db";

// user_id だけで username が無いログ(AI関連など)に、ユーザー名を補う
export async function withUsernames(rows) {
  const ids = [...new Set(rows.filter((r) => r.user_id && !r.username).map((r) => String(r.user_id)))].filter((id) => /^[A-Za-z0-9_-]{1,64}$/.test(id));
  if (!ids.length) return rows;
  const names = {};
  for (let i = 0; i < ids.length; i += 80) {
    const { data } = await db().from("users").select("id,username").in("id", ids.slice(i, i + 80));
    for (const u of data || []) names[u.id] = u.username;
  }
  return rows.map((r) => (r.user_id && !r.username && names[r.user_id] ? { ...r, username: names[r.user_id] } : r));
}
export async function userIdOf(username) {
  if (!username) return "";
  const { data } = await db().from("users").select("id").eq("username", String(username).trim()).maybeSingle();
  return data?.id || "";
}
