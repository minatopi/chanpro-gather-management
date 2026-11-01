// 管理サイトから投稿を許可するアカウント。環境変数 ADMIN_POST_USER_IDS(カンマ区切り)で上書き可
const DEFAULT_IDS = "04dd75ae-dd2e-4fe4-ade1-fc19a2f65b06";
export const allowedPostUserIds = () =>
  (process.env.ADMIN_POST_USER_IDS || DEFAULT_IDS).split(",").map((s) => s.trim()).filter((s) => /^[A-Za-z0-9_-]{1,64}$/.test(s));
