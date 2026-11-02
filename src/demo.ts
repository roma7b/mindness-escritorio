import type { OfficeState, ReportStatus } from "../shared/office";

type Cast = {
  id: string;
  status: ReportStatus;
  task: string;
  note: string;
  step: number;
  steps: string[];
};

const BEAT_SECONDS = 9;

const BEATS: Cast[][] = [
  [
    { id: "chief-of-staff", status: "thinking", task: "Prioridades do dia", note: "Separando o que precisa de ok", step: 2, steps: ["Ler os pings", "Ordenar a fila", "Pedir o ok"] },
    { id: "caca-leads-social", status: "working", task: "Varredura de perfis", note: "Filtrando quem comentou no nicho", step: 2, steps: ["Abrir a lista", "Filtrar sinais", "Entregar"] },
    { id: "agente-outbound", status: "working", task: "Fila de disparos", note: "Montando o lote da manhã", step: 2, steps: ["Montar a fila", "Revisar o texto", "Esperar o ok", "Enviar"] },
    { id: "pesquisa", status: "browsing", task: "Mapa de dores", note: "Lendo threads recentes", step: 1, steps: ["Ler threads", "Agrupar dores", "Entregar o recorte"] },
    { id: "copiloto-atendimento", status: "working", task: "Conversa com lead", note: "Respondendo a objeção de preço", step: 2, steps: ["Ler a conversa", "Propor a resposta", "Esperar o ok"] },
  ],
  [
    { id: "chief-of-staff", status: "thinking", task: "Pedido do outbound", note: "Lendo se o lote pode sair", step: 2, steps: ["Ler os pings", "Ordenar a fila", "Pedir o ok"] },
    { id: "caca-leads-social", status: "working", task: "Varredura de perfis", note: "Filtrando quem comentou no nicho", step: 2, steps: ["Abrir a lista", "Filtrar sinais", "Entregar"] },
    { id: "agente-outbound", status: "needs_you", task: "Fila de disparos", note: "Chief, a fila está pronta. Posso enviar o lote?", step: 3, steps: ["Montar a fila", "Revisar o texto", "Esperar o ok", "Enviar"] },
    { id: "pesquisa", status: "browsing", task: "Mapa de dores", note: "Lendo threads recentes", step: 2, steps: ["Ler threads", "Agrupar dores", "Entregar o recorte"] },
    { id: "copiloto-atendimento", status: "thinking", task: "Conversa com lead", note: "Pensando na resposta do preço", step: 2, steps: ["Ler a conversa", "Propor a resposta", "Esperar o ok"] },
  ],
  [
    { id: "chief-of-staff", status: "working", task: "Fila do outbound", note: "Anotando o ok do lote", step: 3, steps: ["Ler os pings", "Ordenar a fila", "Pedir o ok"] },
    { id: "caca-leads-social", status: "working", task: "Varredura de perfis", note: "Separando quem responde rápido", step: 3, steps: ["Abrir a lista", "Filtrar sinais", "Entregar"] },
    { id: "agente-outbound", status: "working", task: "Fila de disparos", note: "Ajustando o texto do lote", step: 2, steps: ["Montar a fila", "Revisar o texto", "Esperar o ok", "Enviar"] },
    { id: "pesquisa", status: "needs_you", task: "Mapa de dores", note: "Chief, sigo nesse nicho ou troco?", step: 2, steps: ["Ler threads", "Agrupar dores", "Entregar o recorte"] },
    { id: "copiloto-atendimento", status: "working", task: "Conversa com lead", note: "Seguindo a conversa", step: 2, steps: ["Ler a conversa", "Propor a resposta", "Esperar o ok"] },
  ],
  [
    { id: "chief-of-staff", status: "thinking", task: "Objeção de preço", note: "Vendo o que o copiloto responde", step: 2, steps: ["Ler os pings", "Ordenar a fila", "Pedir o ok"] },
    { id: "caca-leads-social", status: "browsing", task: "Varredura de perfis", note: "Olhando comentários novos", step: 1, steps: ["Abrir a lista", "Filtrar sinais", "Entregar"] },
    { id: "agente-outbound", status: "working", task: "Fila de disparos", note: "Deixando o lote na fila", step: 3, steps: ["Montar a fila", "Revisar o texto", "Esperar o ok", "Enviar"] },
    { id: "pesquisa", status: "thinking", task: "Mapa de dores", note: "Agrupando as dores do nicho", step: 2, steps: ["Ler threads", "Agrupar dores", "Entregar o recorte"] },
    { id: "copiloto-atendimento", status: "needs_you", task: "Conversa com lead", note: "Chief, o lead travou no preço. O que eu falo?", step: 2, steps: ["Ler a conversa", "Propor a resposta", "Esperar o ok"] },
  ],
];

export function demoState(now: number, elapsedSec = 0): OfficeState {
  const beat = BEATS[Math.floor(elapsedSec / BEAT_SECONDS) % BEATS.length];
  const bots = Object.fromEntries(
    beat.map((cast) => [
      cast.id,
      { status: cast.status, task: cast.task, note: cast.note, step: cast.step, steps: cast.steps, ts: now },
    ]),
  );
  const activity = beat.map((cast, index) => ({
    id: `demo-${Math.floor(elapsedSec / BEAT_SECONDS)}-${cast.id}`,
    bot: cast.id,
    status: cast.status,
    task: cast.task,
    note: cast.note,
    ts: now - index * 4_000,
  }));
  return { answers: {}, bots, activity };
}
