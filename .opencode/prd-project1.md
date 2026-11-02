# PRD — Casa Viva (project1)

> ATUALIZAÇÃO: server functions moram em `src/lib/queries.ts` e `src/lib/writes.ts`
> (o template bloqueia imports de cliente em pastas `server/`); as menções a
> `src/server/*` abaixo devem ser lidas como `src/lib/*`.

> O COMO. Derivado de `.opencode/project1.md` (planejamento) e confrontado com o ambiente real.
> Fonte de verdade do escopo é o planejamento; este PRD manda no "como".

---

## 1. Estado do ambiente confirmado

- Stack: TanStack Start v1 (React 19, Vite 8, roteamento file-based em `src/routes/`).
- Styling: Tailwind CSS v4 em `src/styles.css` (tema via `@theme`), componentes shadcn/ui em `src/components/ui/`.
- Estado: `@tanstack/react-query`; dados por rota via loader + `useSuspenseQuery`.
- `src/routes/index.tsx` ainda é placeholder — `/` será reescrito.
- Não há backend conectado ainda: nenhum `src/integrations/supabase/*`.
- Testes existentes: `src/test/app-routing.test.tsx` (vitest + testing-library).
- `vite-opencode-proxy.ts` e rota `/oc` existem e NÃO devem ser quebrados.

## 2. Decisões técnicas (D-01…)

- **D-01 Backend = Lovable Cloud** (Postgres + Auth + Storage + server functions).
  Motivo: auth multiusuário, documentos no Storage e dados relacionais por lar.
- **D-02 RLS por lar**: toda tabela de domínio tem `household_id` e policies que
  exigem membresia (função `is_member(household_id)`). Nenhum dado global.
- **D-03 Auth**: Supabase auth (email+senha no MVP); `profiles` espelha `auth.users`
  via trigger; convite de morador por e-mail com papel (`owner|manager|member|viewer|guest`)
  e `expires_at` opcional para visitantes temporários.
- **D-04 Captura com IA**: Lovable AI Gateway (visão) para extrair JSON estruturado
  de fotos (nota fiscal, etiqueta, boleto, apólice). Texto/voz natural parseado
  pela mesma via (LLM) para criar registros. Arquivo original vai ao Storage.
- **D-05 Zelador digital**: chat via Lovable AI Gateway com tool-calls consultando
  o banco (obrigações, gastos, garantias). Respostas citam fichas por id.
- **D-06 Planta da casa**: dados espaciais em JSONB na tabela `rooms`
  (x, y, w, h, rotação, cor, ícone). Renderização SVG própria (isométrica),
  sem dependência de biblioteca de mapas — leve, testável e controlável.
- **D-07 Motion**: CSS (transições + keyframes) + `tw-animate-css`; nenhuma
  lib de animação pesada. Respeitar `prefers-reduced-motion` em tudo.
- **D-08 Navegação**: TanStack Router file-based; hierarquia em `src/routes/`.
  Paleta de comandos (cmdk) global com busca universal.
- **D-09 Server functions**: `createServerFn` com middleware de auth
  (`requireSupabaseAuth`) para tudo que escreve; leituras públicas não existem —
  todo dado é de um lar autenticado.
- **D-10 Idioma**: todo texto de produto em pt-BR, tom humano (§12 do planejamento).
- **D-11 Temas**: claro e escuro como cidadãos de primeira classe; tokens em
  `src/styles.css` (`:root` + `.dark`), nada hardcoded em componentes.
- **D-12 Ícones**: lucide-react (já instalado); nenhuma lib nova sem checagem.

## 3. Modelo de dados (Lovable Cloud / Postgres)

Tabelas (todas com `id uuid pk default gen_random_uuid()`, `created_at`):

