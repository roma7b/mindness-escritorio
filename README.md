# Escritório Mindness

Sala isométrica low-poly para ver o que os bots do Gabriel estão fazendo. Os móveis são do Furniture Kit do Kenney (CC0); veja [CREDITS.md](CREDITS.md). Não existe API pública do Grok Bot para listar bots ou status, e este projeto não inventa uma nem faz scraping. Quem empurra o estado é o próprio bot, com um `POST` no fim da tarefa (e, se quiser, outro no começo).

O escritório só mostra o que foi reportado. Sem ping, o bot aparece dormindo.

## As salas

Tudo mora em [`data/bots.json`](data/bots.json). Dá para acrescentar uma sala ou mudar um bot de lugar sem mexer no código.

| Área | Tipo | Quem está |
| --- | --- | --- |
| Chief of Staff | `office` — sala privada, mesa grande | Chief of Staff · Mindness |
| Prospecção | `floor` — 6 mesas, 2 livres | Caça Leads Social, Agente Outbound Mindness, Pesquisa · Mindness, Copiloto de Atendimento · Mindness |
| Home office | `home` — casinhas, sem ping | todo o resto |

`kind` aceita `office` (sala privada), `floor` (área com várias mesas) e `home` (casinhas, status fixo **home office**). `grid` posiciona a sala no mapa largo; `gridPortrait` no modo estreito e na gravação 9:16. `capacity` é o número de mesas. `windows` escolhe quais vãos da parede do fundo têm janela.

Para trazer alguém do home office para uma mesa, mude o bot no JSON:

```json
{ "id": "radar-x", "area": "prospeccao", "reports": true }
```

A ordem no array define a mesa: o primeiro bot da área senta na primeira mesa. Uma área nova é um objeto em `areas` mais os bots apontando para o `id` dela.

Cada bot tem `color`, `accent` e `shape`: `round`, `square`, `drop` ou `helmet`. O mesmo desenho aparece na sala, na lista do time e no painel. `gradient: true` mistura `color` em `accent`. `avatar` é um caminho público opcional, como `/avatars/chief.svg`, e substitui o ícone do painel.

Os móveis moram em [`data/layout.json`](data/layout.json), e a cena abre esse arquivo. O botão **Editar** arrasta cada peça na grade de 0,4 m, gira com R ou com **Girar**, apaga e acrescenta itens do kit sem deixar um móvel em cima do outro nem na frente da janela. O navegador guarda a última edição. **Exportar** baixa um `layout.json` para substituir o arquivo do repositório; **Importar** lê um arquivo; **Padrão** descarta a edição local. Na gravação 9:16 esses controles ficam escondidos.

## O que cada status significa

O bot envia um destes: `working`, `browsing`, `terminal`, `thinking`, `needs_you`, `error`, `done`, `idle`.

O escritório deriva o resto:

- sem ping, ou último ping há mais de **2 horas** → **dormindo**
- último ping há mais de **15 minutos** → **idle**
- bot com `area` do tipo `home` → **home office**, mesmo que alguém poste um status

Na tela, `working` e `terminal` aparecem como **Trabalhando**, `browsing` como **Pesquisando**, `thinking` como **Pensando**, `needs_you` como **Precisa de você**, `error` como **Erro**, `done` como **Concluído** e `idle` como **Parado**. O contador **Trabalhando** soma trabalhando, pesquisando e pensando. **Mesas livres** é a capacidade das salas menos os bots sentados nelas.

## Um ping por tarefa

Cada bot manda **um** `POST` no fim da tarefa. Um segundo ping no começo é opcional, para a mesa acender enquanto o trabalho dura. Não use loop, cron por minuto nem ping a cada passo: o plano free do KV aceita 1.000 escritas por dia e 1 escrita por segundo na mesma chave.

Se a tarefa precisar de um ok, o bot consulta `GET /api/answer` na próxima chamada. Aprovar e Recusar **só gravam** a resposta no KV. O app não envia mensagem, e-mail, post nem qualquer ação fora dele. A ação real continua no chat, com o ok do Gabriel.

### Texto para colar nas instruções

Troque a URL e guarde o token fora do texto, numa variável secreta do bot (`OFFICE_TOKEN`). Não cole o token no meio da instrução se o bot já tiver variável de ambiente.

