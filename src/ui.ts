import {
  STATUS_META,
  ageLabel,
  catalog,
  formatClock,
  type BotView,
  type EffectiveStatus,
  type LightChoice,
  type OfficeView,
} from "../shared/office";
import type { Frame } from "./render/scene";

export type UiState = {
  demo: boolean;
  recording: boolean;
  light: LightChoice;
  view: OfficeView;
  selected: string | null;
  authorized: boolean;
  gate: "token" | "offline" | null;
  toast: string;
};

const LIGHTS: Array<{ id: LightChoice; label: string }> = [
  { id: "now", label: "Agora" },
  { id: "day", label: "Dia" },
  { id: "evening", label: "Tarde" },
  { id: "night", label: "Noite" },
];

export type Shell = {
  stage: HTMLElement;
  canvas: HTMLCanvasElement;
  update(state: UiState): void;
  place(frame: Frame, view: OfficeView, hover: string | null): void;
  onSelect(handler: (id: string) => void): void;
  onDecide(handler: (decision: "approve" | "decline") => void): void;
  onLight(handler: (light: LightChoice) => void): void;
  onRecord(handler: () => void): void;
};

export function mount(root: HTMLElement): Shell {
  root.innerHTML = `
    <div class="app">
      <header class="topbar">
        <div class="brand">
          <span class="mark" aria-hidden="true"></span>
          <div>
            <p class="word">Escritório Mindness</p>
            <p class="sub">Chief, Prospecção e home office</p>
          </div>
        </div>
        <div class="counts"></div>
        <button type="button" class="record">Gravação 9:16</button>
      </header>
      <div class="demo-bar" hidden>
        <strong>DEMO</strong>
        <span>Status simulado neste navegador. Nada foi gravado e nenhum bot real está ligado.</span>
      </div>
      <div class="stage">
        <canvas aria-label="Sala isométrica dos bots"></canvas>
        <div class="stamp" hidden>DEMO</div>
        <div class="labels"></div>
        <div class="bubbles"></div>
        <div class="tooltip" hidden></div>
      </div>
      <aside class="sidebar">
        <section class="team"></section>
        <section class="detail"></section>
        <section class="activity"></section>
      </aside>
      <footer class="legend">
        <div class="keys"></div>
        <div class="lights"></div>
      </footer>
      <div class="gate" hidden></div>
      <div class="toast" hidden role="status"></div>
    </div>
  `;

  const app = root.querySelector(".app") as HTMLElement;
  const stage = root.querySelector(".stage") as HTMLElement;
  const canvas = root.querySelector("canvas") as HTMLCanvasElement;
  const counts = root.querySelector(".counts") as HTMLElement;
  const team = root.querySelector(".team") as HTMLElement;
  const detail = root.querySelector(".detail") as HTMLElement;
  const activity = root.querySelector(".activity") as HTMLElement;
  const keys = root.querySelector(".keys") as HTMLElement;
  const lights = root.querySelector(".lights") as HTMLElement;
  const labels = root.querySelector(".labels") as HTMLElement;
  const bubbles = root.querySelector(".bubbles") as HTMLElement;
  const tooltip = root.querySelector(".tooltip") as HTMLElement;
  const gate = root.querySelector(".gate") as HTMLElement;
  const toast = root.querySelector(".toast") as HTMLElement;
  const demoBar = root.querySelector(".demo-bar") as HTMLElement;
  const stamp = root.querySelector(".stamp") as HTMLElement;
  const record = root.querySelector(".record") as HTMLButtonElement;

  let onSelect: (id: string) => void = () => {};
  let onDecide: (decision: "approve" | "decline") => void = () => {};
  let onLight: (light: LightChoice) => void = () => {};
  let onRecord: () => void = () => {};
  let lastView: OfficeView | null = null;

  keys.innerHTML = (Object.keys(STATUS_META) as EffectiveStatus[])
    .map((status) => {
      const meta = STATUS_META[status];
      return `<span><i style="background:${meta.color}"></i>${esc(meta.label)}</span>`;
    })
    .join("");

  lights.innerHTML = LIGHTS.map(
    (item) => `<button type="button" data-light="${item.id}">${item.label}</button>`,
  ).join("");

  record.addEventListener("click", () => onRecord());
  lights.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest("button");
    const choice = button?.getAttribute("data-light") as LightChoice | null;
    if (choice) onLight(choice);
  });
  team.addEventListener("click", (event) => {
    const row = (event.target as HTMLElement).closest("[data-bot]");
    const id = row?.getAttribute("data-bot");
    if (id) onSelect(id);
  });
  detail.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest("button");
    const decision = button?.getAttribute("data-decision");
    if (decision === "approve" || decision === "decline") onDecide(decision);
  });

  function update(state: UiState): void {
    document.body.classList.toggle("recording", state.recording);
    document.body.classList.toggle("demo", state.demo);
    app.classList.toggle("locked", !state.authorized);
    demoBar.hidden = !state.demo;
    stamp.hidden = !state.demo;
    record.classList.toggle("on", state.recording);
    record.setAttribute("aria-pressed", state.recording ? "true" : "false");
    for (const button of lights.querySelectorAll("button")) {
      button.classList.toggle("on", button.getAttribute("data-light") === state.light);
    }

    const c = state.view.counts;
    counts.innerHTML = [
      pill(STATUS_META.working.color, String(c.working), "Trabalhando", "Codando, navegando, no terminal ou pensando"),
      pill(STATUS_META.needs_you.color, String(c.needsYou), "Precisa de você"),
      pill(STATUS_META.idle.color, String(c.idle), "Idle"),
      pill(STATUS_META.sleeping.color, String(c.sleeping), "Dormindo"),
      pill("#d7deea", String(c.freeDesks), "Mesas livres"),
    ].join("");

    team.innerHTML = catalog.areas
      .map((area) => {
        const bots = state.view.bots.filter((bot) => bot.area === area.id);
        return `<h2>${esc(area.name)}</h2><p class="blurb">${esc(area.blurb || "")}</p><div class="rows">${bots
          .map((bot) => row(bot, state.selected, state.view.now))
          .join("")}</div>`;
      })
      .join("");

    const selected = state.view.bots.find((bot) => bot.id === state.selected) ?? null;
    detail.innerHTML = selected ? renderDetail(selected, state.view.now, state.demo) : `<p class="empty">Escolhe um bot na sala ou na lista.</p>`;

    activity.innerHTML = `<h2>Atividade</h2>${
      state.view.activity.length
        ? `<ul>${state.view.activity
            .slice(0, 40)
            .map((item) => {
              const bot = state.view.bots.find((entry) => entry.id === item.bot);
              const meta = STATUS_META[item.status];
              return `<li><time>${esc(formatClock(item.ts))}</time><b>${esc(bot?.short || item.bot)}</b><em style="color:${meta.color}">${esc(meta.label)}</em><span>${esc(item.note || item.task || "")}</span></li>`;
            })
            .join("")}</ul>`
        : `<p class="empty">Nenhum ping ainda.</p>`
    }`;

    gate.hidden = state.authorized;
    gate.innerHTML = state.authorized
      ? ""
      : state.gate === "offline"
        ? `<div><h2>API desligada</h2><p>Sobe o escritório com <code>npm run pages</code> ou abre o <a href="?demo=1">modo DEMO</a>.</p></div>`
        : `<div><h2>Escritório interno</h2><p>Entra com <code>?token=</code> ou pelo Cloudflare Access. Os status não são públicos.</p><p><a href="?demo=1">Ver a sala em modo DEMO</a></p></div>`;

    toast.hidden = !state.toast;
    toast.textContent = state.toast;
    lastView = state.view;
    syncBubbles(lastView);
  }

  function syncBubbles(view: OfficeView): void {
    const needed = view.bots.filter((bot) => bot.status === "needs_you");
    const existing = new Set([...bubbles.querySelectorAll("[data-id]")].map((node) => node.getAttribute("data-id")));
    const next = new Set(needed.map((bot) => bot.id));
    if (existing.size === next.size && [...next].every((id) => existing.has(id))) {
      for (const bot of needed) {
        const node = bubbles.querySelector(`[data-id="${cssEscape(bot.id)}"]`);
        const text = node?.querySelector("p");
        if (text) text.textContent = bot.note || bot.task || "Precisa de um ok";
      }
      return;
    }
    bubbles.replaceChildren();
    for (const bot of needed) {
      const node = document.createElement("div");
      node.className = "bubble";
      node.dataset.id = bot.id;
      const name = document.createElement("strong");
      name.textContent = bot.short;
      const text = document.createElement("p");
      text.textContent = bot.note || bot.task || "Precisa de um ok";
      node.append(name, text);
      bubbles.append(node);
    }
  }

  function place(frame: Frame, view: OfficeView, hover: string | null): void {
    for (const label of frame.labels) {
      let node = labels.querySelector(`[data-id="${cssEscape(label.id)}"]`) as HTMLElement | null;
      if (!node) {
        node = document.createElement("div");
        node.className = "area-label";
        node.dataset.id = label.id;
        node.textContent = label.text;
        labels.append(node);
      }
      node.style.left = `${label.x}px`;
      node.style.top = `${label.y}px`;
    }
    for (const anchor of frame.anchors) {
      const node = bubbles.querySelector(`[data-id="${cssEscape(anchor.id)}"]`) as HTMLElement | null;
      if (!node) continue;
      node.style.left = `${anchor.x}px`;
      node.style.top = `${anchor.y}px`;
    }
    const hovered = hover ? view.bots.find((bot) => bot.id === hover) : undefined;
    const hit = hover ? frame.anchors.find((anchor) => anchor.id === hover) ?? frame.hits.find((item) => item.id === hover) : undefined;
    if (hovered && hit) {
      tooltip.hidden = false;
      tooltip.textContent = `${hovered.short} · ${STATUS_META[hovered.status].label}`;
      tooltip.style.left = `${hit.x}px`;
      tooltip.style.top = `${hit.y - 8}px`;
    } else {
      tooltip.hidden = true;
    }
  }

  return {
    stage,
    canvas,
    update,
    place,
    onSelect: (handler) => {
      onSelect = handler;
    },
    onDecide: (handler) => {
      onDecide = handler;
    },
    onLight: (handler) => {
      onLight = handler;
    },
    onRecord: (handler) => {
      onRecord = handler;
    },
  };
}

