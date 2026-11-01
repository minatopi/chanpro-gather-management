
const http = require("node:http");
const { performance } = require("node:perf_hooks");

// 監視対象
const target = {
  name: "chanpro-gather",
  url: "https://chanpro-gather.vercel.app/api/health?token=minato126",
};

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.MONITOR_API_KEY;

// POST API
const server = http.createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/monitor") {
    res.writeHead(404, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Not Found" }));
  }

  // API認証
  const auth = req.headers.authorization;

  if (!API_KEY || auth !== `Bearer ${API_KEY}`) {
    res.writeHead(401, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Unauthorized" }));
  }

  const start = performance.now();

  try {
    const response = await fetch(target.url, {
      method: "GET",
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });

    const responseTime =
      Math.round((performance.now() - start) * 100) / 100;

    let isUp = false;

    try {
      const data = await response.json();
      isUp = response.ok && data.status === "ok";
    } catch {
      isUp = false;
    }

    const result = {
      name: target.name,
      status: isUp ? "UP" : "DOWN",
      is_up: isUp,
      status_code: response.status,
      response_time_ms: responseTime,
      checked_at: new Date().toISOString(),
    };

    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
    });

    res.end(JSON.stringify(result));

  } catch (error) {
    const result = {
      name: target.name,
      status: "DOWN",
      is_up: false,
      status_code: null,
      response_time_ms:
        Math.round((performance.now() - start) * 100) / 100,
      error: error instanceof Error ? error.message : "Unknown error",
      checked_at: new Date().toISOString(),
    };

    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
    });

    res.end(JSON.stringify(result));
  }
});

// サーバー起動
server.listen(PORT, () => {
  console.log(`Monitor API running on port ${PORT}`);
});