| Tabela | Campos essenciais | Notas |
|---|---|---|
| `households` | name, kind (casa/apto/sítio/praia/alugado), address, timezone | 1 usuário pode ter 1+ lares |
| `profiles` | id=auth.users.id, name, email | trigger on signup |
| `household_members` | household_id, user_id, role, invited_email, expires_at | RLS: membro do lar |
| `rooms` | household_id, name, kind, layout jsonb (x,y,w,h,rot,cor,ícone), kind_area (interna/externa/garagem) | pulso derivado em query |
| `assets` | household_id, room_id, name, category, brand, model, serial, purchase_date, purchase_price, store, warranty_expires, extended_warranty_expires, useful_life_months, photo_url, notes | "ficha viva" |
| `asset_events` | asset_id, kind (manutenção/reparo/substituição/observação), date, description, cost, provider_id | histórico |
| `documents` | household_id, room_id, asset_id, vehicle_id, pet_id, title, category, expires_at, file_url, notes | cofre |
| `obligations` | household_id, title, kind (conta/tributo/seguro/revisão/vacina/contrato/outro), amount, frequency (one_time/monthly/quarterly/semiannual/yearly/custom), custom_interval_days, next_due, room_id, asset_id, responsible_member_id, auto_renew | radar temporal |
| `obligation_occurrences` | obligation_id, due_date, status (pendente/pago/feito), paid_at, amount_paid | histórico + pulso |
| `providers` | household_id, name, specialty, phone, notes | agenda de prestadores |
| `provider_services` | provider_id, asset_id, date, description, cost, rating (1-5), would_hire_again, notes | memória de prestador |
| `vehicles` | household_id, name, plate, brand, model, year, purchase_date, odometer | camada veículos |
| `pets` | household_id, name, species, breed, birthdate, weight_kg, photo_url | camada pets |
| `plants` | household_id, name, location, watering_interval_days, last_watered | camada jardim |
| `expenses` | household_id, room_id, asset_id, category, amount, date, kind (fixo/variável/eventual/sazonal), description | camada financeira |
| `projects` | household_id, name, budget_planned, budget_spent, status, start_date, end_date | reformas |
| `captures` | household_id, kind (foto/texto/email), raw_text, image_url, ai_status, ai_extract jsonb, review_status | fila de revisão em lote |
| `chat_messages` | household_id, member_id, role (user/assistant), content, citations jsonb | zelador |
| `members_visibility` | membro→papel e permissões derivadas no código (sem tabela extra no MVP) | D-03 |

R virtually: views para pulso por cômodo e por casa (custos, vencimentos, garantias).

## 4. RLS (regra geral, uma vez)

- Helper `is_member(household_id uuid)` → security definer, consulta `household_members`
  respeitando `expires_at` de convidados temporários.
- SELECT: `is_member(household_id)`. INSERT/UPDATE/DELETE: `is_member(household_id)`
  AND papel ≠ `viewer`/`guest` (exceto `obligation_occurrences`, onde qualquer membro
  pode marcar como pago).
- Storage: bucket `documents` privado, path `household/{id}/…`, policies por membresia.

## 5. Rotas (file-based)

```
src/routes/
├── __root.tsx              shell + fontes + <Toaster/>
├── index.tsx               casa espacial (planta isométrica + pulso)
├── _auth.tsx               layout protegido (redirect p/ /entrar)
├── entrar.tsx              auth (entrar/criar conta)
├── onboarding.tsx          construtor da planta
├── comodo.$roomId.tsx      interior do cômodo
├── ativo.$assetId.tsx      ficha viva do ativo
├── documentos.tsx          cofre
├── obrigacoes.tsx          radar temporal
├── prestadores.tsx         agenda com memória
├── dinheiro.tsx            camada financeira
├── captura.tsx             captura rápida + revisão em lote
├── zelador.tsx             chat do zelador
├── emergencia.tsx          modo emergência (fullscreen, alto contraste)
├── veiculos.tsx / pets.tsx / jardim.tsx   camadas de vida
├── momentos.tsx            mudança · dossiê · sinistro · retrospectiva
└── config.tsx              membros, papéis, temas, exportar dados
```

Cada rota com `head()` próprio (título, descrição, og — regras do template).

## 6. Design system (§12 do planejamento)

- **Direção**: calor humano + sofisticação + calma. Nada de dashboard genérico.
- **Paleta (tokens)**: base creme/areia; primária terracota profunda; apoio verde-oliva
  e azul-petróleo; tinta escura para texto; estados (tranquilo/atenção/urgente)
  mapeados para verde/âmbar/terracota-viva. `.dark` com atmosfera própria (noite acolhedora).
