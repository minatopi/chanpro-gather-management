import { NextResponse } from "next/server";
import { guard } from "@/lib/api";
import { db } from "@/lib/db";
import { hogql } from "@/lib/posthog";

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const uuidOf = (v) => (String(v || "").match(UUID) || [])[0]?.toLowerCase() || "";
const uniq = (a) => [...new Set(a.filter(Boolean))];

// PostHog の GeoIP(IPからの推定位置)をユーザーごとに集計
export const GET = guard(async (req) => {
  const days = Math.max(1, Math.min(365, parseInt(new URL(req.url).searchParams.get("days"), 10) || 30));
  const raw = await hogql(
    `SELECT if(distinct_id = 'chanpro-server-security', toString(properties.user_id), distinct_id) AS uid,
            any(toString(person.properties.username)) AS pname, any(toString(properties.username)) AS uname,
            properties.$geoip_country_code AS cc, properties.$geoip_country_name AS country,
            properties.$geoip_subdivision_1_name AS region, properties.$geoip_city_name AS city,
            round(toFloat(properties.$geoip_latitude), 2) AS lat, round(toFloat(properties.$geoip_longitude), 2) AS lon,
            count() AS n, max(timestamp) AS last_seen
     FROM events
     WHERE timestamp > now() - INTERVAL ${days} DAY AND isNotNull(properties.$geoip_latitude)
       AND event IN ('$pageview','chanpro_login_success','chanpro_registration_created')
     GROUP BY uid, cc, country, region, city, lat, lon ORDER BY n DESC LIMIT 3000`);
  const rows = raw.filter((r) => r.uid && r.uid !== "chanpro-server-security" && Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lon)));

  // ユーザー解決: ① distinct_id 内のUUID(例 "id-<uuid>" 形式も可) → users.id ② distinct_id / Personのusername → users.username
  const sb = db(); const byId = {}, byName = {};
  const ids = uniq(rows.map((r) => uuidOf(r.uid)));
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await sb.from("users").select("id,username").in("id", ids.slice(i, i + 100));
    for (const u of data || []) byId[u.id.toLowerCase()] = u;
  }
  const names = uniq(rows.flatMap((r) => [r.uid, r.pname, r.uname]).map((v) => String(v || "").trim()).filter((v) => v && v !== "null" && v.length <= 100));
  for (let i = 0; i < names.length; i += 100) {
    const { data } = await sb.from("users").select("id,username").in("username", names.slice(i, i + 100));
    for (const u of data || []) byName[u.username] = u;
  }
  const resolve = (r) => byId[uuidOf(r.uid)] || byName[r.uid] || byName[r.pname] || byName[r.uname] || null;

  const out = rows.map((r) => {
    const u = resolve(r);
    return { uid: u ? u.id : r.uid, username: u?.username || "", cc: r.cc || "", country: r.country || "", region: r.region || "", city: r.city || "", lat: Number(r.lat), lon: Number(r.lon), n: Number(r.n), last_seen: r.last_seen };
  });
  const unresolvedIds = uniq(out.filter((r) => !r.username).map((r) => r.uid));
  return NextResponse.json({ days, rows: out, unresolved: unresolvedIds.length, resolved: uniq(out.filter((r) => r.username).map((r) => r.uid)).length, unresolvedSample: unresolvedIds.slice(0, 3) });
});
