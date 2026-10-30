import { applyReport, catalog, present } from "../../shared/office";
import { canIngest, json, logEvent, readBody, type AppEnv } from "../lib/http";
import { loadState, saveState } from "../lib/store";

export const onRequestPost: PagesFunction<AppEnv> = async (context) => {
  if (!(await canIngest(context.request, context.env))) {
    return json({ error: "unauthorized", message: "Use Authorization: Bearer com OFFICE_TOKEN." }, 401);
  }
  const body = await readBody(context.request);
  if (!body.ok) return body.response;
  if (!body.value || typeof body.value !== "object") {
    return json({ error: "bad_json", message: "O corpo precisa ser um objeto." }, 400);
  }

  const now = Date.now();
  const current = await loadState(context.env);
  const result = applyReport(catalog, current, body.value, now, crypto.randomUUID());
  if (!result.ok) return json({ error: result.error, message: result.message }, result.status);

  await saveState(context.env, result.state);
  const view = present(catalog, result.state, now).bots.find((bot) => bot.id === result.bot.id);
  logEvent("status", {
    bot: result.bot.id,
    status: result.state.bots[result.bot.id].status,
    displayed: result.displayed,
  });

  return json({
    ok: true,
    bot: result.bot.id,
    stored: result.state.bots[result.bot.id].status,
    displayed: view?.status ?? result.displayed,
    hint: "Um ping no fim da tarefa. Opcional no começo. Sem loop.",
    warning: result.warning ?? null,
  });
};

export const onRequestGet: PagesFunction = async () =>
  json({ error: "method", message: "Use POST." }, 405);
