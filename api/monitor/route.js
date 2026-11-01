export const runtime = "nodejs";
export const maxDuration = 15;

// 監視対象を直接指定
const target = {
  name: "chanpro-gather",
  url: "https://chanpro-gather.vercel.app/api/health?token=minato126",
};

export async function POST(request: Request) {
  // API認証
  const apiKey = process.env.MONITOR_API_KEY;

  if (
    !apiKey ||
    request.headers.get("authorization") !== `Bearer ${apiKey}`
  ) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const start = performance.now();

  try {
    const response = await fetch(target.url, {
      method: "GET",
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });

    const responseTime = Math.round(
      (performance.now() - start) * 100
    ) / 100;

    let isUp = false;

    try {
      const data = await response.json();
      isUp = response.ok && data.status === "ok";
    } catch {
      isUp = false;
    }

    return Response.json({
      name: target.name,
      status: isUp ? "UP" : "DOWN",
      is_up: isUp,
      status_code: response.status,
      response_time_ms: responseTime,
      checked_at: new Date().toISOString(),
    });

  } catch (error) {
    return Response.json({
      name: target.name,
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
    });
  }
}
