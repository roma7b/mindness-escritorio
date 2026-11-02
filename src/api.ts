import type { OfficeView } from "../shared/office";

const TOKEN_KEY = "office_token";

export function rememberToken(params: URLSearchParams): void {
  const token = params.get("token");
  if (!token) return;
  sessionStorage.setItem(TOKEN_KEY, token);
  params.delete("token");
  const next = params.toString();
  history.replaceState(null, "", next ? `${location.pathname}?${next}` : location.pathname);
}

function authHeaders(): HeadersInit {
  const token = sessionStorage.getItem(TOKEN_KEY);
  return token ? { authorization: `Bearer ${token}` } : {};
}

export async function fetchOffice(): Promise<{ ok: true; view: OfficeView } | { ok: false; status: number }> {
  try {
    const response = await fetch("/api/office", { headers: authHeaders(), cache: "no-store" });
    if (!response.ok) return { ok: false, status: response.status };
    const view = (await response.json()) as OfficeView;
    return { ok: true, view };
  } catch {
    return { ok: false, status: 0 };
  }
}

export async function postDecision(
  bot: string,
  decision: "approve" | "decline",
): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await fetch("/api/decision", {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify({ bot, decision }),
    });
    const data = (await response.json().catch(() => ({}))) as { message?: string; note?: string };
    if (!response.ok) return { ok: false, message: data.message || "Não foi possível gravar." };
    return { ok: true, message: data.note || "Gravado só no escritório." };
  } catch {
    return { ok: false, message: "Sem ligação com o escritório." };
  }
}
