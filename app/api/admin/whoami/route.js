import { NextResponse } from "next/server";
import { guard, reqInfo } from "@/lib/api";

// 現在アクセスしているIP(管理ログ画面で「あなた」を判別し、自分をBANしないために使用)
export const GET = guard(async (req) => NextResponse.json(reqInfo(req)));
