# Roadmap — remix Casa Viva (2026-11-02)

Estado do remix, fase a fase. Detalhe completo em `.opencode/roadmap-proj1.md`.

- [x] Ativação Cloud: 19 tabelas protegidas recriadas, tipos regenerados, login por e-mail/Google/Lovable habilitado e cofre privado configurado; preview sem erros.
- [x] Verificação após ativação: 89 testes passaram; login, criação de casa com Sala e leitura após recarregar confirmados no browser, sem erros; conta e casa temporárias removidas.

- [x] Migrations recriadas vazias; banco do novo projeto verificado (schema íntegro, RLS ativa, sem dados)
- [x] Gatilho de perfil recriado — signup volta a criar a ficha do morador
- [x] Gates de fundação: typecheck limpo, testes verdes, casa com 7 cômodos navegável
- [x] Fase 5: frase real vira registro no lugar certo (a casa cadastra o objeto que ainda não tinha)
- [x] Fase 6: zelador digital — responde com os registros reais, cita a ficha de onde tirou, e a home sugere a garantia que está acabando
- [x] Fase 7: pulso da casa — "o que melhoraria agora" em ordem de impacto + linha do tempo de 12 meses com valores reais
- [x] Fase 8: modo emergência (`/emergencia` fullscreen, alto contraste, dados reais)
- [x] Fase 9: dinheiro da casa (custo por mês/cômodo, previsão 12 meses, reserva, custo de propriedade, projetos)
- [x] Fase 10: camadas de vida — veículos, pets e jardim com ficha, obrigações, documentos e ativação por camada
- [x] Fase 11: carga mental compartilhada — membros, papéis, convite com prazo e mapa de carga com regra pura testada (`src/lib/load-map.ts`)
- [x] Fase 12: momentos de virada — `/momentos` com mudança (checklist por cômodo), dossiê (imprimível), sinistro (pacote copiável) e retrospectiva anual, tudo de dados reais
- [~] Fase 13: busca universal (⌘K) e meta/og por rota prontos; faltam a passada de micro-interações/acessibilidade e a auditoria do monitor
- [ ] Pendentes de prova ao vivo (backend inacessível deste sandbox): viewer com prazo só lê (F11); dossiê com histórico real no browser (F12)
