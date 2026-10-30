import "@fontsource/nunito/latin-ext-400.css";
import "@fontsource/nunito/latin-ext-600.css";
import "@fontsource/nunito/latin-ext-700.css";
import "@fontsource/nunito/latin-ext-800.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchOffice, postDecision, rememberToken } from "./api";
import { demoState } from "./demo";
import { FallbackRoom } from "./scene/Fallback";
import { OfficeScene, webglAvailable } from "./scene/OfficeScene";
import {
  KINDS,
  PALETTE,
  addItem,
  defaultLayout,
  parseLayout,
  removeItem,
  rotateItem,
  type LayoutItem,
} from "../shared/layout";
import {
  STATUS_META,
  ageLabel,
  catalog,
  emptyState,
  formatClock,
  present,
  resolveLight,
  type BotView,
  type LightChoice,
  type OfficeState,
  type OfficeView,
} from "../shared/office";

const LIGHTS: Array<{ id: LightChoice; label: string }> = [
  { id: "now", label: "Agora" },
  { id: "day", label: "Dia" },
  { id: "evening", label: "Tarde" },
  { id: "night", label: "Noite" },
];

const ALIASES: Record<string, LightChoice> = {
  now: "now",
  agora: "now",
  day: "day",
  dia: "day",
  evening: "evening",
  tarde: "evening",
  night: "night",
  noite: "night",
};

const LAYOUT_KEY = "mindness-office-layout";

function loadLayout(): LayoutItem[] {
  try {
    const stored = localStorage.getItem(LAYOUT_KEY);
    const parsed = stored ? parseLayout(stored) : null;
    if (parsed) return parsed;
  } catch {
    /* usa o arquivo */
  }
  return defaultLayout.items;
}

const LEGEND = [
  ["Trabalhando", STATUS_META.working.color],
  ["Pesquisando", STATUS_META.browsing.color],
  ["Pensando", STATUS_META.thinking.color],
  ["Precisa de você", STATUS_META.needs_you.color],
  ["Erro", STATUS_META.error.color],
  ["Concluído", STATUS_META.done.color],
  ["Parado", STATUS_META.idle.color],
  ["Dormindo", STATUS_META.sleeping.color],
  ["Home office", STATUS_META.home_office.color],
] as const;

