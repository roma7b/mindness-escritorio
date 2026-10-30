import "@fontsource/outfit/latin-ext-400.css";
import "@fontsource/outfit/latin-ext-500.css";
import "@fontsource/outfit/latin-ext-600.css";
import "@fontsource/outfit/latin-ext-700.css";
import "@fontsource/silkscreen/latin-ext-400.css";
import "./style.css";

import { postDecision, fetchOffice, rememberToken } from "./api";
import { demoState } from "./demo";
import { paint, type Frame } from "./render/scene";
import { mount, type UiState } from "./ui";
import {
  catalog,
  emptyState,
  present,
  resolveLight,
  type LightChoice,
  type OfficeState,
} from "../shared/office";

const params = new URLSearchParams(location.search);
const demo = params.get("demo") === "1";
rememberToken(params);

const lightAliases: Record<string, LightChoice> = {
  now: "now",
  agora: "now",
  day: "day",
  dia: "day",
  evening: "evening",
  tarde: "evening",
  night: "night",
  noite: "night",
};
let light: LightChoice = lightAliases[params.get("luz") ?? ""] ?? "now";
let recording = params.get("gravacao") === "1";
let state: OfficeState = demo ? demoState(Date.now()) : emptyState();
let authorized = demo;
let gate: UiState["gate"] = null;
let selected: string | null = "agente-outbound";
let toast = "";
let toastTimer = 0;
let frame: Frame = { hits: [], anchors: [], labels: [] };
let hover: string | null = null;
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const shell = mount(document.querySelector("#app") as HTMLElement);

function viewNow() {
  return present(catalog, state, Date.now());
}

function publish() {
  const view = viewNow();
  if (!view.bots.some((bot) => bot.id === selected)) selected = view.bots[0]?.id ?? null;
  shell.update({ demo, recording, light, view, selected, authorized, gate, toast });
}

function draw(time: number) {
  const portrait = recording || shell.stage.clientWidth / Math.max(1, shell.stage.clientHeight) < 0.95;
  frame = paint(shell.canvas, viewNow(), resolveLight(light), time, selected, portrait, reduced);
  shell.place(frame, viewNow(), hover);
}

function showToast(message: string) {
  toast = message;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast = "";
    publish();
  }, 4200);
  publish();
}

function setQuery() {
  const next = new URLSearchParams(location.search);
  if (demo) next.set("demo", "1");
  if (recording) next.set("gravacao", "1");
  else next.delete("gravacao");
  if (light !== "now") next.set("luz", light);
  else next.delete("luz");
  const text = next.toString();
  history.replaceState(null, "", text ? `${location.pathname}?${text}` : location.pathname);
}

shell.onSelect((id) => {
  selected = id;
  publish();
});
shell.onLight((choice) => {
  light = choice;
  setQuery();
  publish();
  draw(performance.now());
});
shell.onRecord(() => {
  recording = !recording;
  setQuery();
  publish();
  requestAnimationFrame(() => draw(performance.now()));
});
shell.onDecide(async (decision) => {
  const bot = viewNow().bots.find((item) => item.id === selected);
  if (!bot || bot.areaKind === "home") return;
  if (demo) {
    state = {
      ...state,
      answers: { ...state.answers, [bot.id]: { decision, ts: Date.now() } },
    };
    showToast(
      decision === "approve"
        ? "Aprovado só nesta sessão DEMO. Nada saiu do navegador."
        : "Recusado só nesta sessão DEMO. Nada saiu do navegador.",
    );
    return;
  }
  const result = await postDecision(bot.id, decision);
  showToast(result.message);
  if (result.ok) await refresh();
});

shell.canvas.addEventListener("click", (event) => {
  const id = hitAt(event);
  if (!id) return;
  selected = id;
  publish();
});
shell.canvas.addEventListener("mousemove", (event) => {
  const id = hitAt(event);
  hover = id;
  shell.canvas.style.cursor = id ? "pointer" : "default";
  shell.place(frame, viewNow(), hover);
});
shell.canvas.addEventListener("mouseleave", () => {
  hover = null;
  shell.place(frame, viewNow(), null);
});

function hitAt(event: MouseEvent): string | null {
  const rect = shell.canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const hit = frame.hits.find((item) => x >= item.x && y >= item.y && x <= item.x + item.w && y <= item.y + item.h);
  return hit?.id ?? null;
}

async function refresh() {
  if (demo) {
    authorized = true;
    gate = null;
    publish();
    return;
  }
  const result = await fetchOffice();
  if (result.ok) {
    authorized = true;
    gate = null;
    state = {
      bots: Object.fromEntries(
        result.view.bots
          .filter((bot) => bot.reportedStatus && bot.ts)
          .map((bot) => [
            bot.id,
            {
              status: bot.reportedStatus!,
              task: bot.task,
              step: bot.step,
              steps: bot.steps,
              note: bot.note,
              ts: bot.ts!,
            },
          ]),
      ),
      answers: Object.fromEntries(
        result.view.bots.filter((bot) => bot.answer).map((bot) => [bot.id, bot.answer!]),
      ),
      activity: result.view.activity,
    };
    publish();
    return;
  }
  authorized = false;
  gate = result.status === 401 ? "token" : "offline";
  publish();
}

let raf = 0;
function loop(time: number) {
  draw(time);
  raf = requestAnimationFrame(loop);
}

const resize = new ResizeObserver(() => draw(performance.now()));
resize.observe(shell.stage);

publish();
void refresh();
if (reduced) draw(performance.now());
else raf = requestAnimationFrame(loop);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) cancelAnimationFrame(raf);
  else if (!reduced) raf = requestAnimationFrame(loop);
});

if (!demo) window.setInterval(() => void refresh(), 20_000);
