import { NextResponse } from "next/server";
import { guard } from "@/lib/api";
import { axiomIngest } from "@/lib/axiom";
import { verifyAction, runWrite } from "@/lib/ai-tools";

export const maxDuration = 60;

// body: { token, deny? }  管理者が「許可」したときだけ実行する(AIが提案した署名つき内容のみ)
export const POST = guard(async (req) => {
  const { token, deny } = await req.json();
  const a = verifyAction(token);
  if (deny) { await axiomIngest([{ type: "admin_ai_action", op: a.name, args: a.args, approved: false }]); return NextResponse.json({ ok: true, denied: true }); }
  let result, ok = true;
  try { result = await runWrite(a.name, a.args); } catch (e) { ok = false; result = e.message; }
  await axiomIngest([{ type: "admin_ai_action", op: a.name, args: a.args, approved: true, ok, result: String(result).slice(0, 300) }]);
  return NextResponse.json({ ok, result });
});
