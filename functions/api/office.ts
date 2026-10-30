import { catalog, present } from "../../shared/office";
import { canView, json, type AppEnv } from "../lib/http";
import { loadState } from "../lib/store";

export const onRequestGet: PagesFunction<AppEnv> = async (context) => {
  if (!(await canView(context.request, context.env))) {
    return json(
      { error: "unauthorized", message: "Abra com ?token= ou pelo Cloudflare Access." },
      401,
    );
  }
  const now = Date.now();
  const state = await loadState(context.env);
  return json(present(catalog, state, now));
};
