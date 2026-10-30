import rawCatalog from "../data/bots.json";

export const IDLE_AFTER_MS = 15 * 60 * 1000;
export const SLEEP_AFTER_MS = 2 * 60 * 60 * 1000;
export const ACTIVITY_LIMIT = 200;
export const KV_KEY = "office:v1";

export const REPORT_STATUSES = [
  "working",
  "browsing",
  "terminal",
  "thinking",
  "needs_you",
  "error",
  "done",
  "idle",
] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];
export type EffectiveStatus = ReportStatus | "sleeping" | "home_office";
export type AreaKind = "office" | "floor" | "home";
export type BotMark = "crown" | "glass" | "plane" | "book" | "headset";
export type LightChoice = "now" | "day" | "evening" | "night";
export type TimeOfDay = "day" | "evening" | "night";

export type Grid = { x: number; y: number; w: number; d: number };

export type Area = {
  id: string;
  name: string;
  kind: AreaKind;
  capacity?: number;
  blurb?: string;
  windows?: number[];
  grid: Grid;
  gridPortrait?: Grid;
};

export type Bot = {
  id: string;
  name: string;
  short: string;
  role: string;
  area: string;
  reports: boolean;
  color: string;
  accent: string;
  mark?: BotMark;
};

export type Catalog = { areas: Area[]; bots: Bot[] };

export type Report = {
  status: ReportStatus;
  task?: string;
  step?: number;
  steps?: string[];
  note?: string;
  ts: number;
};

export type Answer = {
  decision: "approve" | "decline";
  ts: number;
};

export type Activity = {
  id: string;
  bot: string;
  status: ReportStatus;
  task?: string;
  note?: string;
  ts: number;
};

export type OfficeState = {
  bots: Record<string, Report>;
  answers: Record<string, Answer>;
  activity: Activity[];
};

export type BotView = Bot & {
  areaKind: AreaKind;
  areaName: string;
  reportedStatus: ReportStatus | null;
  status: EffectiveStatus;
  task?: string;
  step?: number;
  steps?: string[];
  note?: string;
  ts: number | null;
  answer: Answer | null;
};

export type OfficeView = {
  now: number;
  bots: BotView[];
  activity: Activity[];
  counts: {
    working: number;
    needsYou: number;
    idle: number;
    sleeping: number;
    freeDesks: number;
    homeOffice: number;
    error: number;
    done: number;
  };
};

export const catalog = rawCatalog as Catalog;

const ACTIVE = new Set<EffectiveStatus>(["working", "browsing", "terminal", "thinking"]);

export const STATUS_META: Record<EffectiveStatus, { label: string; color: string }> = {
  working: { label: "Codando", color: "#3dd68c" },
  browsing: { label: "Navegando", color: "#58a6ff" },
  terminal: { label: "No terminal", color: "#3dbea5" },
  thinking: { label: "Pensando", color: "#c9a0ff" },
  needs_you: { label: "Precisa de você", color: "#ffb020" },
  error: { label: "Erro", color: "#ff5d5d" },
  done: { label: "Feito", color: "#7dcea0" },
  idle: { label: "Idle", color: "#9aa4b8" },
  sleeping: { label: "Dormindo", color: "#8b93b0" },
  home_office: { label: "Home office", color: "#d7b48a" },
};

export function emptyState(): OfficeState {
  return { bots: {}, answers: {}, activity: [] };
}

export function areaById(source: Catalog, id: string): Area | undefined {
  return source.areas.find((area) => area.id === id);
}

export function areaOf(source: Catalog, bot: Bot): Area | undefined {
  return areaById(source, bot.area);
}

export function findBot(source: Catalog, nameOrId: string): Bot | undefined {
  const key = nameOrId.trim().toLowerCase();
  return source.bots.find(
    (bot) => bot.id.toLowerCase() === key || bot.name.toLowerCase() === key,
  );
}

export function isReportStatus(value: string): value is ReportStatus {
  return (REPORT_STATUSES as readonly string[]).includes(value);
}

