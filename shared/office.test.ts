import assert from "node:assert/strict";
import { test } from "node:test";
import {
  IDLE_AFTER_MS,
  SLEEP_AFTER_MS,
  ACTIVITY_LIMIT,
  applyDecision,
  applyReport,
  catalog,
  emptyState,
  freeDesks,
  lintCatalog,
  present,
  type Catalog,
  type OfficeState,
} from "./office";
import { parseLog } from "./log-parse";

const NOW = Date.parse("2026-10-30T18:00:00-03:00");

test("catálogo separa chief, prospecção e home office", () => {
  assert.deepEqual(lintCatalog(catalog), []);
  const byArea = (id: string) => catalog.bots.filter((bot) => bot.area === id).map((bot) => bot.id);
  assert.deepEqual(byArea("chief"), ["chief-of-staff"]);
  assert.deepEqual(byArea("prospeccao"), [
    "caca-leads-social",
    "agente-outbound",
    "pesquisa",
    "copiloto-atendimento",
  ]);
  assert.equal(catalog.bots.filter((bot) => bot.area === "home" && bot.reports).length, 0);
  assert.equal(freeDesks(catalog), 2);
  assert.equal(catalog.bots.find((bot) => bot.id === "chief-of-staff")?.name, "Chief of Staff · Mindness");
});

test("idle aos 15 min e sleeping às 2 h; home office ignora o ping", () => {
  let state = emptyState();
  const working = applyReport(catalog, state, { bot: "pesquisa", status: "browsing", ts: NOW }, NOW, "a");
  assert.equal(working.ok, true);
  if (!working.ok) return;
  state = working.state;
  const idle = applyReport(
    catalog,
    state,
    { bot: "caca-leads-social", status: "working", ts: NOW - IDLE_AFTER_MS - 1000 },
    NOW,
    "b",
  );
  assert.equal(idle.ok, true);
  if (!idle.ok) return;
  state = idle.state;
  const asleep = applyReport(
    catalog,
    state,
    { bot: "chief-of-staff", status: "done", ts: NOW - SLEEP_AFTER_MS - 1000 },
    NOW,
    "c",
  );
  assert.equal(asleep.ok, true);
  if (!asleep.ok) return;
  state = asleep.state;
  const home = applyReport(
    catalog,
    state,
    { bot: "pain-radar", status: "working", task: "não deve aparecer", ts: NOW },
    NOW,
    "d",
  );
  assert.equal(home.ok, true);
  if (!home.ok) return;
  assert.match(home.warning ?? "", /home office/);
  state = home.state;

  const view = present(catalog, state, NOW);
  const statusOf = (id: string) => view.bots.find((bot) => bot.id === id)?.status;
  assert.equal(statusOf("pesquisa"), "browsing");
  assert.equal(statusOf("caca-leads-social"), "idle");
  assert.equal(statusOf("chief-of-staff"), "sleeping");
  assert.equal(statusOf("pain-radar"), "home_office");
  assert.equal(view.bots.find((bot) => bot.id === "pain-radar")?.task, undefined);
  assert.equal(view.counts.working, 1);
  assert.equal(view.counts.idle, 1);
  assert.equal(view.counts.sleeping, 3);
  assert.equal(view.counts.homeOffice, catalog.bots.filter((bot) => bot.area === "home").length);
});

test("rejeita status derivado e bot desconhecido", () => {
  const bad = applyReport(catalog, emptyState(), { bot: "pesquisa", status: "sleeping" }, NOW, "x");
  assert.equal(bad.ok, false);
  const missing = applyReport(catalog, emptyState(), { bot: "nao-existe", status: "done" }, NOW, "x");
  assert.equal(missing.ok, false);
});

test("aceita ts em segundos e limita a atividade", () => {
  let state = emptyState();
  const applied = applyReport(
    catalog,
    state,
    { bot: "Agente Outbound Mindness", status: "needs_you", note: "Posso enviar?", ts: Math.floor(NOW / 1000) },
    NOW,
    "n1",
  );
  assert.equal(applied.ok, true);
  if (!applied.ok) return;
  assert.equal(applied.state.bots["agente-outbound"].ts, NOW);
  state = applied.state;
  for (let i = 0; i < ACTIVITY_LIMIT + 5; i++) {
    const next = applyReport(catalog, state, { bot: "pesquisa", status: "done", ts: NOW + i }, NOW + i, `id-${i}`);
    assert.equal(next.ok, true);
    if (next.ok) state = next.state;
  }
  assert.equal(state.activity.length, ACTIVITY_LIMIT);
  assert.equal(state.activity[0].id, `id-${ACTIVITY_LIMIT + 4}`);
});

test("aprovar só grava a decisão", () => {
  const result = applyDecision(catalog, emptyState(), "outbound", "approve", NOW);
  assert.equal(result.ok, false);
  const saved = applyDecision(catalog, emptyState(), "agente-outbound", "approve", NOW);
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.deepEqual(saved.state.answers["agente-outbound"], { decision: "approve", ts: NOW });
  assert.equal(saved.state.activity.length, 0);
});

test("mover um bot de área é só config", () => {
  const moved: Catalog = {
    areas: catalog.areas,
    bots: catalog.bots.map((bot) =>
      bot.id === "radar-x" ? { ...bot, area: "prospeccao", reports: true } : bot,
    ),
  };
  const state: OfficeState = {
    ...emptyState(),
    bots: {
      "radar-x": { status: "terminal", task: "Varredura", ts: NOW },
    },
  };
  const view = present(moved, state, NOW);
  assert.equal(view.bots.find((bot) => bot.id === "radar-x")?.status, "terminal");
  assert.equal(view.bots.find((bot) => bot.id === "radar-x")?.areaKind, "floor");
  assert.equal(view.counts.freeDesks, 1);
});

test("parser de logs históricos", () => {
  const events = parseLog(
    [
      "# disparos",
      '- 2026-10-30T14:00:00-03:00 status=done task="Varredura da tarde" note="Lote fechado" step=3 steps="Listar|Filtrar|Registrar"',
      "- sem data status=working",
      "- 2026-10-30T15:00:00-03:00 status=dormindo",
    ].join("\n"),
    "outbound/caca-leads/disparos-2026-10-30.md",
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].bot, "caca-leads-social");
  assert.equal(events[0].status, "done");
  assert.deepEqual(events[0].steps, ["Listar", "Filtrar", "Registrar"]);
  assert.equal(events[0].step, 3);
});
