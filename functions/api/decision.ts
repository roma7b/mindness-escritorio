import { applyDecision, catalog } from "../../shared/office";
import { canView, json, logEvent, readBody, type AppEnv } from "../lib/http";
import { loadState, saveState } from "../lib/store";

export const onRequestPost: PagesFunction<AppEnv> = async (context) => {
  if (!(await canView(context.request, context.env))) {
    return json({ error: "unauthorized", message: "Sessão do escritório necessária." }, 401);
  }
  const body = await readBody(context.request);
  if (!body.ok) return body.response;
  const payload = body.value && typeof body.value === "object" ? (body.value as { bot?: unknown; decision?: unknown }) : {};
  const now = Date.now();
  const current = await loadState(context.env);
  const result = applyDecision(catalog, current, payload.bot, payload.decision, now);
  if (!result.ok) return json({ error: result.error, message: result.message }, result.status);
  await saveState(context.env, result.state);
  logEvent("decision", { bot: result.bot.id, decision: String(payload.decision) });
  return json({
    ok: true,
    bot: result.bot.id,
    decision: result.state.answers[result.bot.id],
    warning: result.warning ?? null,
    note: "Gravado só no escritório. Nada foi enviado para fora.",
  });
};
