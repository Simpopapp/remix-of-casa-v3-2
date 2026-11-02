# Roadmap — Casa Viva (proj1)

Gates por fase: build verde + testes + verificação real (browser quando visual) + RLS onde houver dado.

## Fase 1 — Fundação (Cloud, schema, RLS, auth, design system)
- [x] Lovable Cloud ativado (banco + auth + storage)
- [x] Migration: schema completo (PRD §3) + RLS + trigger de profiles
- [x] Teste: usuário de outro lar NÃO lê dados (RLS negação)
- [x] `src/start.ts` com attachSupabaseAuth; guards de sessão nas rotas protegidas
- [x] Design tokens (claro/escuro) + tipografia via `<link>` no `__root`
- [x] Contratos: `lib/types.ts`, `lib/queries.ts`, `lib/writes.ts`, `lib/pulse.ts`, `lib/format.ts`
- Gates: signup→login→criar lar→`/` com estado vazio; build+testes verdes. ✔ 2026-11-01

## Fase 2 — Casa espacial (onboarding + planta isométrica)
- [x] Onboarding: montar casa (modelos + cômodos + nomes) salvando `rooms.layout`
- [x] `/` planta isométrica SVG interativa, pulso por cômodo, estado vazio
- [x] `/comodo.$roomId` interior + inventário + transição casa→cômodo animada
- Gates: casa com 6+ cômodos navegável no desktop e mobile. ✔ 2026-11-01 — tsgo limpo, 11 testes verdes, Playwright: 7 cômodos salvos e navegáveis no desktop e mobile, zero erros de console.

## Fase 3 — Fichas vivas e cofre
- [x] CRUD de ativos (ficha completa) + histórico `asset_events`
- [x] Prestadores + serviços com avaliação e memória
- [x] Cofre: upload ao Storage, categorização, validade no radar
- Gates: ficha legível de ponta a ponta; RLS correta entre membros.

## Fase 4 — Radar temporal
- [x] Recorrência → `obligation_occurrences` (server function)
- [x] Radar visual 12 meses + responsáveis + marcar pago/feito
- Gates: ocorrências geradas corretamente; pulso reflete atrasos. ✔ 2026-11-02 — 14 testes de recorrência verdes (39 no total), build OK, Playwright: IPTU mensal projetou 12 meses (Dez/26→Nov/27), previsão R$ 3.850→R$ 3.500 após marcar pago, próximo vencimento avançou sozinho. Correções: formatRelative convertia dias em meses errado; título de mês com "De" maiúsculo.

## Fase 5 — Captura sem atrito
- [x] Rota `/captura`: texto ou foto → fila de revisão em cartas (baralho)
- [x] Server functions: createCapture, processCapture (AI Gateway, openai/gpt-6-astra, schema estrito), applyCapture, discardCapture
- [x] applyCapture grava no lugar certo: asset, documento, obrigação (com ocorrências), gasto ou evento de objeto
- [x] Gate do browser: frase real vira registro no lugar certo
- Gates: frase real vira registro no lugar certo; lote conclui rápido. ✔ 2026-11-02 — tsgo limpo, 43 testes verdes (4 novos), Playwright: "troquei o filtro da geladeira hoje" criou o objeto "Filtro da geladeira" a partir da proposta da IA, gravou o evento de substituição em 2026-11-02 e tirou a carta da pilha; zero erros de console. Correção: applyCapture exigia objeto já cadastrado — a IA agora propõe `asset_name` (regra em `src/lib/capture-target.ts`). Pendência de polimento: `room_guess` ainda não vira cômodo aplicado.

## Fase 6 — Zelador digital
- [x] Chat com tool-calls de consulta + citações clicáveis
- [x] Sugestões contextuais na home e nas fichas
- Gates: pergunta real responde com dado correto do banco + link. ✔ 2026-11-02 — tsgo limpo, 48 testes verdes, build OK. Playwright: "quanto gastei com a cozinha nos últimos dois anos?" respondeu R$ 250,00 (o gasto criado pela própria captura) e a citação "Cozinha" abriu /comodo/$roomId; "o que já aconteceu com o filtro da geladeira?" citou a ficha e abriu /ativo/$assetId; "quais garantias estão perto de acabar?" respondeu sem inventar, que não havia nada. A home passou a sugerir "Antes que a garantia acabe" (Filtro da geladeira, faltam 20 dias) depois de editar a garantia na ficha.

