import { handler } from "../work/actuary_digest_mvp/netlify/functions/daily-refresh.mjs";

export default async function dailyRefresh(request, response) {
  const url = new URL(request.url, "https://actuaryradar.local");
  const result = await handler({
    queryStringParameters: Object.fromEntries(url.searchParams.entries())
  });
  response.status(result.statusCode || 200);
  Object.entries(result.headers || {}).forEach(([key, value]) => response.setHeader(key, value));
  response.send(result.body || "{}");
}
