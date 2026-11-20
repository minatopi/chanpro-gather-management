import { NextResponse } from "next/server";
import { guard } from "@/lib/api";
import { axiomQuery } from "@/lib/axiom";
import { aplFor } from "@/lib/logkinds";
import { withUsernames, userIdOf } from "@/lib/enrich";

// ?kind=all|login|read|change|account|admin|ip|error|status|ai ...&hours=24&username=..&ip=..
export const GET = guard(async (req) => {
  const sp = new URL(req.url).searchParams;
  const username = (sp.get("username") || "").trim();
  const userId = username ? await userIdOf(username).catch(() => "") : "";
  const apl = aplFor({ kind: sp.get("kind"), hours: parseInt(sp.get("hours"), 10), username, userId, ip: (sp.get("ip") || "").trim() });
  return NextResponse.json({ rows: await withUsernames(await axiomQuery(apl)) });
});