export function App() {
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const demo = params.get("demo") === "1";
  const [light, setLight] = useState<LightChoice>(ALIASES[params.get("luz") ?? ""] ?? "now");
  const [recording, setRecording] = useState(params.get("gravacao") === "1");
  const [office, setOffice] = useState<OfficeState>(() => (demo ? demoState(Date.now()) : emptyState()));
  const [authorized, setAuthorized] = useState(demo);
  const [gate, setGate] = useState<"token" | "offline" | null>(null);
  const [selected, setSelected] = useState<string | null>("agente-outbound");
  const [toast, setToast] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [tall, setTall] = useState(false);
  const [editing, setEditing] = useState(false);
  const [layout, setLayout] = useState<LayoutItem[]>(loadLayout);
  const [picked, setPicked] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const reduced = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const gl = useMemo(() => webglAvailable(), []);
  const view = present(catalog, office, now);
  const time = resolveLight(light, new Date(now));

  useEffect(() => {
    rememberToken(params);
  }, [params]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    const stage = document.querySelector(".viewport");
    if (!stage) return;
    const observer = new ResizeObserver(() => {
      const rect = stage.getBoundingClientRect();
      setTall(recording || rect.width / Math.max(1, rect.height) < 0.9);
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [recording, authorized]);

  useEffect(() => {
    const next = new URLSearchParams(location.search);
    if (demo) next.set("demo", "1");
    if (recording) next.set("gravacao", "1");
    else next.delete("gravacao");
    if (light === "now") next.delete("luz");
    else next.set("luz", light);
    const text = next.toString();
    history.replaceState(null, "", text ? `${location.pathname}?${text}` : location.pathname);
  }, [demo, light, recording]);

  useEffect(() => {
    if (demo) return;
    let stop = false;
    const load = async () => {
      const result = await fetchOffice();
      if (stop) return;
      if (!result.ok) {
        setAuthorized(false);
        setGate(result.status === 401 ? "token" : "offline");
        return;
      }
      setAuthorized(true);
      setGate(null);
      setOffice(viewToState(result.view));
    };
    void load();
    const timer = window.setInterval(() => void load(), 20_000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [demo]);

  useEffect(() => {
    if (recording) setEditing(false);
  }, [recording]);

  useEffect(() => {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify({ version: 1, items: layout }));
  }, [layout]);

  useEffect(() => {
    if (!editing) return;
    const onKey = (event: KeyboardEvent) => {
      if (!picked) return;
      if (event.key === "r" || event.key === "R") {
        setLayout((items) => rotateItem(items, picked) ?? items);
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        setLayout((items) => removeItem(items, picked));
        setPicked(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, picked]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const bot = view.bots.find((item) => item.id === selected) ?? view.bots[0] ?? null;

  async function decide(decision: "approve" | "decline") {
    if (!bot || bot.areaKind === "home") return;
    if (demo) {
      setOffice((current) => ({
        ...current,
        answers: { ...current.answers, [bot.id]: { decision, ts: Date.now() } },
      }));
      setToast(decision === "approve" ? "Aprovado só nesta sessão DEMO. Nada saiu do navegador." : "Recusado só nesta sessão DEMO. Nada saiu do navegador.");
      return;
    }
    const result = await postDecision(bot.id, decision);
    setToast(result.message);
    if (!result.ok) return;
    const fresh = await fetchOffice();
    if (fresh.ok) setOffice(viewToState(fresh.view));
  }

  return (
    <div className={`app ${recording ? "recording" : ""}`}>
      <header className="topbar">
        <div className="brand">
          <span className="mark" aria-hidden="true" />
          <div>
            <p className="word">Escritório Mindness</p>
            <p className="sub">Chief, Prospecção e home office</p>
          </div>
        </div>
        <div className="counts">
          <Pill color={STATUS_META.working.color} value={view.counts.working} label="Trabalhando" />
          <Pill color={STATUS_META.needs_you.color} value={view.counts.needsYou} label="Precisa de você" hot={view.counts.needsYou > 0} />
          <Pill color={STATUS_META.idle.color} value={view.counts.idle} label="Parados" />
          <Pill color="#d7deea" value={view.counts.freeDesks} label="Mesas livres" />
        </div>
        {!recording ? (
          <button type="button" className={`record ${editing ? "on" : ""}`} aria-pressed={editing} onClick={() => setEditing((value) => !value)}>
            Editar
          </button>
        ) : null}
        <button type="button" className={`record ${recording ? "on" : ""}`} aria-pressed={recording} onClick={() => setRecording((value) => !value)}>
          Gravação 9:16
        </button>
      </header>
      {demo ? (
        <div className="demo-bar">
          <strong>DEMO</strong>
          <span>Status simulado neste navegador. Nada foi gravado e nenhum bot real está ligado.</span>
        </div>
      ) : null}
      <div className="stage-card">
        {demo ? <div className="stamp">DEMO</div> : null}
        <div className="viewport">
          {gl ? (
            <OfficeScene
              view={view}
              time={time}
              selected={bot?.id ?? null}
              sway={recording && !reduced}
              tall={tall || recording}
              reduced={reduced}
              editing={editing && !recording}
              items={layout}
              picked={picked}
              onPick={setPicked}
              onItems={setLayout}
              onSelect={setSelected}
              fallback={<FallbackRoom view={view} onSelect={setSelected} />}
            />
          ) : (
            <FallbackRoom view={view} onSelect={setSelected} />
          )}
        </div>
        <div className="stage-foot">
          <div className="keys">
            {LEGEND.map(([label, color]) => (
              <span key={label}><i style={{ background: color }} />{label}</span>
            ))}
          </div>
          <div className="lights">
            {LIGHTS.map((item) => (
              <button key={item.id} type="button" className={light === item.id ? "on" : ""} onClick={() => setLight(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
        {editing && !recording ? (
          <div className="editor">
            <p>Arraste no chão. A grade é de 0,4 m. R gira o selecionado.</p>
            <div className="palette">
              {PALETTE.map((kind) => (
                <button key={kind} type="button" onClick={() => {
                  const next = addItem(layout, kind);
                  if (!next) {
                    setToast("Sem espaço livre para esse móvel.");
                    return;
                  }
                  setLayout(next);
                  setPicked(next[next.length - 1]?.id ?? null);
                }}>
                  {KINDS[kind].label}
                </button>
              ))}
            </div>
            <div className="editor-actions">
              <button type="button" onClick={() => picked && setLayout((items) => rotateItem(items, picked) ?? items)}>Girar</button>
              <button type="button" onClick={() => {
                if (!picked) return;
                setLayout((items) => removeItem(items, picked));
                setPicked(null);
              }}>Apagar</button>
              <button type="button" onClick={() => {
                const blob = new Blob([JSON.stringify({ version: 1, items: layout }, null, 2)], { type: "application/json" });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = "layout.json";
                link.click();
                URL.revokeObjectURL(link.href);
              }}>Exportar</button>
              <button type="button" onClick={() => fileRef.current?.click()}>Importar</button>
              <button type="button" onClick={() => {
                localStorage.removeItem(LAYOUT_KEY);
                setLayout(defaultLayout.items);
                setPicked(null);
              }}>Padrão</button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  void file.text().then((text) => {
                    const parsed = parseLayout(text);
                    if (!parsed) {
                      setToast("Arquivo de layout inválido.");
                      return;
                    }
                    setLayout(parsed);
                    setPicked(null);
                  });
                }}
              />
            </div>
          </div>
        ) : null}
        {recording ? (
          <ol className="ticker">
            {view.activity.slice(0, 3).map((item) => {
              const who = view.bots.find((entry) => entry.id === item.bot);
              return (
                <li key={item.id}>
                  <time>{formatClock(item.ts)}</time>
                  <b>{who?.short ?? item.bot}</b>
                  <span>{item.note || item.task}</span>
                </li>
              );
            })}
          </ol>
        ) : null}
      </div>
      <aside className="sidebar">
        <section className="team">
          <h2>Time <small>{view.bots.length}</small></h2>
          {catalog.areas.map((area) => (
            <div key={area.id}>
              <h3>{area.name}</h3>
              {view.bots.filter((item) => item.area === area.id).map((item) => (
                <button key={item.id} type="button" className={`bot ${item.id === bot?.id ? "on" : ""}`} onClick={() => setSelected(item.id)}>
                  <i style={{ background: item.color }} />
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.note || item.task || item.role}</small>
                  </span>
                  <em style={{ color: STATUS_META[item.status].color }}>{STATUS_META[item.status].label}</em>
                </button>
              ))}
            </div>
          ))}
        </section>
        <section className="detail">{bot ? <Detail bot={bot} now={now} demo={demo} activity={view.activity} onDecide={(choice) => void decide(choice)} /> : null}</section>
        <section className="activity">
          <h2>Atividade <small>mais recente primeiro</small></h2>
          {view.activity.length ? (
            <ul>
              {view.activity.slice(0, 40).map((item) => {
                const who = view.bots.find((entry) => entry.id === item.bot);
                return (
                  <li key={item.id}>
                    <time>{formatClock(item.ts)}</time>
                    <b>{who?.short ?? item.bot}</b>
                    <em style={{ color: STATUS_META[item.status].color }}>{STATUS_META[item.status].label}</em>
                    <span>{item.note || item.task || ""}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="empty">Nenhum ping ainda.</p>
          )}
        </section>
      </aside>
      {!authorized ? (
        <div className="gate">
          <div>
            <h2>{gate === "offline" ? "API desligada" : "Escritório interno"}</h2>
            {gate === "offline" ? (
              <p>Sobe o escritório com <code>npm run pages</code> ou abre o <a href="?demo=1">modo DEMO</a>.</p>
            ) : (
              <p>Entra com <code>?token=</code> ou pelo Cloudflare Access. Os status não são públicos. <a href="?demo=1">Ver a sala em modo DEMO</a>.</p>
            )}
          </div>
        </div>
      ) : null}
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
  );
}

function Pill({ color, value, label, hot = false }: { color: string; value: number; label: string; hot?: boolean }) {
  return (
    <span className={`pill ${hot ? "hot" : ""}`}>
      <i style={{ background: color }} />
      <b>{value}</b> {label}
    </span>
  );
}

function Detail({ bot, now, demo, activity, onDecide }: { bot: BotView; now: number; demo: boolean; activity: OfficeView["activity"]; onDecide: (decision: "approve" | "decline") => void }) {
  const meta = STATUS_META[bot.status];
  if (bot.areaKind === "home") {
    return (
      <>
        <h2>{bot.name}</h2>
        <p className="role">{bot.role}</p>
        <p className="home-note">Este bot fica no home office e não envia status. Para dar uma mesa a ele, mude <code>area</code> e <code>reports</code> em <code>data/bots.json</code>.</p>
      </>
    );
  }
  const steps = bot.steps ?? [];
  const step = bot.step ?? 1;
  const width = steps.length ? Math.min(100, Math.round(((bot.status === "done" ? steps.length : Math.max(0, step - 1)) / steps.length) * 100)) : 0;
  const history = activity.filter((item) => item.bot === bot.id).slice(0, 5);
  return (
    <>
      <header className="who">
        <i style={{ background: bot.color }} />
        <div>
          <h2>{bot.name}</h2>
          <p className="role">{bot.role} · {bot.ts ? ageLabel(bot.ts, now) : "sem ping"}</p>
        </div>
        <em style={{ color: meta.color }}>{meta.label}</em>
      </header>
      <p className="task">{bot.task || "Sem tarefa reportada"}</p>
      {steps.length ? <p className="step-label">etapa {Math.min(step, steps.length)} de {steps.length}</p> : null}
      {steps.length ? <div className="bar" aria-hidden="true"><span style={{ width: `${width}%` }} /></div> : null}
      {bot.note ? <p className="note">{bot.note}</p> : null}
      {steps.length ? (
        <ol className="steps">
          {steps.map((item, index) => {
            const n = index + 1;
            const cls = bot.status === "done" || n < step ? "done" : n === step ? "now" : "";
            return (
              <li key={item} className={cls}>
                {history[index] ? <time>{formatClock(history[index].ts)}</time> : null}
                {item}
              </li>
            );
          })}
        </ol>
      ) : null}
      {history.length ? (
        <ul className="timed">
          {history.map((item) => (
            <li key={item.id}><time>{formatClock(item.ts)}</time><span>{item.note || item.task}</span></li>
          ))}
        </ul>
      ) : null}
      <div className="actions">
        <button type="button" className="approve" onClick={() => onDecide("approve")}>Aprovar</button>
        <button type="button" className="decline" onClick={() => onDecide("decline")}>Recusar</button>
      </div>
      <p className="fine">Isto só grava a resposta no escritório. Nada é enviado — sem mensagem, e-mail ou post. O bot lê na próxima chamada a <code>/api/answer</code>.</p>
      {bot.answer ? (
        <p className="saved">{bot.answer.decision === "approve" ? "Aprovado" : "Recusado"} · {formatClock(bot.answer.ts)}{demo ? " · DEMO, nesta sessão" : ""}.</p>
      ) : null}
    </>
  );
}

function viewToState(view: OfficeView): OfficeState {
  return {
    bots: Object.fromEntries(
      view.bots
        .filter((bot) => bot.reportedStatus && bot.ts)
        .map((bot) => [bot.id, { status: bot.reportedStatus!, task: bot.task, step: bot.step, steps: bot.steps, note: bot.note, ts: bot.ts! }]),
    ),
    answers: Object.fromEntries(view.bots.filter((bot) => bot.answer).map((bot) => [bot.id, bot.answer!])),
    activity: view.activity,
  };
}