- **Tipografia**: display serif com personalidade + sans legível, carregadas por
  `<link>` no `__root.tsx` (nunca `@import` remoto no CSS).
- **Ícones**: lucide com traço consistente.
- **Movimento**: transições de nível (casa→cômodo→objeto) com transform/opacity
  sincronizadas; pulso dos cômodos via animação CSS sutil.
- **Modo emergência**: alto contraste garantido, alvos grandes, sem dependência de
  animação; funciona em rede ruim (dados críticos pré-carregados no loader).

## 7. Escopo por fase (acceptance por fase)

### Fase 1 — Fundação (contratos)
- Lovable Cloud ativo; migration com **todo** o schema da seção 3 + RLS + trigger de profiles.
- Auth (entrar/criar conta) funcional; `_auth.tsx` protegendo tudo; `src/start.ts`
  com middleware de bearer token.
- Design system: tokens claro/escuro, tipografia, componentes base.
- **Aceite**: signup→login→criar lar→ver `/` com estado vazio bonito; RLS testada
  (usuário de outro lar não lê nada); build + testes verdes.

### Fase 2 — Casa espacial (núcleo visual)
- Onboarding construtor da planta: escolher modelos, montar cômodos (grade/arraste),
  nomear, personalizar; salvar layout em `rooms.layout`.
- `/` renderiza a planta isométrica SVG interativa; cômodos pulsam por estado;
  clique abre o cômodo com transição fluida (casa→cômodo cinematográfica).
- `/comodo.$roomId` com inventário do cômodo, resumo do pulso e atalhos.
- **Aceite**: criar casa com 6+ cômodos e navegar casa→cômodo→casa sem quebras;
  mobile usável (uso a uma mão); transição animada perceptível.

### Fase 3 — Fichas vivas e cofre
- CRUD de ativos com ficha completa (§3 do planejamento), histórico (`asset_events`),
  prestadores e serviços com avaliação; documentos no cofre com upload ao Storage
  e validade monitorada.
- **Aceite**: ficha com foto, garantia e histórico legível; documento sobe, baixa e
  expira no radar; outro usuário do mesmo lar vê o mesmo dado (RLS correta).

### Fase 4 — Radar temporal
- `obligations` com recorrência → geração de `obligation_occurrences` (server function);
  radar temporal visual (próximos 12 meses), agrupamento por mês, custo previsto;
  responsável por item; marcar pago/feito.
- **Aceite**: criar obrigação mensal e ver ocorrências futuras; pulso reflete
  atrasos; concluir ocorrência atualiza estado e histórico.

### Fase 5 — Captura sem atrito
- Upload de foto → AI Gateway extrai JSON → pré-ficha editável → confirmação;
  texto/voz natural → registro estruturado no lugar certo; fila de revisão em
  lote estilo "baralho" com gestos.
- **Aceite**: foto de nota fiscal gera pré-ficha com datas/valores plausíveis;
  frase "troquei o filtro da geladeira hoje" cria evento + próxima manutenção;
  revisão em lote conclui N itens em segundos.

### Fase 6 — Zelador digital
- Chat com contexto do lar; tool-calls para consultas (§5 do planejamento);
  citações clicáveis para fichas; sugestões contextuais nos lugares certos
  (garantia perto de vencer no `/` e na ficha).
- **Aceite**: "quanto gastei com a cozinha nos últimos dois anos?" responde com
  valor correto e link para os registros; sugestão de garantia aparece na home.

### Fase 7 — Pulso da casa
- Cálculo honesto (obrigações em dia, manutenção, garantias, documentos, riscos)
  com explicação por componentes e "o que melhoraria" em ordem de impacto;
  visual animado próprio; pulso por cômodo; linha do tempo mensal.
- **Aceite**: pulso muda ao registrar pagamento/atraso; painel explica o porquê;
  timeline renderiza 12 meses.

### Fase 8 — Modo emergência
- `/emergencia` fullscreen: alto contraste, tipografia grande, paths por tipo de
  emergência (registro geral, disjuntor, prestador de confiança, apólice), com
  foto/posição; compartilhar pacote de informações.
