import { db } from "./db";

const FIELDS = "id,username,role,verified,ban_until,ban_count,points,icon_url";
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

// 裏垢の可能性があるアカウントをまとめる: 同じ端末(強い根拠)・同じIP(共有回線を避けて 2〜6 アカウントのIPのみ)
export async function annotateAlts(users) {
  if (!users?.length) return { users: users || [], groups: [] };
  const sb = db(); const byId = new Map(users.map((u) => [u.id, { ...u }]));
  const parent = new Map(); const reasons = new Map();
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const union = (a, b, why) => { const ra = find(a), rb = find(b); const set = new Set([...(reasons.get(ra) || []), ...(reasons.get(rb) || []), why]); if (ra !== rb) parent.set(ra, rb); reasons.set(find(a), set); };

  // 端末
  const devUsers = new Map();
  try {
    const ids = [...byId.keys()]; const rows = [];
    for (const part of chunk(ids, 60)) { const { data } = await sb.from("user_devices").select("user_id,device_hash").in("user_id", part).limit(3000); rows.push(...(data || [])); }
    const hashes = [...new Set(rows.map((r) => r.device_hash))];
    for (const part of chunk(hashes, 40)) { const { data } = await sb.from("user_devices").select("user_id,device_hash").in("device_hash", part).limit(3000); rows.push(...(data || [])); }
    const extra = [...new Set(rows.map((r) => r.user_id).filter((id) => !byId.has(id)))].slice(0, 30);
    if (extra.length) { const { data } = await sb.from("users").select(FIELDS).in("id", extra); for (const u of data || []) byId.set(u.id, { ...u, related: true }); }
    for (const r of rows) { const set = devUsers.get(r.device_hash) || new Set(); set.add(r.user_id); devUsers.set(r.device_hash, set); }
  } catch { /* user_devices が無くても一覧は表示する */ }

  for (const id of byId.keys()) { parent.set(id, id); reasons.set(id, new Set()); }
  for (const set of devUsers.values()) { const m = [...set].filter((id) => byId.has(id)); for (let i = 1; i < m.length; i++) union(m[0], m[i], "同じ端末"); }

  // IP
  try {
    const ipUsers = new Map();
    for (const part of chunk([...byId.keys()], 60)) {
      const { data, error } = await sb.from("users").select("id,ip_list,last_login_ip").in("id", part);
      if (error) throw error;
      for (const u of data || []) {
        const ips = new Set([u.last_login_ip, ...(Array.isArray(u.ip_list) ? u.ip_list.map((x) => x?.ip) : [])].filter(Boolean));
        for (const ip of ips) { const set = ipUsers.get(ip) || new Set(); set.add(u.id); ipUsers.set(ip, set); }
      }
    }
    for (const [ip, set] of ipUsers) { const m = [...set]; if (m.length >= 2 && m.length <= 6) for (let i = 1; i < m.length; i++) union(m[0], m[i], `同じIP(${ip})`); }
  } catch { /* ip_list 未作成でも続行 */ }

  const members = new Map();
  for (const id of byId.keys()) { const r = find(id); members.set(r, [...(members.get(r) || []), id]); }
  const groups = []; const groupOf = new Map();
  for (const [root, ids] of members) if (ids.length >= 2) { const g = { id: groups.length + 1, members: ids, reasons: [...(reasons.get(find(root)) || [])].slice(0, 4), strong: (reasons.get(find(root)) || new Set()).has("同じ端末") }; groups.push(g); ids.forEach((id) => groupOf.set(id, g.id)); }

  // 元の並び順を保ちつつ、グループのメンバーを連続させる
  const out = []; const emitted = new Set();
  for (const u of users) {
    const gid = groupOf.get(u.id);
    if (!gid) { out.push({ ...byId.get(u.id) }); continue; }
    if (emitted.has(gid)) continue; emitted.add(gid);
    const g = groups.find((x) => x.id === gid);
    const listed = users.map((x) => x.id).filter((id) => g.members.includes(id));
    const rest = g.members.filter((id) => !listed.includes(id));
    [...listed, ...rest].forEach((id) => out.push({ ...byId.get(id), group: gid }));
  }
  return { users: out, groups: groups.map((g) => ({ ...g, members: g.members.length })) };
}
