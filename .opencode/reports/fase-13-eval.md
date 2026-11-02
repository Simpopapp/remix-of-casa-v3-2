# Avaliação — Fase 13 (polimento e gates finais) + auditoria final do remix

**Data:** 2026-11-02
**Veredito:** concluída (com duas verificações de browser bloqueadas pelo ambiente)
**Confiança da avaliação:** alta no código; média nos gates que exigem sessão

> Nota de método: o runtime OpenCode (monitor) não está instalado neste
> sandbox (binário ausente, `.opencode/node_modules` removido do zip). A
> auditoria foi executada pelo agente principal seguindo o formato e o
> ceticismo do `monitor.md`, e esta substituição foi registrada no PRD.

## Resumo executivo

As 13 fases do roadmap estão concluídas em código, com 89 testes verdes,
`tsgo` limpo e build OK. A passada de acessibilidade desta fase corrigiu
quatro falhas reais de contraste no tema escuro e instituiu foco visível
global, atalho "pular para o conteúdo" e marcação de página atual na
navegação — tudo coberto por testes novos. Restam dois gates de browser
(Fases 11 e 12) que dependem de sessão no backend, inacessível deste
sandbox (`no_supabase`).

## Cobertura de requisitos (Fase 13)

- Atendido: busca universal ⌘K/Ctrl+K (fase anterior); meta/og nas 20 rotas
  (verificado na fase anterior); foco visível global (`:focus-visible` com
  `--ring`, fora de camada para vencer `outline-none`); contraste AA no
  tema escuro (muted-foreground 2.94→4.64, primary 3.20→4.62, tranquilo
  2.63→4.61, medidos em oklch); reduced-motion global (já existia, agora
  testado); `aria-current="page"` + `aria-label` na nav; skip link
  `#conteudo` presente nas 15 páginas com `<main>`.
- Parcial: micro-interações — hover/active existem em nav, planta e cartas;
  não houve passada exaustiva de estados vazios tela a tela.
- Ausente / não evidenciado: gates de browser das Fases 11 (viewer com
  prazo só lê) e 12 (dossiê com histórico real) — bloqueados pelo ambiente.

## Qualidade do código

- Pontos fortes: regras de negócio em funções puras testadas
  (`pulse`, `recurrence`, `money`, `load-map`, `moments`, `layers`,
  `capture-target`); tokens sem cor hardcoded; contraste corrigido por
  medição, não por chute; cada regra de acessibilidade com teste que falha
  se a regra for removida.
- Pontos de atenção: o teste de acessibilidade lê o CSS como texto — se o
  tema escuro for reescrito em outra sintaxe, o teste precisa acompanhar.

## Discrepâncias

- O roadmap marcava Fase 13 como parcial; após esta passada, o código
  corresponde ao escopo declarado, exceto os dois gates de browser acima.

## Riscos para as próximas etapas

- Verificar no preview com sessão: viewer com prazo não escreve (RLS) e
  dossiê imprime com histórico real. São os únicos gates sem evidência.
- O checklist de mudança persiste em localStorage; se uma migration for
  possível, migrar para tabela por lar (decisão já registrada no PRD).

## Recomendações

- No próximo acesso com backend: rodar os dois gates pendentes e, se
  passarem, considerar o remix integralmente verificado.

## Evidências consultadas

- `src/styles.css` (tokens, foco, reduced-motion), `src/components/app-nav.tsx`,
  `src/components/planta/PlantaIsometrica.tsx`, 15 rotas com `<main id="conteudo">`.
- `bunx vitest run`: 89/89 verdes (7 novos em `src/test/acessibilidade.test.ts`).
- Playwright em `/entrar`: regra `:focus-visible` servida, anel de 2px
  computado no botão focado via teclado, tema escuro aplicado, zero erros
  de console. Build OK no log do harness.
- Medição de contraste: script oklch→RGB→luminância relativa (WCAG) sobre
  todos os pares texto/fundo dos dois temas.