- **Aceite**: aberto de qualquer lugar em 1 toque; mostra dados reais da casa
  (não mockados); legível em tela pequena.

### Fase 9 — Dinheiro da casa
- Custo real por mês/cômodo; previsão 12 meses + reserva sugerida; custo de
  propriedade por ativo; visão de projetos (planejado vs realizado).
- **Aceite**: números batem com os registros criados; previsão inclui obrigações
  futuras; apresentação clara (não parede de gráficos).

### Fase 10 — Camadas de vida
- Veículos, pets e jardim com o mesmo modelo (ficha, documentos, obrigações,
  histórico); ativação por camada nas configurações.
- **Aceite**: pet com vacinas no radar; veículo com revisão/IPVA; rega do jardim
  aparecendo; desativar camada remove da navegação sem perder dados.

### Fase 11 — Carga mental compartilhada
- Membros e papéis no `/config`; convite por e-mail; responsáveis visíveis;
  visualização empática da distribuição (lembrar/decidir/fazer); acesso temporário.
- **Aceite**: convidar viewer com prazo e validar que ele só lê; mapa de carga
  mostra distribuição real das obrigações.

### Fase 12 — Momentos de virada
- Mudança (checklist por cômodo, caixas, frágeis, transferências), dossiê do
  imóvel (PDF exportável), sinistro (pacote de comprovantes), retrospectiva anual.
- **Aceite**: dossiê gera documento com histórico real; modo mudança acompanha
  progresso por cômodo.

### Fase 13 — Polimento e gates finais
- Micro-interações, estados vazios, clareza/escuro revisados, mobile a uma mão,
  acessibilidade (foco, contraste, reduced-motion), busca universal (cmdk),
  meta/og por rota, performance de carregamento.
- **Aceite**: passada completa nos gates §19 do AGENTS central + auditoria
  do monitor; produto navegável de ponta a ponta sem esboços.

## 8. Contratos compartilhados (fixados antes do paralelo)

- `src/lib/types.ts`: tipos TS espelhando o schema (household, room, asset,
  obligation, occurrence, document, provider, expense, pet, vehicle, plant,
  project, capture, chat_message, member role).
- `src/lib/supabase-client.ts` (gerado pelo Cloud) — única forma de acesso no cliente.
- `src/server/queries.ts` — server functions de leitura por lar (nomes canônicos).
- `src/server/writes.ts` — server functions de escrita com middleware de auth.
- `src/lib/pulse.ts` — regra de cálculo do pulso (usada por `/`, cômodos e zelador).
- `src/lib/format.ts` — moeda (BRL), datas (pt-BR) e pluralização.

## 9. Enxame (subagentes-3-pilares)

- **Onda 0 (eu)**: pilares centrais + Cloud + schema/RLS + contratos da seção 8
  + design tokens + `_auth` + `__root`.
- **Onda 1 (paralela)**: s1-casa-espacial (F2), s2-fichas-cofre (F3),
  s3-radar (F4) — fatias verticais com dono exclusivo de arquivos.
- **Onda 2**: s4-captura (F5), s5-zelador (F6), s6-pulso (F7) — dependem dos
  dados e contratos da onda 1.
- **Onda 3**: s7-emergencia (F8), s8-dinheiro (F9), s9-camadas (F10).
- **Onda 4**: s10-membros (F11), s11-momentos (F12), s12-polimento (F13).
- Cada subagente recebe os 3 pilares centrais + os 3 pilares próprios
  (`.opencode/work/sub/{K}/`), nunca edita arquivos de outro e reporta com
  evidência de gates. Integração e verificação final são minhas.

## 10. Riscos e mitigação

- **Schema errado no início** → onda 0 revisa com care; migrations imutáveis por fase.
- **Transição casa→cômodo pesada** → SVG + CSS transform, sem libs pesadas; testar mobile.
- **IA extrai mal** → pré-ficha sempre editável; IA é proposta, nunca gravação direta.
- **RLS furada** → teste de negação entre lares na Fase 1, antes de qualquer paralelo.
- **Escopo enorme** → roadmap com gates; se o remix acabar antes, estado exato
  registrado no roadmap ("Próximo remix: …").

