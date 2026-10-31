
export async function GET() {
  const key = process.env.MITERL_API;

  if (!key) {
    return Response.json(
      { error: "MITERL_API が設定されていません" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      "https://miterl.com/api/v1/monitors",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: "application/json"
        },
        cache: "no-store",
        signal: AbortSignal.timeout(20000)
      }
    );

    const data = await res.json();

    return Response.json(data, {
      status: res.status,
      headers: {
        "Cache-Control": "no-store"
      }
    });

  } catch (error) {
    return Response.json(
      {
        error: "Miterl API 接続エラー",
        detail: error.message
      },
      { status: 502 }
    );
  }
}
