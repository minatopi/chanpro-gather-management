
export const runtime = "nodejs";
export const maxDuration = 15;
export const dynamic = "force-dynamic";

// ========================================
// 監視設定
// ========================================

const TARGET = {
  name: "chanpro-gather",
  url: "https://chanpro-gather.vercel.app/api/health?token=minato126",
};

const TIMEOUT_MS = 10000;

// ========================================
// JSONレスポンス共通処理
// ========================================

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache",
    },
  });
}

// ========================================
// 監視処理
// ========================================

async function checkHealth() {
  const start = performance.now();

  try {
    if (!TARGET.url) {
      throw new Error("CHANPRO_HEALTH_URL is not configured");
    }

    const response = await fetch(TARGET.url, {
      method: "GET",
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "Accept": "application/json",
        "Cache-Control": "no-cache",
      },
    });

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    const responseTime = Math.round(
      (performance.now() - start) * 100
    ) / 100;

    const isUp = response.ok && data?.status === "ok";

    return {
      name: TARGET.name,
      status: isUp ? "UP" : "DOWN",
      is_up: isUp,
      status_code: response.status,
      response_time_ms: responseTime,
      checked_at: new Date().toISOString(),
      health_response: data,
    };

  } catch (error) {
    return {
      name: TARGET.name,
      status: "DOWN",
      is_up: false,
      status_code: null,
      response_time_ms: Math.round(
        (performance.now() - start) * 100
      ) / 100,
      error: error instanceof Error
        ? error.message
        : "Unknown error",
      checked_at: new Date().toISOString(),
    };
  }
}

// ========================================
// API認証
// ========================================

function authenticate(request) {
  const apiKey = process.env.MONITOR_API_KEY;

  if (!apiKey) {
    return false;
  }

  const authorization = request.headers.get("authorization");

  return authorization === `Bearer ${apiKey}`;
}

// ========================================
// GET
// ========================================

export async function GET(request) {
  if (!authenticate(request)) {
    return json({
      error: "Unauthorized",
    }, 401);
  }

  const result = await checkHealth();

  return json(result);
}

// ========================================
// POST
// ========================================

export async function POST(request) {
  if (!authenticate(request)) {
    return json({
      error: "Unauthorized",
    }, 401);
  }

  const result = await checkHealth();

  return json(result);
}

// ========================================
// OPTIONS
// ========================================

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Allow": "GET, POST, OPTIONS",
      "Cache-Control": "no-store",
    },
  });
}