## 11. Registro de decisões

- 2026-11-01 — PRD criado a partir do project1 (planejamento Casa Viva) e do
  ambiente real (TanStack Start v1, sem Cloud ainda). Decisões D-01…D-12 acima.
- 2026-11-01 — Enxame: a tool `spawn_agent` deste ambiente é somente-leitura
  (subagente não edita arquivos), então a onda 1 (s1/s2/s3) não pôde ser
  delegada como produção. Fase 2 foi executada integralmente pelo agente
  principal (plant.ts, PlantaIsometrica, onboarding-builder, /comodo/$roomId,
  pulso por cômodo, queries/writes estendidos, testes). Próximas fases seguem
  o mesmo caminho até que exista um executor de escrita delegável.
- 2026-11-02 — Remix: as migrations chegaram recriadas vazias, mas o banco do
  novo projeto veio com o schema íntegro (RLS ativa, funções `is_member`,
  `can_write`, `create_household`, `handle_new_user`, bucket `documents`) e sem
  dados. Faltava só o gatilho em `auth.users`, sem o qual nenhum signup ganhava
  perfil. Decisão: não recriar o schema todo (as tabelas já existem e recriar
  falharia) — aplicar apenas `0000_restore_profile_trigger`; o diário recomeça daí.
- 2026-11-02 — Captura de acontecimento: `applyCapture` exigia um objeto já
  cadastrado, então "troquei o filtro da geladeira hoje" nunca entrava numa casa
  que ainda não tinha geladeira. Decisão: a IA passa a propor `asset_name` (o
  objeto envolvido); sem objeto escolhido, a casa cadastra o objeto a partir da
  proposta confirmada e só então grava o evento. Regra isolada em
  `src/lib/capture-target.ts` (pura, testada).
- 2026-11-02 — Pendência registrada: `room_guess` da IA aparece como palpite no
  seletor de cômodo, mas não é aplicado ao registro. Levar para o polimento da
  Fase 5 (casar o palpite com um cômodo real da casa).
- 2026-11-02 — Fase 6 (zelador): o chat `/zelador` responde com tool-calls sobre o
  banco do próprio lar (gastos por cômodo, gastos gerais, próximos vencimentos,
  garantias, documentos e histórico de um objeto). Decisões: as fichas citadas
  vêm das execuções das ferramentas, nunca do texto do modelo; a conversa fica em
  `chat_messages` (com `citations` em JSONB e `member_id` = id da membresia, por
  causa da FK); a resposta sai de `generateText` com `stopWhen: isStepCount(8)`;
  a UI só oferece navegação para caminhos que sabe montar (`/comodo/$roomId`,
  `/ativo/$assetId`, `/obrigacoes`, `/documentos`), então uma citação nunca vira
  link morto.

- 2026-11-02 — Fase 10 (camadas de vida): o interruptor de uma camada é a tabela
  `household_layers`, e **ausência de linha significa ligada** — desligar escreve
  `active = false`, nunca apaga registro. Assim uma casa recém-montada vem com as três
  camadas sem precisar semear nada, e desligar "tira da navegação sem perder dados"
  (aceite da fase) vira uma única escrita.
- 2026-11-02 — `obligations` ganhou `vehicle_id` e `pet_id` (colunas novas, nulas, FK
  `ON DELETE SET NULL`) para vacina, revisão e IPVA entrarem no radar temporal. O jardim
  **não** virou obrigação: a rega é derivada de `last_watered + watering_interval_days`
  em `src/lib/layers.ts` (função pura, testada), porque "hora de molhar" não é um gasto
  nem um vencimento a pagar — é cuidado, e por isso aparece no radar como "Cuidados do
  jardim", não como uma linha a marcar pago.
- 2026-11-02 — `/config` nasceu como a página dos interruptores das camadas e é o lugar
  onde a Fase 11 (membros, papéis, convite com prazo) entra. A navegação passou a rolar
  só no meio: a marca e o botão "Emergência" ficam fora da área rolável, porque o gate
  da Fase 8 exige emergência a um toque de qualquer lugar — com as camadas ligadas o
  atalho teria sido empurrado para fora da tela.