```text
Não existe API do Grok Bot para reportar status. O único canal é o escritório da Mindness.

No fim de cada tarefa, faça um único POST. Não repita, não faça loop e não agende ping por minuto. Se quiser que a mesa apareça ocupada durante a tarefa, pode mandar um POST opcional no começo — e só nesse momento.

Quando a tarefa precisar de um ok do Gabriel, consulte GET /api/answer antes de agir. Se a resposta for approve ou decline, siga só isso. O escritório apenas registra: ele não envia mensagem, e-mail nem post.

Fim da tarefa (obrigatório):
curl -sS -X POST "$OFFICE_URL/api/status" \
  -H "Authorization: Bearer $OFFICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bot":"SEU_ID","status":"done","task":"o que você fez","step":3,"steps":["passo 1","passo 2","passo 3"],"note":"uma frase curta","ts":'"$(date +%s000)"'}'

Começo da tarefa (opcional, uma vez):
curl -sS -X POST "$OFFICE_URL/api/status" \
  -H "Authorization: Bearer $OFFICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bot":"SEU_ID","status":"working","task":"o que vai fazer","step":1,"steps":["passo 1","passo 2"],"note":"começando","ts":'"$(date +%s000)"'}'

Ler a resposta do Gabriel:
curl -sS "$OFFICE_URL/api/answer?bot=SEU_ID" \
  -H "Authorization: Bearer $OFFICE_TOKEN"

status pode ser working, browsing, terminal, thinking, needs_you, error, done ou idle.
Use needs_you quando precisar de um ok. Não envie sleeping nem home_office: o escritório calcula isso.
```

Bots do home office **não** recebem esse texto. Eles não reportam.

| Bot | `bot` no JSON |
| --- | --- |
| Chief of Staff · Mindness | `chief-of-staff` |
| Caça Leads Social | `caca-leads-social` |
| Agente Outbound Mindness | `agente-outbound` |
| Pesquisa · Mindness | `pesquisa` |
| Copiloto de Atendimento · Mindness | `copiloto-atendimento` |

Exemplo já com o id do outbound, para colar e só trocar a URL:

```bash
curl -sS -X POST "$OFFICE_URL/api/status" \
  -H "Authorization: Bearer $OFFICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bot":"agente-outbound","status":"needs_you","task":"Fila de disparos","step":3,"steps":["Montar","Revisar","Esperar o ok","Enviar"],"note":"A fila está pronta. Posso enviar o lote?","ts":'"$(date +%s000)"'}'
```

`ts` é epoch em milissegundos. Se vier em segundos, o endpoint converte. A resposta traz `displayed`: o status que a sala vai mostrar depois das regras de idle e sleeping.

## Aprovar e recusar

Os botões chamam `POST /api/decision` com `{ "bot", "decision": "approve" | "decline" }`. Isso grava em KV. O bot lê com `GET /api/answer?bot=...`, autenticado com `OFFICE_TOKEN`. A última decisão fica disponível até a próxima. O token dos bots não consegue aprovar: decisão exige o token de quem olha a sala, ou Cloudflare Access.

## Acesso

A sala é interna.

- **Cloudflare Access** na frente do domínio. O endpoint confia nos headers `Cf-Access-Jwt-Assertion` e `Cf-Access-Authenticated-User-Email`, que a borda da Cloudflare preenche e não deixa o cliente forjar.
- **Ou** um token na URL: `https://seu-dominio/?token=VIEW_TOKEN`. O middleware grava um cookie `HttpOnly` e a página tira o token do endereço.

Sem token e sem Access, a página responde 401. `/?demo=1` abre a sala com status **simulado**, faixa e carimbo **DEMO**. O demo não grava no KV e não fala com bot nenhum.

`OFFICE_TOKEN` autentica `POST /api/status` e `GET /api/answer`. `VIEW_TOKEN` autentica a página, `GET /api/office` e `POST /api/decision`. Os dois são secrets. Se estiverem vazios, o endpoint nega (fecha, não abre).

## Modo demo e gravação

- `/?demo=1` — dados simulados, marcados como DEMO.
- `/?demo=1&luz=dia`, `luz=tarde` ou `luz=noite` — força a luz. `Agora` usa o relógio de `America/Sao_Paulo` (dia 6h–17h, tarde 17h–20h, noite no resto).
- **Gravação 9:16** esconde o painel e enquadra a sala em 9:16, com a faixa DEMO ainda visível. Atalho: `?gravacao=1`.

## Rodar na máquina

```bash
npm install
cp .dev.vars.example .dev.vars
npm test
npm run dev
```

O Vite em `http://127.0.0.1:5173/?demo=1` não sobe o KV. Para o endpoint de verdade, com KV local:

```bash
npm run build
npx wrangler pages dev dist --kv OFFICE --env-file .dev.vars --port 8788 --ip 127.0.0.1 --show-interactive-dev-session=false
```

`.dev.vars` (não commitado):

```bash
OFFICE_TOKEN=dev-office-token
VIEW_TOKEN=dev-view-token
```

Ping de exemplo, contra o dev local:

