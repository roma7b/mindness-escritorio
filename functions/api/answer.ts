import { catalog, findBot } from "../../shared/office";
import { canIngest, json, type AppEnv } from "../lib/http";
import { loadState } from "../lib/store";

export const onRequestGet: PagesFunction<AppEnv> = async (context) => {
  if (!(await canIngest(context.request, context.env))) {
    return json({ error: "unauthorized", message: "Use Authorization: Bearer com OFFICE_TOKEN." }, 401);
  }
  const name = new URL(context.request.url).searchParams.get("bot") || "";
  const bot = findBot(catalog, name);
  if (!bot) return json({ error: "unknown_bot", message: "Bot desconhecido." }, 400);
  const state = await loadState(context.env);
  const answer = state.answers[bot.id] ?? null;
  return json({
    bot: bot.id,
    decision: answer?.decision ?? null,
    ts: answer?.ts ?? null,
  });
};