- 2026-11-02 — Fichas de veículo e pet usam a mesma peça (`src/components/layer-ficha.tsx`):
  "o que vence" com marcar pago/feito e "papéis" com upload ao cofre, ligados à camada.
  É o "mesmo modelo" do aceite, garantido por código em vez de cópia.
- 2026-11-02 — Bug corrigido e registrado: o diálogo "Nova obrigação" guardava os vínculos
  da criação anterior, então a segunda obrigação nascia ligada ao veículo *e* ao pet da
  primeira. Agora o formulário limpa título, tipo, valor, repetição, cômodo, objeto,
  veículo, pet e responsável ao concluir. Regra de ordem: **todo diálogo de criação
  reseta o estado inteiro no sucesso**, inclusive os selects que parecem inofensivos.
- 2026-11-02 — Fase 11 (carga mental): o mapa de carga virou função pura em
  `src/lib/load-map.ts` (saía inline de `getMembersState`), com a regra testada:
  itens por responsável, vencimentos em 30 dias (atrasados contam), balde
  "Ninguém" para o que não tem dono, ordem por impacto. O painel de membros de
  `/config` (convite por e-mail com papel e prazo, troca de papel, remoção) já
  existia e foi mantido; `claimInvites` roda na home para ligar convite a conta.
- 2026-11-02 — Fase 12 (momentos de virada): `/momentos` com mudança, dossiê,
  sinistro e retrospectiva, tudo montado no cliente por `src/lib/moments.ts`
  (puro, testado) a partir de `getMomentsState`. Decisões: o checklist de
  mudança persiste em `localStorage` (este sandbox não aplica migrations no
  banco do projeto remixado — se uma migration for possível, migrar para
  tabela por lar); o dossiê vira documento via `window.print()` (imprimir ou
  salvar em PDF), sem gerador de PDF no servidor; o pacote de sinistro é
  copiável como texto para colar na seguradora.
- 2026-11-02 — Limitação do ambiente registrada: neste sandbox o backend do
  projeto remixado não é acessível (`lovable supabase query` falha com
  "no Supabase backend", `LOVABLE_BROWSER_AUTH_STATUS=no_supabase`, preview
  atrás de login). Gates de browser das Fases 11 e 12 ficaram pendentes para
  o próximo remix ou para verificação no preview com sessão.
- 2026-11-02 — Fase 13 (parcial): busca universal por paleta ⌘K/Ctrl+K no nav
  (`src/components/command-palette.tsx` + `getSearchIndex`), filtrando no
  cliente sobre um índice raso do servidor (cômodos, objetos, documentos,
  obrigações, prestadores). Decisão: o índice só é buscado quando a paleta
  abre (`enabled: open`), para não pesar a navegação de quem nunca busca.
  meta/og por rota verificado em todas as 20 rotas. Restam a passada de
  micro-interações/acessibilidade e a auditoria do monitor (gate final).
- 2026-11-02 — Fase 13 (acessibilidade): o tema escuro tinha quatro falhas
  de contraste medidas (muted-foreground 2.94:1, primary 3.20:1, tranquilo
  2.63:1 — AA exige 4.5:1). Decisão: corrigir subindo a luminância dos
  tokens de fundo (`--primary` 0.683→0.745, `--tranquilo` 0.655→0.75) e do
  texto secundário (`--muted-foreground` 0.702→0.775), preservando matiz e
  croma para não descaracterizar a noite acolhedora. Foco visível global
  ficou fora de camada no CSS para vencer `outline-none` sem `!important`;
  skip link `#conteudo` no nav com `id` nas 15 páginas; `aria-current="page"`
  via `activeProps` do TanStack Router. Cada regra tem teste em
  `src/test/acessibilidade.test.ts`. Auditoria do monitor: runtime OpenCode
  ausente neste sandbox — auditoria executada pelo agente principal no
  formato do `monitor.md`, relatório em `.opencode/reports/fase-13-eval.md`.