export function effectiveStatus(area: Area | undefined, report: Report | undefined, now: number): EffectiveStatus {
  if (!area || area.kind === "home") return "home_office";
  if (!report || !Number.isFinite(report.ts)) return "sleeping";
  const age = now - report.ts;
  if (age >= SLEEP_AFTER_MS) return "sleeping";
  if (age >= IDLE_AFTER_MS) return "idle";
  return report.status;
}

export function freeDesks(source: Catalog): number {
  let free = 0;
  for (const area of source.areas) {
    if (area.kind === "home") continue;
    const used = source.bots.filter((bot) => bot.area === area.id).length;
    const capacity = area.capacity ?? used;
    free += Math.max(0, capacity - used);
  }
  return free;
}

export function present(source: Catalog, state: OfficeState, now: number): OfficeView {
  const bots: BotView[] = source.bots.map((bot) => {
    const area = areaOf(source, bot);
    const report = state.bots[bot.id];
    const status = effectiveStatus(area, report, now);
    const showWork = status !== "home_office";
    return {
      ...bot,
      areaKind: area?.kind ?? "home",
      areaName: area?.name ?? "Home office",
      reportedStatus: report?.status ?? null,
      status,
      task: showWork ? report?.task : undefined,
      step: showWork ? report?.step : undefined,
      steps: showWork ? report?.steps : undefined,
      note: showWork ? report?.note : undefined,
      ts: report?.ts ?? null,
      answer: state.answers[bot.id] ?? null,
    };
  });

  const counts = {
    working: bots.filter((bot) => ACTIVE.has(bot.status)).length,
    needsYou: bots.filter((bot) => bot.status === "needs_you").length,
    idle: bots.filter((bot) => bot.status === "idle").length,
    sleeping: bots.filter((bot) => bot.status === "sleeping").length,
    freeDesks: freeDesks(source),
    homeOffice: bots.filter((bot) => bot.status === "home_office").length,
    error: bots.filter((bot) => bot.status === "error").length,
    done: bots.filter((bot) => bot.status === "done").length,
  };

  return {
    now,
    bots,
    activity: state.activity.slice(0, ACTIVITY_LIMIT),
    counts,
  };
}

export type StatusInput = {
  bot?: unknown;
  status?: unknown;
  task?: unknown;
  step?: unknown;
  steps?: unknown;
  note?: unknown;
  ts?: unknown;
};

export type ApplyOk = {
  ok: true;
  state: OfficeState;
  bot: Bot;
  warning?: string;
  displayed: EffectiveStatus;
};

export type ApplyErr = { ok: false; error: string; message: string; status: number };

function cleanText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/[\u0000-\u001f]+/g, " ").trim();
  if (!text) return undefined;
  return text.slice(0, max);
}

function cleanSteps(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const steps = value
    .map((item) => cleanText(item, 120))
    .filter((item): item is string => Boolean(item))
    .slice(0, 8);
  return steps.length ? steps : undefined;
}

function cleanTs(value: unknown, now: number): number {
  let ts = typeof value === "number" && Number.isFinite(value) ? value : now;
  if (ts > 0 && ts < 1e12) ts *= 1000;
  if (ts > now + 60_000) ts = now;
  if (ts < 0) ts = now;
  return Math.round(ts);
}

export function applyReport(
  source: Catalog,
  state: OfficeState,
  input: StatusInput,
  now: number,
  id: string,
): ApplyOk | ApplyErr {
  if (typeof input.bot !== "string" || !input.bot.trim()) {
    return { ok: false, error: "bad_bot", message: "Informe o campo bot.", status: 400 };
  }
  const bot = findBot(source, input.bot);
  if (!bot) {
    return {
      ok: false,
      error: "unknown_bot",
      message: "Bot desconhecido. Use um id de data/bots.json.",
      status: 400,
    };
  }
  if (typeof input.status !== "string" || !isReportStatus(input.status)) {
    return {
      ok: false,
      error: "bad_status",
      message: `Status inválido. Use: ${REPORT_STATUSES.join(", ")}. Sleeping e home office são derivados.`,
      status: 400,
    };
  }

  const steps = cleanSteps(input.steps);
  let step = typeof input.step === "number" && Number.isFinite(input.step) ? Math.round(input.step) : undefined;
  if (step !== undefined) step = Math.max(1, Math.min(step, steps?.length ?? 99));
  if (step === undefined && steps && input.status === "done") step = steps.length;

  const report: Report = {
    status: input.status,
    task: cleanText(input.task, 180),
    step,
    steps,
    note: cleanText(input.note, 280),
    ts: cleanTs(input.ts, now),
  };

  const next: OfficeState = {
    bots: { ...state.bots, [bot.id]: report },
    answers: state.answers,
    activity: [
      {
        id,
        bot: bot.id,
        status: report.status,
        task: report.task,
        note: report.note,
        ts: report.ts,
      },
      ...state.activity,
    ].slice(0, ACTIVITY_LIMIT),
  };

  const area = areaOf(source, bot);
  const displayed = effectiveStatus(area, report, now);
  const warning =
    area?.kind === "home"
      ? "Este bot está no home office e não aparece com status na sala. Mude area em data/bots.json para colocá-lo numa mesa."
      : undefined;

  return { ok: true, state: next, bot, warning, displayed };
}

