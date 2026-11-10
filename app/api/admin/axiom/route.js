import { NextResponse } from "next/server";
import { guard } from "@/lib/api";
import { axiomQuery } from "@/lib/axiom";
import { aplFor } from "@/lib/logkinds";

// ?kind=login|access|activity|error|ip|status|admin|adminlogin|adminops&hours=24&username=..&ip=..
export const GET = guard(async (req) => {
  const sp = new URL(req.url).searchParams;
  const apl = aplFor({ kind: sp.get("kind"), hours: parseInt(sp.get("hours"), 10), username: (sp.get("username") || "").trim(), ip: (sp.get("ip") || "").trim() });
  return NextResponse.json({ rows: await axiomQuery(apl) });
});
