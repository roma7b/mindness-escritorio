export type AppEnv = Env & {
  OFFICE_TOKEN?: string;
  VIEW_TOKEN?: string;
};

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function tokenMatches(provided: string | null, expected: string | undefined): Promise<boolean> {
  if (!provided || !expected) return false;
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  return crypto.subtle.timingSafeEqual(left, right);
}

export function bearer(request: Request): string | null {
  const header = request.headers.get("authorization") || "";
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return match ? match[1] : null;
}

export function cookieValue(request: Request, name: string): string | null {
  const raw = request.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function hasAccess(request: Request): boolean {
  const email = request.headers.get("Cf-Access-Authenticated-User-Email");
  const jwt = request.headers.get("Cf-Access-Jwt-Assertion");
  return Boolean(email && email.includes("@") && jwt && jwt.length > 20);
}

export async function canView(request: Request, env: AppEnv): Promise<boolean> {
  if (hasAccess(request)) return true;
  const token = bearer(request) || cookieValue(request, "office_view") || new URL(request.url).searchParams.get("token");
  return tokenMatches(token, env.VIEW_TOKEN);
}

export async function canIngest(request: Request, env: AppEnv): Promise<boolean> {
  return tokenMatches(bearer(request), env.OFFICE_TOKEN);
}

export async function readBody(request: Request): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  const text = await request.text();
  if (text.length > 20_000) {
    return { ok: false, response: json({ error: "too_large", message: "Corpo grande demais." }, 413) };
  }
  try {
    return { ok: true, value: text ? JSON.parse(text) : {} };
  } catch {
    return { ok: false, response: json({ error: "bad_json", message: "JSON inválido." }, 400) };
  }
}

export function logEvent(event: string, fields: Record<string, string | number | boolean | null>): void {
  console.log(JSON.stringify({ level: "info", event, ...fields }));
}
