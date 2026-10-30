import type { OfficeState } from "../shared/office";

export function demoState(now: number): OfficeState {
  return {
    answers: {},
    activity: [
      {
        id: "demo-1",
        bot: "agente-outbound",
        status: "needs_you",
        task: "Fila de disparos",
        note: "A fila está pronta. Posso enviar o lote?",
        ts: now - 2 * 60_000,
      },
      {
        id: "demo-2",
        bot: "caca-leads-social",
        status: "working",
        task: "Varredura de perfis quentes",
        note: "Filtrando quem comentou no nicho",
        ts: now - 6 * 60_000,
      },
      {
        id: "demo-3",
        bot: "pesquisa",
        status: "browsing",
        task: "Mapa de dores do nicho",
        note: "Lendo threads recentes",
        ts: now - 9 * 60_000,
      },
      {
        id: "demo-4",
        bot: "chief-of-staff",
        status: "thinking",
        task: "Prioridades da semana",
        note: "Separando o que precisa de ok",
        ts: now - 4 * 60_000,
      },
      {
        id: "demo-5",
        bot: "copiloto-atendimento",
        status: "done",
        task: "Resumo do atendimento",
        note: "Último lote fechado de manhã",
        ts: now - 3 * 60 * 60_000,
      },
    ],
    bots: {
      "chief-of-staff": {
        status: "thinking",
        task: "Prioridades da semana",
        step: 2,
        steps: ["Ler os pings", "Ordenar a fila", "Pedir o ok do Gabriel"],
        note: "Separando o que precisa de ok",
        ts: now - 4 * 60_000,
      },
      "caca-leads-social": {
        status: "working",
        task: "Varredura de perfis quentes",
        step: 2,
        steps: ["Abrir a lista", "Filtrar sinais", "Entregar ao outbound"],
        note: "Filtrando quem comentou no nicho",
        ts: now - 6 * 60_000,
      },
      "agente-outbound": {
        status: "needs_you",
        task: "Fila de disparos",
        step: 3,
        steps: ["Montar a fila", "Revisar o texto", "Esperar o ok", "Enviar"],
        note: "A fila está pronta. Posso enviar o lote?",
        ts: now - 2 * 60_000,
      },
      pesquisa: {
        status: "browsing",
        task: "Mapa de dores do nicho",
        step: 1,
        steps: ["Ler threads", "Agrupar dores", "Entregar o recorte"],
        note: "Lendo threads recentes",
        ts: now - 9 * 60_000,
      },
      "copiloto-atendimento": {
        status: "done",
        task: "Resumo do atendimento",
        step: 3,
        steps: ["Ler conversas", "Marcar objeções", "Fechar o resumo"],
        note: "Último lote fechado de manhã",
        ts: now - 3 * 60 * 60_000,
      },
    },
  };
}
