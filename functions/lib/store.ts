import { KV_KEY, emptyState, type OfficeState } from "../../shared/office";
import type { AppEnv } from "./http";

export async function loadState(env: AppEnv): Promise<OfficeState> {
  const raw = await env.OFFICE.get(KV_KEY);
  if (!raw) return emptyState();
  try {
    const parsed = JSON.parse(raw) as Partial<OfficeState>;
    return {
      bots: parsed.bots && typeof parsed.bots === "object" ? parsed.bots : {},
      answers: parsed.answers && typeof parsed.answers === "object" ? parsed.answers : {},
      activity: Array.isArray(parsed.activity) ? parsed.activity.slice(0, 200) : [],
    };
  } catch {
    return emptyState();
  }
}

export async function saveState(env: AppEnv, state: OfficeState): Promise<void> {
  await env.OFFICE.put(KV_KEY, JSON.stringify(state));
}
