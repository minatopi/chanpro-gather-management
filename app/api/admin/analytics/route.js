import { NextResponse } from "next/server";
import { guard } from "@/lib/api";
import { db } from "@/lib/db";
import { axiomQuery } from "@/lib/axiom";

const timeOf = (r) => r._time ?? r[Object.keys(r).find((k) => /time/i.test(k))];

export const GET = guard(async (req) => {
  const hours = [6, 24, 72, 168].includes(parseInt(new URL(req.url).searchParams.get("hours"), 10)) ? parseInt(new URL(req.url).searchParams.get("hours"), 10) : 24;
  const bin = hours <= 24 ? "1h" : hours <= 72 ? "3h" : "6h";
  const ds = (process.env.AXIOM_DATASET || "chanpro").replace(/[^\w-]/g, "");
  const q = (s) => axiomQuery(`['${ds}'] | where _time > ago(${hours}h) | ${s}`);
  const jobs = {
    totals: () => q(`summarize access=countif(type=="access"), users=dcountif(username, type=="access"), login_ok=countif(type=="login_success"), login_fail=countif(type=="login_failed"), registered=countif(type=="register_created"), errors=countif(type=="api_error"), posts=countif(type=="post_created"), replies=countif(type=="reply_created"), likes=countif(type=="like_toggled"), dms=countif(type=="dm_sent")`),
    timeline: () => q(`summarize access=countif(type=="access"), login_ok=countif(type=="login_success"), login_fail=countif(type=="login_failed"), errors=countif(type=="api_error"), posts=countif(type=="post_created") by bin(_time, ${bin}) | order by _time asc`),
    actions: () => q(`where type=="access" | summarize n=count(), avg_ms=avg(ms), max_ms=max(ms) by action | order by n desc | take 12`),
    topIps: () => q(`where type=="access" | summarize n=count(), users=dcount(username) by ip | order by n desc | take 12`),
    failIps: () => q(`where type=="login_failed" | summarize n=count(), names=dcount(username), last=max(_time) by ip | where n >= 3 | order by n desc | take 12`),
    errorsBy: () => q(`where type=="api_error" | summarize n=count() by action, status | order by n desc | take 12`),
    countries: () => q(`where type=="access" | summarize n=count(), users=dcount(username) by country | order by n desc | take 10`),
  };
  const keys = Object.keys(jobs);
  const res = await Promise.allSettled(keys.map((k) => jobs[k]()));
  const out = {}, errors = [];
  res.forEach((r, i) => { if (r.status === "fulfilled") out[keys[i]] = r.value; else errors.push(`${keys[i]}: ${r.reason?.message || r.reason}`); });
  if (errors.length === keys.length) throw new Error(errors[0]);

  // DB(users.ip_list)から: 複数アカウントで共有されているIP / 多数のIPを使うユーザー
  let shared = [], many = [], dbError = "";
  try {
    const { data, error } = await db().from("users").select("id,username,last_login_ip,ip_list").not("last_login_ip", "is", null).limit(3000);
    if (error) throw error;
    const byIp = new Map();
    for (const u of data || []) for (const x of Array.isArray(u.ip_list) ? u.ip_list : []) {
      if (!x?.ip) continue;
      const e = byIp.get(x.ip) || []; e.push({ id: u.id, username: u.username, last: x.last }); byIp.set(x.ip, e);
    }
    shared = [...byIp.entries()].filter(([, us]) => us.length >= 2).map(([ip, us]) => ({ ip, users: us.sort((a, b) => String(b.last).localeCompare(String(a.last))) })).sort((a, b) => b.users.length - a.users.length).slice(0, 20);
    many = (data || []).map((u) => ({ username: u.username, count: Array.isArray(u.ip_list) ? u.ip_list.length : 0, last_login_ip: u.last_login_ip })).filter((u) => u.count >= 5).sort((a, b) => b.count - a.count).slice(0, 15);
  } catch (e) { dbError = e.message; }

  return NextResponse.json({
    hours, bin, errors, dbError, shared, many,
    totals: out.totals?.[0] || null,
    timeline: (out.timeline || []).map((r) => ({ t: timeOf(r), access: Number(r.access || 0), login_ok: Number(r.login_ok || 0), login_fail: Number(r.login_fail || 0), errors: Number(r.errors || 0), posts: Number(r.posts || 0) })),
    actions: out.actions || [], topIps: out.topIps || [], failIps: out.failIps || [], errorsBy: out.errorsBy || [], countries: out.countries || [],
  });
});