export function applyDecision(
  source: Catalog,
  state: OfficeState,
  botName: unknown,
  decision: unknown,
  now: number,
): ApplyOk | ApplyErr {
  if (typeof botName !== "string" || !botName.trim()) {
    return { ok: false, error: "bad_bot", message: "Informe o campo bot.", status: 400 };
  }
  const bot = findBot(source, botName);
  if (!bot) {
    return { ok: false, error: "unknown_bot", message: "Bot desconhecido.", status: 400 };
  }
  if (decision !== "approve" && decision !== "decline") {
    return { ok: false, error: "bad_decision", message: "Use decision approve ou decline.", status: 400 };
  }
  const answer: Answer = { decision, ts: now };
  const next: OfficeState = {
    bots: state.bots,
    answers: { ...state.answers, [bot.id]: answer },
    activity: state.activity,
  };
  const area = areaOf(source, bot);
  return {
    ok: true,
    state: next,
    bot,
    displayed: effectiveStatus(area, state.bots[bot.id], now),
    warning:
      area?.kind === "home"
        ? "A resposta ficou gravada, mas este bot está no home office e não consulta o escritório."
        : undefined,
  };
}

export function lintCatalog(source: Catalog): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const areaIds = new Set(source.areas.map((area) => area.id));
  if (!source.areas.some((area) => area.kind === "home")) problems.push("falta uma área kind=home");
  if (!source.areas.some((area) => area.kind === "office")) problems.push("falta uma área kind=office");
  if (!source.areas.some((area) => area.kind === "floor")) problems.push("falta uma área kind=floor");
  for (const bot of source.bots) {
    if (ids.has(bot.id)) problems.push(`id duplicado: ${bot.id}`);
    ids.add(bot.id);
    if (!areaIds.has(bot.area)) problems.push(`${bot.id} aponta para área inexistente ${bot.area}`);
    const area = areaOf(source, bot);
    if (area?.kind === "home" && bot.reports) problems.push(`${bot.id} está no home office mas reports=true`);
    if (area && area.kind !== "home" && !bot.reports) problems.push(`${bot.id} tem mesa mas reports=false`);
  }
  return problems;
}

export function lightFromClock(date = new Date()): TimeOfDay {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "America/Sao_Paulo",
    }).format(date),
  );
  if (hour >= 6 && hour < 17) return "day";
  if (hour >= 17 && hour < 20) return "evening";
  return "night";
}

export function resolveLight(choice: LightChoice, date = new Date()): TimeOfDay {
  return choice === "now" ? lightFromClock(date) : choice;
}

export function formatClock(ts: number): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(ts));
}

export function ageLabel(ts: number | null, now: number): string {
  if (!ts) return "sem ping";
  const seconds = Math.max(0, now - ts) / 1000;
  if (seconds < 45) return "agora";
  if (seconds < 3600) return `há ${Math.max(1, Math.floor(seconds / 60))} min`;
  if (seconds < 86400) return `há ${Math.floor(seconds / 3600)} h`;
  return `há ${Math.floor(seconds / 86400)} d`;
}

export function gridFor(area: Area, portrait: boolean): Grid {
  return portrait && area.gridPortrait ? area.gridPortrait : area.grid;
}