```bash
curl -sS -X POST http://127.0.0.1:8788/api/status \
  -H "Authorization: Bearer dev-office-token" \
  -H "Content-Type: application/json" \
  -d '{"bot":"pesquisa","status":"browsing","task":"Mapa de dores","note":"Lendo threads","ts":'"$(date +%s000)"'}'

curl -sS "http://127.0.0.1:8788/api/office?token=dev-view-token"
```

A sala real abre em `http://127.0.0.1:8788/?token=dev-view-token`.

## Deploy no Cloudflare Pages (plano free)

O `wrangler.jsonc` marca o projeto como Pages (`pages_build_output_dir`), com compatibility date `2026-10-30`, `nodejs_compat`, KV no binding `OFFICE` e logs/traces ligados. A query string some dos logs (`redact_query_string`) para o `?token=` não ir parar no observatório.

1. `npm install && npm run build`
2. Crie o namespace e troque o id placeholder em `wrangler.jsonc`:

   ```bash
   npx wrangler kv namespace create OFFICE
   ```

   O id `00000000000000000000000000000001` é só para o arquivo existir. Não faça deploy com ele.

3. Crie o projeto Pages `mindness-escritorio` (dashboard ou `npx wrangler pages project create mindness-escritorio`) e faça o deploy:

   ```bash
   npx wrangler pages deploy dist --project-name mindness-escritorio
   ```

   No Git, o build é `npm run build` e o diretório de saída é `dist`. O build system do Pages precisa ser v2 para ler o `wrangler.jsonc`. O arquivo passa a ser a fonte da verdade: binding de KV editado no dashboard pode ser sobrescrito no próximo deploy.

4. Grave os secrets (o comando pede o valor no stdin, não na linha de comando):

   ```bash
   npx wrangler pages secret put OFFICE_TOKEN --project-name mindness-escritorio
   npx wrangler pages secret put VIEW_TOKEN --project-name mindness-escritorio
   ```

5. Opcional e recomendado: Cloudflare Access na frente do domínio, política só para o Gabriel. O `?token=` continua funcionando para quem não passa pelo Access.

6. Confira com o `curl` da seção anterior, trocando o host. Um `POST` tem que mudar o bot na sala no próximo carregamento (a página pede `/api/office` a cada 20 segundos).

Preview deployments usam o mesmo namespace se você não separar os ids. Para não misturar ping de preview com a sala real, crie outro namespace e só então preencha `env.preview` e `env.production` — no Pages, se um ambiente overrideia uma chave não herdável (KV, vars), ele precisa redeclarar todas.

## Limites do plano free

Conferido na documentação de Pages, Workers e KV:

- Pages Functions contam no Workers Free: **100.000 requests/dia** (zera à meia-noite UTC). Pedido de asset estático não conta.
- KV: **100.000 leituras/dia**, **1.000 escritas/dia**, **1 escrita/segundo na mesma chave**, valor até 25 MiB.
- Por isso existe uma chave só, `office:v1`, com o último estado de cada bot, as respostas e as últimas **200** linhas de atividade. Duas escritas no mesmo segundo podem se atropelar; com um ping por tarefa isso não acontece na prática.
- A página aberta faz cerca de 3 leituras por minuto. Uma aba em um dia fica perto de 4.500 leituras, dentro das 100.000. Evite deixar várias abas abertas o dia inteiro.
- Pages free: 500 builds/mês, 1 build por vez, 20.000 arquivos, 25 MiB por arquivo.

Se estourar a cota de Functions, o comportamento (fail open ou fail closed) se configura em Settings → Runtime. Para uma sala interna, fail closed é o ajuste certo: sem a função de auth, o estático não deve vazar.

## Logs históricos

`scripts/import-logs.ts` lê markdown no formato abaixo e posta no endpoint, com pausa de 1,1 s entre cada um. Serve para popular a sala uma vez, não para tempo real. Um arquivo sem linha de status é ignorado.

```markdown
- 2026-10-30T14:20:00-03:00 status=done bot=caca-leads-social task="Varredura da tarde" step=3 steps="Listar|Filtrar|Registrar" note="Lote fechado"
```

Se `bot=` faltar, o script tenta o nome do arquivo (`caca-leads`, `outbound`, `pesquisa`, `copiloto`, `chief`). Exemplo em [`scripts/fixtures/exemplo-disparos.md`](scripts/fixtures/exemplo-disparos.md).

```bash
npx tsx scripts/import-logs.ts --dir ./scripts/fixtures --dry-run
OFFICE_URL=https://seu-dominio OFFICE_TOKEN=... npx tsx scripts/import-logs.ts --dir ./outbound
```

O token vai por variável de ambiente, não por argumento.

## O que não tem aqui

- Nenhuma chamada a API do Grok Bot, X, e-mail ou outro serviço. O único `fetch` do app é para `/api/*` neste mesmo domínio. O importador só fala com `OFFICE_URL`.
- Sprite de terceiros. O pixel art é desenhado no canvas.
