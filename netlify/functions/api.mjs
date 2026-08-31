import { createApplication } from "../../server/app.mjs";
import { createRouter } from "../../server/router.mjs";

let router;

function getRouter() {
  router ??= createRouter(createApplication());
  return router;
}

export default async function handler(request) {
  const url = new URL(request.url);
  let body = {};
  if (!new Set(["GET", "HEAD"]).has(request.method)) {
    const text = await request.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        return new Response(JSON.stringify({
          error: "INVALID_JSON",
          message: "Request body must contain valid JSON",
        }), {
          status: 400,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
    }
  }

  const response = await getRouter().handle({
    method: request.method,
    path: url.pathname,
    headers: Object.fromEntries(request.headers.entries()),
    query: url.searchParams,
    body,
  });

  return new Response(response.body == null ? null : JSON.stringify(response.body), {
    status: response.status,
    headers: response.headers,
  });
}
