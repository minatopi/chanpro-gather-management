import { db } from "./db";
import { axiomIngest } from "./axiom";
import { FEATURES } from "./features";

export const BOOL = ["login_enabled", "register_enabled", "admin_login_enabled", "server_enabled", ...FEATURES.map((f) => "feature_" + f.key)];
export const TEXT = ["login_disabled_message", "register_disabled_message", "admin_login_disabled_message", "server_disabled_message", ...FEATURES.map((f) => `feature_${f.key}_message`)];
export const FEATURE = { login_enabled: "ログイン", register_enabled: "新規アカウント作成", admin_login_enabled: "管理者ログイン", server_enabled: "サーバー全体", ...Object.fromEntries(FEATURES.map((f) => ["feature_" + f.key, f.label])) }; // 停止/再開はAxiomの機能ステータスにも自動記録

export async function applySetting(key, value, source = "admin-site") {
  const bad = (m) => Object.assign(new Error(m), { status: 400 });
  if (![...BOOL, ...TEXT].includes(key)) throw bad("未対応のキーです");
  if (BOOL.includes(key) && typeof value !== "boolean") throw bad("値が不正です(true/false)");
  if (TEXT.includes(key) && (typeof value !== "string" || value.length > 200)) throw bad("値が不正です(200文字までの文字列)");
  const { error } = await db().from("app_settings").upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
  const events = [{ type: "admin_setting_changed", key, value, via: source }];
  if (FEATURE[key]) events.push({ type: "feature_status", feature: FEATURE[key], status: value ? "復旧" : "停止", message: (value ? "再開" : "停止") + `(${source})` });
  await axiomIngest(events);
}
