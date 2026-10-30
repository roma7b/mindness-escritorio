import { canView, cookieValue, tokenMatches, type AppEnv } from "./lib/http";

const STATIC = /\.(?:js|css|map|png|jpg|jpeg|gif|svg|ico|webp|woff2?|txt|json|wasm)$/i;

function lockPage(): Response {
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>Escritório Mindness</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; min-height: 100dvh; display: grid; place-items: center; background: #10141f; color: #e7ecf7;
      font: 16px/1.5 Outfit, ui-sans-serif, system-ui, sans-serif; }
    main { width: min(440px, calc(100% - 32px)); background: #171d2e; border: 1px solid #2d3654; border-radius: 16px; padding: 28px; }
    h1 { font-size: 22px; margin: 0 0 8px; }
    p { margin: 0 0 12px; color: #b7c0d6; }
    a { color: #ffbf3c; }
    code { font-size: 13px; color: #f4f7fb; }
  </style>
</head>
<body>
  <main>
    <h1>Escritório interno</h1>
    <p>Os status dos bots não ficam públicos. Entra com <code>?token=</code> ou pelo Cloudflare Access.</p>
    <p>Para ver a sala com dados simulados, abre <a href="?demo=1">o modo DEMO</a>. O demo não grava nada e não fala com bot nenhum.</p>
  </main>
</body>
</html>`;
  return new Response(html, {
    status: 401,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export const onRequest: PagesFunction<AppEnv> = async (context) => {
  const url = new URL(context.request.url);
  if (url.pathname.startsWith("/api/") || STATIC.test(url.pathname)) return context.next();

  const demo = url.searchParams.get("demo") === "1";
  const token = url.searchParams.get("token");
  const allowed = demo || (await canView(context.request, context.env));
  if (!allowed) return lockPage();

  const response = await context.next();
  if (token && (await tokenMatches(token, context.env.VIEW_TOKEN)) && cookieValue(context.request, "office_view") !== token) {
    const headers = new Headers(response.headers);
    const secure = url.protocol === "https:" ? "; Secure" : "";
    headers.append(
      "set-cookie",
      `office_view=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000${secure}`,
    );
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
  return response;
};
