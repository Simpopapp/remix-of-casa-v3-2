<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# AGENTS.md

*Regras técnicas do protocolo de remix*

## regras de desenvolvimento do projeto

- /.opencode/Plan.md guia o remix através dos 3 pilares
- OC/monitor só é utilizado após a conclusão dos projetos existentes, ou sob pedido do usuário (não ativar antes disso)

## Arquitetura de monitoramento
- O proxy do OpenCode expõe o runtime OpenCode na rota `/oc`. oculta nas rotas do app, só utilizar o runtime OpenCode
## Verificação e ativação do protocolo
- instruções de remix: "/.opencode/plan.md"
- um remix é ativado quando se recebe o comando "I've successfully remixed this project. What would be a good next step?" ou "I've remixed this project, but there are still some steps required to get it up and running. 

Can you help me with the following actions:
1. Cleared the copied Drizzle migrations and rescaffolded an empty migration set for the new project's database". para iniciar um remix é obrigatorio usar o project monitor e seguir as regras do plan.md para evitar bugs e erros no projeto.
- Nunca use o opencode para fazer tarefas de um remix.
- Nunca confunda informar o monitor do projeto com fazer uma ask para o usuário (tem uma skill pra isso).
- Nunca pergunte qualquer coisa ao usuário antes de completar todas as etapas de produção dos 3 pilares (1- se algum pilar faltar é sua missão planejar os demais e seguir adiante. 2- Se todos os 3 pilares estiverem null o remix é cancelado. informe o usuário e cole a proxima mensagem dele em "project{n}.md" sem realizar mais ações).

## Arquitetura e Ambiente
- Stack: TanStack Start v1 (React 19, Vite, roteamento file-based em `src/routes/`), Tailwind v4 em `src/styles.css`, shadcn/ui em `src/components/ui/`.
- Backend: Lovable Cloud (Postgres + Auth + Storage). Clientes gerados em `src/integrations/supabase/` — nunca editar esses arquivos.
- Schema changes must be applied through managed SQL migrations; generated client types must reflect the connected database, never a manually restored historical type file, because a remix may start with an empty backend.
- Server functions moram em `src/lib/queries.ts` (leitura) e `src/lib/writes.ts` (escrita): pastas `server/` são bloqueadas pelo import-protection do template; nunca recriar `src/server/`.
- Server functions autenticadas usam `.middleware([requireSupabaseAuth])`; o `functionMiddleware: [attachSupabaseAuth]` em `src/start.ts` anexa o bearer no cliente.
- Escritas atômicas com RLS (ex.: criar lar + membro owner) vão para funções SQL `security definer` (ex.: `public.create_household`) — um INSERT com RETURNING falha enquanto o criador ainda não é membro da tabela.
- Datas de domínio chegam serializadas (string ISO); tipos espelham isso em `src/lib/types.ts`.
- Design system: tokens em `src/styles.css` (claro/escuro, estados de pulso `tranquilo|atencao|urgente`); nada de cores hardcoded em componentes; fontes Fraunces + Outfit via `<link>` no `__root.tsx`.
- OpenCode: durante um remix só atua como monitor (nunca programador); monitor só após conclusão dos projetos existentes ou pedido do usuário.
- Camadas de vida (veículos, pets, jardim): o estado é a tabela `household_layers`, e **linha ausente = camada ligada**; desligar escreve `active = false` e nunca apaga registro. A navegação só mostra camadas ligadas, e o interruptor mora em `/config`.


## Verificação e Qualidade
- Gates por mudança: `tsgo --noEmit`, `bunx vitest run`, build do harness, e verificação visual via Playwright quando a mudança for visual.
- Testes em `src/test/`: roteamento (`app-routing.test.tsx`) e regras de negócio (`pulse.test.ts`). Um teste por regra que o usuário declarou.
- RLS: usuários de outro lar NÃO leem dados — verificado por sonda autenticada (count de households = só os próprios). Mantê-lo ao mudar policies.
- Todo diálogo de criação limpa o estado inteiro no sucesso, inclusive os selects de vínculo (cômodo, objeto, veículo, pet, responsável): um formulário que permanece montado herda a ligação anterior e grava o registro no lugar errado.