function pill(color: string, value: string, label: string, title?: string): string {
  return `<span class="pill" ${title ? `title="${esc(title)}"` : ""}><i style="background:${color}"></i><b>${esc(value)}</b> ${esc(label)}</span>`;
}

function row(bot: BotView, selected: string | null, now: number): string {
  const meta = STATUS_META[bot.status];
  return `<button type="button" class="bot ${bot.id === selected ? "on" : ""}" data-bot="${esc(bot.id)}">
    <i style="background:${esc(bot.color)}"></i>
    <span><strong>${esc(bot.name)}</strong><small>${esc(bot.role)}</small></span>
    <em style="color:${meta.color}">${esc(meta.label)}</em>
    <time>${esc(bot.areaKind === "home" ? "sem ping" : ageLabel(bot.ts, now))}</time>
  </button>`;
}

function renderDetail(bot: BotView, now: number, demo: boolean): string {
  const meta = STATUS_META[bot.status];
  if (bot.areaKind === "home") {
    return `<h2>${esc(bot.name)}</h2>
      <p class="role">${esc(bot.role)}</p>
      <p class="home-note">Este bot fica no home office e não envia status. Para dar uma mesa a ele, mude <code>area</code> e <code>reports</code> em <code>data/bots.json</code>.</p>`;
  }
  const steps = bot.steps ?? [];
  const step = bot.step ?? 1;
  const width = steps.length ? Math.min(100, Math.round(((bot.status === "done" ? steps.length : step - 1) / steps.length) * 100)) : 0;
  const answer = bot.answer
    ? `<p class="saved">${bot.answer.decision === "approve" ? "Aprovado" : "Recusado"} · ${esc(formatClock(bot.answer.ts))}. Gravado só aqui${demo ? " (DEMO, nesta sessão)" : ""}.</p>`
    : "";
  return `<h2>${esc(bot.name)}</h2>
    <p class="role">${esc(bot.role)} · <span style="color:${meta.color}">${esc(meta.label)}</span> · ${esc(ageLabel(bot.ts, now))}</p>
    <p class="task">${esc(bot.task || "Sem tarefa reportada")}</p>
    ${bot.note ? `<p class="note">${esc(bot.note)}</p>` : ""}
    ${
      steps.length
        ? `<div class="bar" aria-hidden="true"><span style="width:${width}%"></span></div>
      <ol class="steps">${steps
        .map((item, index) => {
          const n = index + 1;
          const cls = bot.status === "done" || n < step ? "done" : n === step ? "now" : "";
          return `<li class="${cls}">${esc(item)}</li>`;
        })
        .join("")}</ol>`
        : ""
    }
    <div class="actions">
      <button type="button" class="approve" data-decision="approve">Aprovar</button>
      <button type="button" class="decline" data-decision="decline">Recusar</button>
    </div>
    <p class="fine">Isto só grava a resposta no escritório. Nada é enviado — sem mensagem, e-mail ou post. O bot lê na próxima chamada a <code>/api/answer</code>.</p>
    ${answer}`;
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) =>
    char === "&" ? "&amp;" : char === "<" ? "&lt;" : char === ">" ? "&gt;" : char === '"' ? "&quot;" : "&#39;",
  );
}

function cssEscape(value: string): string {
  return typeof CSS !== "undefined" && CSS.escape ? CSS.escape(value) : value.replace(/"/g, '\\"');
}
