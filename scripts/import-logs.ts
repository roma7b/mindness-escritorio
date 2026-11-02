import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseLog, type ParsedEvent } from "../shared/log-parse";

type Args = { dir?: string; dryRun: boolean; sleepMs: number };

function args(): Args {
  const out: Args = { dryRun: false, sleepMs: 1100 };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--dry-run") out.dryRun = true;
    else if (token === "--dir") out.dir = argv[++i];
    else if (token === "--sleep-ms") out.sleepMs = Number(argv[++i]);
  }
  return out;
}

async function markdownFiles(dir: string): Promise<string[]> {
  const found: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await markdownFiles(full)));
    else if (entry.isFile() && entry.name.endsWith(".md")) found.push(full);
  }
  return found;
}

async function main(): Promise<void> {
  const options = args();
  if (!options.dir) {
    console.error("Uso: OFFICE_URL=... OFFICE_TOKEN=... npm run import-logs -- --dir ./outbound [--dry-run]");
    console.error("Exemplo de formato: scripts/fixtures/exemplo-disparos.md");
    process.exit(1);
  }
  const files = await markdownFiles(options.dir);
  const events: ParsedEvent[] = [];
  for (const file of files) {
    const text = await readFile(file, "utf8");
    events.push(...parseLog(text, file));
  }
  events.sort((a, b) => a.ts - b.ts);
  const missing = events.filter((event) => !event.bot);
  if (missing.length) {
    console.error(`${missing.length} linha(s) sem bot= e sem pista no nome do arquivo. Nada foi enviado.`);
    process.exit(1);
  }
  console.log(`${events.length} evento(s) em ${files.length} arquivo(s).`);
  if (events.length > 30) {
    console.log("Aviso: o plano free do KV permite 1.000 escritas por dia e 1 escrita por segundo na mesma chave.");
  }
  if (options.dryRun) {
    for (const event of events) console.log(JSON.stringify(event));
    return;
  }
  const officeUrl = process.env.OFFICE_URL;
  const token = process.env.OFFICE_TOKEN;
  if (!officeUrl || !token) {
    console.error("Defina OFFICE_URL e OFFICE_TOKEN no ambiente. O token não vai na linha de comando.");
    process.exit(1);
  }
  for (const event of events) {
    const response = await fetch(new URL("/api/status", officeUrl), {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        bot: event.bot,
        status: event.status,
        task: event.task,
        note: event.note,
        step: event.step,
        steps: event.steps,
        ts: event.ts,
      }),
    });
    const body = await response.text();
    if (!response.ok) {
      console.error(`Falhou ${response.status} na linha ${event.line}: ${body}`);
      process.exit(1);
    }
    console.log(`${event.bot} ${event.status} ${response.status}`);
    await new Promise((resolve) => setTimeout(resolve, options.sleepMs));
  }
}

await main();