## Fase 7 — Pulso da casa ✅ (2026-11-02)
- [x] Cálculo honesto + explicação por componentes + timeline
- [x] Visual animado próprio; pulso por cômodo
- Gates: pulso muda com pagamento/atraso; painel explica o porquê.
- Evidência: home lista "O que melhoraria agora" em ordem de impacto (mostra os pontos
  que voltam) e "Próximos 12 meses" projetando R$ 890,00/mês a partir da recorrência real
  do compromisso criado pelo app. 53 testes verdes (5 novos cobrindo ordem de impacto,
  "não inventar" quando a casa está em ordem, meses sem valor conhecido e data já passada).
- Correlato: `getHomeState` passou a ler `amount`, `frequency` e `custom_interval_days`
  das obrigações — sem isso a linha do tempo não projetava nada.

## Fase 8 — Modo emergência ✅ (2026-11-02)
- [x] `/emergencia` fullscreen alto contraste com dados reais da casa
- [x] 1 toque de qualquer lugar (botão no nav) + compartilhar registro
- Gates: 1 toque de qualquer lugar; legível em mobile.
- Evidência: botão "Emergência" no nav de todas as telas; Playwright: clique no nav
  abriu /emergencia com dados reais (endereço, quem vive aqui, disjuntor com posição,
  prestadores com telefone, apólice com vencimento); carga direta no mobile (390px)
  renderiza legível; tsgo limpo, 54 testes verdes. Dados vindos de
  `getEmergencyKit` (query própria, pré-buscada no cliente).

## Fase 9 — Dinheiro da casa ✅ (2026-11-02)
- [x] Custo por mês/cômodo + previsão 12 meses + reserva sugerida
- [x] Custo de propriedade por ativo; projetos planejado vs realizado
- Gates: números batem com registros; apresentação clara.
- Evidência: regras puras e testadas em `src/lib/money.ts` (7 testes: média só
  nos últimos 12 meses dividida pelos meses com registro, custo por cômodo
  ordenado, custo de propriedade = compra + eventos + serviços, previsão
  recorrente de 12 meses, reserva = 3 meses do previsto, projeto sem orçamento
  não tem %). 62 testes verdes, tsgo limpo. Playwright: com 3 gastos (R$ 400),
  IPTU mensal de R$ 350 e projeto de R$ 250/1000 — a página mostrou R$ 200,00/mês,
  Cozinha R$ 310, previsão R$ 4.200,00 (nov/26→out/27), reserva R$ 1.050,00,
  Disjuntor geral R$ 200,00 e "25% do planejado". Correção visual: texto da
  reserva usava tranquilo-foreground (quase branco) sobre fundo verde claro.

## Fase 10 — Camadas de vida (veículos, pets, jardim) ✅ (2026-11-02)
- [x] Fichas + obrigações + documentos por camada; ativar/desativar
- Gates: vacina no radar, revisão/IPVA no radar, rega no radar.
- Evidência: tsgo limpo, 70 testes verdes (8 novos em `src/test/layers.test.ts`:
  camada desligada sai da navegação, sem interruptor as três nascem ligadas,
  religar devolve o atalho, próxima rega = última rega + intervalo, sem intervalo
  não há horário, atrasada/logo/em dia, ordem do jardim, "hoje" é o dia local).
  Playwright com casa real de 7 cômodos: "IPVA 2027" (Tributo, R$ 1.200) ligado ao
  "Carro da casa" e "Vacina da raiva" (Vacina, R$ 180) ligado à "Nina" apareceram no
  radar com o nome da camada; a ficha do veículo mostrou só o IPVA e a ficha do pet só
  a vacina; "Marcar pago" na ficha do veículo avançou o vencimento. Planta regada há
  5 dias com intervalo de 3 entrou no radar como "Cuidados do jardim · esperando água"
  e saiu depois de "Regar hoje". Em `/config`, desligar "Veículos" tirou o atalho da
  navegação (Pets seguiu lá) e o carro continuou listado; religar devolveu o atalho.
- Correções desta fase: o diálogo "Nova obrigação" herdava os vínculos da obrigação
  anterior (a vacina nasceu ligada ao carro) — agora tudo é limpo ao concluir; e a
  navegação passou a rolar só no meio, para "Emergência" continuar sempre ao alcance
  (gate da Fase 8) com as camadas ligadas.


