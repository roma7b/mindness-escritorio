import { isReportStatus, type ReportStatus } from "./office";

export type ParsedEvent = {
  bot?: string;
  status: ReportStatus;
  task?: string;
  note?: string;
  step?: number;
  steps?: string[];
  ts: number;
  line: number;
};

const HINTS: Array<[RegExp, string]> = [
  [/caca[-_ ]?leads/, "caca-leads-social"],
  [/outbound/, "agente-outbound"],
  [/pesquisa/, "pesquisa"],
  [/copiloto|atendimento/, "copiloto-atendimento"],
  [/chief/, "chief-of-staff"],
];

export function botHintFromFilename(filename: string): string | undefined {
  const lower = filename.toLowerCase();
  for (const [pattern, id] of HINTS) {
    if (pattern.test(lower)) return id;
  }
  return undefined;
}

function field(rest: string, name: string): string | undefined {
  const quoted = new RegExp(`${name}="([^"]*)"`).exec(rest);
  if (quoted) return quoted[1].trim() || undefined;
  const plain = new RegExp(`${name}=([^\\s]+)`).exec(rest);
  return plain?.[1]?.trim() || undefined;
}

export function parseLog(markdown: string, filename = ""): ParsedEvent[] {
  const fallbackBot = botHintFromFilename(filename);
  const events: ParsedEvent[] = [];
  const lines = markdown.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    const match = /^-\s+(\S+)\s+status=([a-z_]+)\b(.*)$/i.exec(line);
    if (!match) continue;
    const status = match[2].toLowerCase();
    if (!isReportStatus(status)) continue;
    const ts = Date.parse(match[1]);
    if (!Number.isFinite(ts)) continue;
    const rest = match[3] ?? "";
    const stepsRaw = field(rest, "steps");
    const stepRaw = field(rest, "step");
    const step = stepRaw && Number.isFinite(Number(stepRaw)) ? Number(stepRaw) : undefined;
    events.push({
      bot: field(rest, "bot") ?? fallbackBot,
      status,
      task: field(rest, "task"),
      note: field(rest, "note"),
      step,
      steps: stepsRaw ? stepsRaw.split("|").map((item) => item.trim()).filter(Boolean) : undefined,
      ts,
      line: index + 1,
    });
  }
  return events;
}
