# Instruções Padrão para Agentes e LLMs (Antigravity & OpenCode)

Antes de planejar ou implementar qualquer alteração neste repositório (`myBudget` / `MyFinance`), **leia obrigatoriamente** o arquivo [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) na raiz do projeto.

## Fluxo Obrigatório
1. **Leitura inicial:** consulte `PROJECT_CONTEXT.md` antes de propor arquitetura, editar schema, criar endpoints ou alterar regras de negócio/UI.
2. **Preservação de invariantes:** respeite todas as regras de negócio descritas na Seção 7 de `PROJECT_CONTEXT.md` (contas remuneradas/cofrinhos com PEPS/FIFO, datas e fuso horário, faturas de cartão e portadores, fluxo de caixa, layout livre do Resumo, modo privacidade `<Money />` e cotações).
3. **Lógica pura testável:** mantenha regras de negócio puras desacopladas de NestJS/Prisma/React/aliases `@/` (`backend/src/**/__tests__/*.spec.ts` e `frontend/src/lib/*.ts` com `.test.ts` compatível com `node --test`).
4. **Verificação após alterações:**
   - Frontend: `cd frontend && node --test src/lib/*.test.ts` e `npm run build` (e `npx eslint` nos arquivos alterados).
   - Backend: `cd backend && npm run build` e `npx jest` nos módulos afetados.
5. **Atualização contínua:** sempre que concluir uma nova funcionalidade, alteração de schema/API ou mudança relevante de comportamento, atualize o `PROJECT_CONTEXT.md` para mantê-lo sincronizado para as próximas execuções.
6. **Rotina Git (`dev` -> nova branch):** ao concluir uma entrega ou antes de iniciar uma nova funcionalidade/estudo, commitar as alterações validadas na branch `dev` e criar/alternar para uma nova branch temática (ex.: `feat/...`, `fix/...`, `study/...`).