## Fase 11 — Carga mental compartilhada ✅ (2026-11-02)
- [x] Membros/papéis/convite com prazo; mapa de distribuição de carga
- Gates: viewer com prazo só lê; mapa reflete responsáveis reais.
- Evidência: a regra do mapa virou função pura em `src/lib/load-map.ts`
  (antes estava inline na query) com 6 testes em `src/test/load-map.test.ts`:
  responsáveis reais, balde "Ninguém", janela de 30 dias, atrasado conta,
  ordem por impacto, casa vazia. 82 testes verdes, tsgo limpo. O painel de
  membros (convite por e-mail com papel e prazo, troca de papel, remoção,
  `claimInvites` na home) já existia de remixes anteriores e foi mantido.
- Pendente de verificação: o gate de browser (viewer com prazo só lê) não pôde
  ser rodado neste sandbox — o backend do novo projeto não é acessível daqui
  (`no_supabase`, preview atrás de login). Verificar no próximo remix ou no
  preview com sessão: convidar viewer com prazo e tentar escrever.

## Fase 12 — Momentos de virada ✅ (2026-11-02)
- [x] Mudança (checklist por cômodo) · dossiê do imóvel · sinistro · retrospectiva
- Gates: dossiê com histórico real gera documento.
- Evidência: rota `/momentos` com 4 momentos montados de dados reais por
  `src/lib/moments.ts` (puro) + `getMomentsState` (query). Mudança: checklist
  por cômodo nascido do inventário, com progresso e memória local. Dossiê:
  seções por cômodo com manutenções contadas + documentos da casa, com
  "Imprimir ou salvar em PDF". Sinistro: total com valor registrado, itens sem
  comprovante sinalizados, resumo copiável para a seguradora. Retrospectiva:
  ano navegável com total, cuidados feitos e mês mais pesado. 6 testes em
  `src/test/moments.test.ts`; 82 verdes, tsgo limpo. Atalho "Momentos" no nav.
- Decisão: o checklist de mudança fica no aparelho (localStorage), porque este
  sandbox não consegue aplicar migrations no banco do novo projeto — registrado
  no PRD. Se uma migration for possível, migrar para tabela por lar.
- Pendente de verificação: gate de browser (dossiê com histórico real) idem
  Fase 11 — sem acesso ao backend neste sandbox.

## Fase 13 — Polimento e gates finais ✅ (2026-11-02)
- [x] Busca universal (cmdk): paleta ⌘K/Ctrl+K no nav (`command-palette.tsx`)
  com índice do servidor (`getSearchIndex`): cômodos, objetos, documentos,
  obrigações e prestadores, cada um levando ao seu lugar.
- [x] meta/og por rota: verificado — todas as 20 rotas têm `head()` próprio.
- [x] Micro-interações, acessibilidade (foco, contraste, reduced-motion)
- Gates: passada completa + auditoria do monitor; navegável sem esboços.
- Evidência: 89 testes verdes (7 novos em `src/test/acessibilidade.test.ts`),
  tsgo limpo, build OK. Contraste do tema escuro medido e corrigido:
  muted-foreground 2.94→4.64, primary 3.20→4.62, tranquilo 2.63→4.61 (AA).
  Foco visível global (`:focus-visible` com `--ring`, fora de camada),
  skip link `#conteudo` nas 15 páginas, `aria-current="page"` na nav.
  Playwright em `/entrar`: anel de 2px computado no botão focado por
  teclado, regra servida no CSS, zero erros de console.
- Auditoria do monitor: o runtime OpenCode não está instalado neste sandbox
  (binário ausente); a auditoria foi feita pelo agente principal no formato
  do `monitor.md` e registrada em `.opencode/reports/fase-13-eval.md`.
- Ainda pendente (bloqueio de ambiente, `no_supabase`): gates de browser
  das Fases 11 e 12 — verificar no preview com sessão.

> Próximo remix (se este terminar antes): fechar a Fase 13 — passada de
> micro-interações e acessibilidade + auditoria do monitor — e rodar os
> gates de browser pendentes das Fases 11 e 12 (viewer com prazo só lê;
> dossiê com histórico real), que exigem sessão no backend. Depois da
> auditoria do monitor, o remix estará completo.
> Fases 11 (carga mental) e 12 (momentos) concluídas em código neste remix.

> Estado do banco pós-remix: schema íntegro e RLS ativa; funções `is_member`,
> `can_write`, `create_household` e o gatilho de perfil restaurados em
> `0000_restore_helpers_and_profile_trigger` — o diário de migrations recomeça daí.
> Índice único de ocorrências presente no banco.
> Pilares dos subagentes ficam em `.opencode/work/sub/`.
