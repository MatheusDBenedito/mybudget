# Project Context — myBudget (MyFinance)

> Documento de referência arquitetural e operacional para que qualquer LLM consiga ler o estado atual do repositório, entender as regras de negócio e executar planos de implementação com segurança e consistência.

---

## 1. Visão Geral

- **Repositório:** `myBudget` (nome exibido na UI: **MyFinance**)
- **Propósito:** Aplicação web **single-user** (sem autenticação) para controle financeiro pessoal, contas bancárias (correntes e remuneradas com cofrinhos), cartões de crédito com múltiplos portadores e importação de fatura em PDF, fluxo de caixa projetado, carteira de investimentos (renda fixa, B3, EUA, cripto, outros), programa de milhas/pontos e relatórios.
- **Idioma da UI e domínio:** Português do Brasil (`pt-BR`), moeda padrão `BRL` (com suporte a `USD` para ações/ETFs americanos e conversão via câmbio).

---

## 2. Stack e Versões

| Camada | Tecnologias |
|---|---|
| **Backend** | NestJS 11 (`@nestjs/core` ^11.0.1), TypeScript ^5.7.3, Prisma ORM (`@prisma/client` / `prisma` ^6.19.2), `class-validator`, `class-transformer`, `date-fns`, `pdf-parse` / `pdfjs-dist`, Jest 30 |
| **Banco de Dados** | PostgreSQL 15 via Docker (`docker-compose.yml`) |
| **Frontend** | Next.js 16.1.6 (App Router, Turbopack), React 19.2.3, TypeScript ^5, Tailwind CSS v4 (`@tailwindcss/postcss` ^4), shadcn/ui + `radix-ui`, `lucide-react`, `recharts`, `react-hook-form` + `zod`, `react-number-format`, `sonner` |
| **Testes** | Backend: Jest (`*.spec.ts`) · Frontend unitários: `node --test` (Node 24+ com TS nativo) · E2E: Cypress 15 |

---

## 3. Ambiente Local, Portas e Comandos

### Portas e Serviços
- **PostgreSQL (Docker):** `localhost:5432` (`budget_db`, usuário/senha locais definidos em `docker-compose.yml` e `.env.example`)
- **Backend (NestJS):** `http://localhost:3333` (`backend/src/main.ts`, CORS habilitado globalmente, `ValidationPipe({ whitelist: true, transform: true })`)
- **Frontend (Next.js):** `http://localhost:3000`

### Variáveis de Ambiente
- O backend carrega `../.env` (raiz do repositório) no `main.ts` e o Prisma lê `DATABASE_URL` via `backend/prisma.config.ts` e `backend/.env`.
- Variáveis esperadas (ver `.env.example`):
  - `DATABASE_URL`
  - `BRAPI_TOKEN` (usado para cotações de ações/FIIs da B3 na `brapi.dev` e fallback de ações US)
- **Atenção:** No frontend, a URL da API (`const API = "http://localhost:3333"`) está definida diretamente nos arquivos de páginas/helpers (`frontend/src/app/**/page.tsx`, `frontend/src/lib/dashboard-layout-api.ts`, etc.), sem `NEXT_PUBLIC_*`.

### Comandos Essenciais
```powershell
# 1. Subir banco PostgreSQL
docker compose up -d

# 2. Backend (diretório backend/)
npm run start:dev          # servidor em watch mode na porta 3333
npm run build              # build NestJS
npm test                   # Jest (ver nota na seção 8 sobre specs boilerplate)
npx prisma migrate dev     # criar/aplicar migrations
npx prisma generate        # atualizar Prisma Client após alterar schema.prisma

# 3. Frontend (diretório frontend/)
npm run dev                # Next.js dev server na porta 3000
npm run build              # build de produção Next.js
npm run lint               # ESLint
node --test src/lib/*.test.ts   # testes unitários das funções puras (84 testes)
npm run cypress:run        # testes E2E (requer servidores rodando)
```

---

## 4. Estrutura do Repositório

```text
myBudget/
├── docker-compose.yml              # Serviço Postgres 15 (porta 5432)
├── .env.example                    # DATABASE_URL, BRAPI_TOKEN
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma           # Schema completo do banco
│   │   └── migrations/             # Histórico de migrations (Prisma 6)
│   └── src/
│       ├── main.ts                 # Bootstrap NestJS (porta 3333, dotenv ../.env)
│       ├── app.module.ts           # Registro de todos os módulos
│       ├── prisma/                 # PrismaService global
│       ├── common/helpers/
│       │   └── penny-pinching.helper.ts  # distributeInstallments()
│       ├── accounts/               # Contas, transferências, ajustes, yields e cofrinhos
│       ├── transactions/           # Receitas/despesas em conta + projeção de fixas
│       ├── recurring-expenses/     # Despesas recorrentes legadas/auxiliares
│       ├── credit-cards/           # Cartões, cartão principal e calculateInvoiceDate()
│       ├── card-holders/           # Portadores (titular/adicionais) por cartão
│       ├── card-transactions/      # Compras no cartão, parcelamento, estorno, import PDF
│       ├── cash-flow/              # Agregação mensal/anual do fluxo de caixa
│       ├── investments/            # Renda fixa (CDI/IR), B3, US Stocks, Cripto, Outros
│       ├── miles/                  # Lançamentos de pontos/milhas
│       ├── reports/                # Gastos por categoria e evolução mensal
│       ├── dashboard-layout/       # Persistência do layout customizável do Resumo
│       └── seed/                   # Wipe + seed inicial (POST /seed)
└── frontend/
    ├── cypress/e2e/                # cartoes.cy.ts, dashboard.cy.ts, transaction_modal.cy.ts
    └── src/
        ├── app/
        │   ├── layout.tsx          # Layout raiz, script anti-flash do modo privacidade, footer
        │   ├── globals.css         # Tokens semânticos (Investidor10-style) e blur de privacidade
        │   ├── page.tsx            # Resumo (Dashboard com grid editável)
        │   ├── fluxo-de-caixa/     # Planilha de fluxo de caixa e lançamentos do mês
        │   ├── investimentos/      # Carteira, modal de aporte, projeção renda fixa
        │   ├── cartoes/            # Faturas por mês/cartão/portador, import PDF, estornos
        │   ├── milhas/             # Saldo por programa, estimativa por cartão, calculadora bônus
        │   ├── relatorios/         # Gráficos e análises
        │   └── configuracoes/      # Contas, cofrinhos, transferências, cartões, categorias
        ├── components/
        │   ├── ui/                 # Primitivos shadcn/Radix + currency-input + trend
        │   ├── dashboard/          # DashboardGrid, DashCard, ForecastCard, BillsCard, etc.
        │   ├── cash-flow/          # CashFlowSheet, MonthTransactions, Settle/Delete dialogs
        │   ├── cards/              # InvoiceGroupSection
        │   ├── miles/              # CardPointsEstimate, MilesEntriesTable, TransferBonusCalculator
        │   └── *.tsx               # AppHeader, Money, Panel, StatCard, AccountManager, YieldPots, etc.
        └── lib/
            ├── *.ts                # Funções puras testáveis + format.ts, charts.ts, privacy.tsx
            └── *.test.ts           # Suítes `node --test`
```

---

## 5. Modelo de Dados (`backend/prisma/schema.prisma`)

### Enums
- `TransactionType`: `INCOME | EXPENSE | TRANSFER`
- `TransactionStatus`: `PENDING | PAID | CANCELLED`
- `AccountType`: `CHECKING | YIELDING`
- `InvestmentType`: `FIXED_INCOME | VARIABLE_INCOME | FII | CRYPTO | US_STOCK | OTHER`
- `MilesStatus`: `PENDING | TRANSFERRED | CREDITED`

### Models e Relações Principais
1. **`Account`**: `name`, `balance` (`Float`, em BRL), `currency` (`"BRL"` default | `"USD"`), `balanceUsd` (`Float?` — saldo em dólares quando `currency == "USD"`), `investedBrl` (`Float?` — valor gasto em reais na compra dos dólares), `purchaseExchangeRate` (`Float?` — câmbio pago na compra), `type` (`CHECKING` default | `YIELDING`), `cdiPercentage` (`Float?`), `yieldSince` (`DateTime?`). Para contas em `USD`, o `balance` em BRL flutua automaticamente conforme a cotação atual do dólar (`USD-BRL` via AwesomeAPI/Yahoo Finance), retornando também `currentExchangeRate`, `variationBrl` e `variationPct`. Relaciona com `Transaction[]`, `CreditCard[]`, `RecurringExpense[]`, `YieldPot[]`, `AccountYield[]`, `BalanceAdjustment[]`, `AccountTransfer[]` (`TransfersOut` / `TransfersIn`).
2. **`YieldPot`** ("cofrinho"): pertence a `Account` (`onDelete: Cascade`), possui `name`, `cdiPercentage`, `balance` (já embutido no `Account.balance`), e `PotMovement[]` (`amount`, `kind`: `"transfer" | "adjustment"`, `date`).
3. **`AccountYield`**: rendimento diário creditado por conta, `bucket` (`"main"` para saldo livre ou `pot.id`), e `date` (`@db.Date`) com `@@unique([accountId, bucket, date])`. Registra `cdiDailyRate`, `cdiPercentage`, `balanceBefore`, `grossAmount`, `irRate`, `taxAmount`, `netAmount`, `taxRefund`.
4. **`BalanceAdjustment`**: histórico datado de ajustes manuais de saldo em `Account` (`amount`, `date`) para cálculo retroativo correto de rendimentos em lotes.
5. **`AccountTransfer`**: transferência entre contas (`fromAccountId`, `toAccountId`, `amount`, `date`, `description`). Não é receita nem despesa.
6. **`Category`**: `name`, `color?`, `icon?`. Relaciona com `Transaction`, `CardTransaction`, `RecurringExpense`.
7. **`Transaction`**: `description`, `amount`, `date`, `type`, `status`, `isFixed`, `fixedUntil` (`DateTime?` — encerra projeção futura sem apagar histórico), `accountId`, `categoryId?`.
8. **`CreditCard`**: `name`, `limit`, `invoiceClosingOffset` (`Int`, default 7 dias antes do vencimento), `dueDay` (`Int`, 1–31), `color?`, `pointsPerDollar?`, `loyaltyProgram?`, `isPrimary` (`Boolean`), `accountId`. Relaciona com `CardHolder[]`, `CardTransaction[]`, `MilesEntry[]`.
9. **`CardHolder`**: portador do cartão (`creditCardId`, `name`, `last4?`, `isMain`), `@@unique([creditCardId, name])`. Titular e adicionais compartilham limite e fatura.
10. **`CardTransaction`**: `description`, `amount` (positivo para compra, negativo para estorno), `date` (data da compra), `invoiceDate` (data de vencimento da fatura calculada), `installments`, `isFixed`, `ignoredInvoices` (lista de `"YYYY-MM"` ignorados na projeção fixa), `installmentGroupId?`, `creditCardId`, `cardHolderId` (`onDelete: Restrict`), `categoryId?`.
11. **`RecurringExpense`**: modelo de recorrência em conta (`description`, `amount`, `billingDay`, `isActive`, `accountId`, `categoryId?`).
12. **`Investment`**: `name`, `type`, `investedAmount`, `currentValue`, `investmentDate?`, `cdiPercentage?`, `sector?`, `tickerCode?`, `averagePrice?`, `currentPrice?`, `quantity?`, `purchaseExchangeRate?` (para `US_STOCK`). Relaciona com `InvestmentDividend[]`.
12a. **`InvestmentDividend`**: histórico de proventos (dividendos/JCP/rendimentos) recebidos por aporte (`investmentId`, `tickerCode`, `date`, `amountPerShare`, `quantity`, `totalOriginal`, `currency`, `totalBrl`, `@@unique([investmentId, date, amountPerShare])`).
13. **`MilesEntry`**: `program`, `points`, `status`, `expectedCreditDate`, `creditCardId?` (`onDelete: SetNull`), `origin?`, `referenceMonth?`, `referenceYear?`, `notes?`.
14. **`DashboardLayout`**: singleton (`id = "default"`), `items` (`Json` com ordem, largura em `%` e altura em `px` dos blocos do Resumo).

---

## 6. Mapeamento da API REST (Backend — porta `3333`)

- **App / Seed / Layout / Reports:**
  - `GET /` (`AppController`)
  - `POST /seed` (`SeedController` — **atenção: apaga dados existentes antes de popular**)
  - `GET /dashboard-layout`, `PUT /dashboard-layout`
  - `GET /reports/expenses-by-category`, `GET /reports/monthly-evolution`
- **Accounts, Yields, Pots & Transfers (`AccountsController` — `/accounts`):**
  - `GET /accounts`, `POST /accounts`, `GET /accounts/:id`, `PATCH /accounts/:id`, `DELETE /accounts/:id`
  - `PATCH /accounts/:id/free-balance`
  - `POST /accounts/yields/accrue`, `POST /accounts/:id/yields/recompute`, `GET /accounts/:id/yields`, `GET /accounts/:id/lots`
  - `GET /accounts/:id/pots`, `POST /accounts/:id/pots`, `PATCH /accounts/pots/:potId`, `DELETE /accounts/pots/:potId`
  - `POST /accounts/pots/:potId/deposit`, `POST /accounts/pots/:potId/withdraw`, `POST /accounts/pots/:potId/adjust`
  - `GET /accounts/transfers`, `POST /accounts/transfers`, `DELETE /accounts/transfers/:transferId`
- **Transactions & Recurring (`TransactionsController`, `RecurringExpensesController`):**
  - `GET /transactions`, `POST /transactions`, `PATCH /transactions/:id`, `PATCH /transactions/:id/status`, `DELETE /transactions/:id`
  - `POST /recurring-expenses`, `POST /recurring-expenses/process-monthly`
- **Cash Flow (`CashFlowController`):**
  - `GET /cash-flow`
- **Categories (`CategoriesController`):**
  - `GET /categories`, `POST /categories`, `PATCH /categories/:id`, `DELETE /categories/:id`
- **Credit Cards, Holders & Card Transactions:**
  - `GET /credit-cards`, `POST /credit-cards`, `PATCH /credit-cards/:id`, `PATCH /credit-cards/:id/primary`
  - `GET /credit-cards/:creditCardId/holders`, `POST /credit-cards/:creditCardId/holders`, `PATCH /credit-cards/:creditCardId/holders/:id`, `DELETE /credit-cards/:creditCardId/holders/:id`
  - `POST /card-transactions`, `POST /card-transactions/preview`, `POST /card-transactions/:id/estorno`, `PATCH /card-transactions/:id`, `DELETE /card-transactions/:id`
  - `GET /card-transactions/summary/invoice`, `GET /card-transactions/:creditCardId/invoice`
  - `POST /card-transactions/import-pdf`, `POST /card-transactions/import-pdf/debug`, `POST /card-transactions/import-pdf/confirm`
- **Investments, Dividends & Miles:**
  - `GET /investments`, `POST /investments`, `GET /investments/:id`, `PATCH /investments/:id`, `DELETE /investments/:id`
  - `GET /investments/dividends`, `POST /investments/dividends/sync`
  - `GET /investments/projections` (`month`, `year`, `months` — projeção de 12 meses de dividendos programados a receber, média mensal de FIIs e retorno líquido de Renda Fixa)
  - `GET /miles`, `POST /miles`, `PATCH /miles/:id`, `DELETE /miles/:id`

---

## 7. Regras de Negócio e Invariantes Críticas

Qualquer plano executado neste projeto deve preservar estas regras:

1. **Contas, Saldos e Rendimentos (`accounts`):**
   - `Account.balance` representa o **saldo total** da conta (saldo livre + soma dos `YieldPot.balance`). `freeBalance = balance - sum(pots.balance)`.
   - Contas `CHECKING` nunca têm `cdiPercentage` nem `yieldSince`. Contas `YIELDING` exigem `cdiPercentage > 0` e passam a render a partir de `yieldSince` (sem retroativo anterior à ativação).
   - `AccountYieldService` roda na inicialização (`OnModuleInit`) e a cada hora (`ACCRUAL_INTERVAL_MS = 1h`), consumindo CDI diário da **série 12 do BCB**. É idempotente via `@@unique([accountId, bucket, date])`.
   - Cálculo de rendimento (`account-yield.calculator.ts`): cada aporte cria um **lote** com data própria; retiradas consomem os lotes mais antigos (**PEPS/FIFO**); IR segue a tabela regressiva brasileira por dias corridos (`<=180: 22.5%`, `<=360: 20%`, `<=720: 17.5%`, `>720: 15%`), e IR já retido em dias anteriores não é estornado ao mudar de faixa.
   - `AccountTransfer` e `BalanceAdjustment` apenas movem/ajustam saldo e lotes; **nunca** entram como receita/despesa no fluxo de caixa ou relatórios.
   - Ao liquidar despesas no frontend (`defaultSettlementAccount`), priorizar contas `CHECKING` para evitar mexer em saldo que rende CDI.

2. **Transações em Conta (`transactions`):**
   - Ao criar sem `status`, `TransactionsService.create` define `PAID` se `date <= fim de hoje`, senão `PENDING`. Apenas transações `PAID` alteram `Account.balance`.
   - Transações com `isFixed: true` são projetadas para meses futuros usando o último registro ativo da série (ignorando registros anteriores já encerrados por `fixedUntil` antes da marcação de série ativa) e evitando duplicação por `(type, description)` independentemente do valor ajustado no mês.
   - `PATCH /transactions/:id` e `PATCH /transactions/:id/status` permitem alterar estimativas mensais (`scope: 'single'` materializa/atualiza apenas aquele mês com `fixedUntil` no fim do mês, mantendo a estimativa futura intacta; `scope: 'series'` atualiza deste mês em diante), sincronizando diferenças no `Account.balance` se já estiver `PAID`.

3. **Cartões de Crédito e Faturas (`credit-cards`, `card-transactions`, `card-holders`):**
   - **Data da fatura (`calculateInvoiceDate`):** o fechamento é `dueDay - invoiceClosingOffset` dias no mês (limitado ao último dia válido do mês). Compras **no dia ou após o fechamento** vão para a fatura do mês seguinte.
   - **Parcelamento sem perda de centavos (`distributeInstallments`):** converte para centavos e distribui o resto nas primeiras parcelas. Gera `N` registros flat de `CardTransaction` ligados por `installmentGroupId`, avançando a data simulada mês a mês.
   - **Fixos no cartão:** usam `isFixed: true` e `ignoredInvoices` (meses `"YYYY-MM"` suprimidos).
   - **Agrupamento na UI (`groupInvoice`, `groupInvoiceByHolder`):** separa em **Fixos** (primeiro), **Parcelados** e **À vista** (estornos negativos permanecem em À vista). Em `/cartoes`, quando há mais de 1 portador, o modo padrão **"Por portador"** separa Titular e Adicionais em seções colapsáveis dentro do mesmo cartão mantendo **Fixos / Parcelados / À vista** dentro de cada portador, com alternância para **"Por tipo"**. No **Resumo** (`CardsCard.tsx`), o card exibe sempre a soma inteira do cartão sem diferenciar por portador.
   - **Portadores (`CardHolder`):** toda `CardTransaction` referencia um `cardHolderId` (`onDelete: Restrict`). Portadores adicionais podem ser gerenciados tanto em `/cartoes` quanto em `/configuracoes` (`CardManager.tsx` / `CardHoldersModal.tsx`) e já cadastrados na criação do cartão (`CreateCardModal.tsx`).
   - **Importação PDF (`PdfParserService`):** usa `pdfjs-dist` (suporta senha), pula linhas com keywords de crédito/pagamento/estorno (`SKIP_KEYWORDS`), sugere categorias e passa por preview/confirm antes de gravar.

4. **Fluxo de Caixa (`cash-flow/cash-flow.builder.ts`):**
   - Ignora transações com `status === 'CANCELLED'` ou `type === 'TRANSFER'`.
   - Organiza em 4 seções: `INCOME` (Recebimentos), `FIXED` (Contas fixas), `CARDS` (Cartões de crédito) e `VARIABLE` (Outras despesas).
   - Distingue valores planejados (`values`) de valores ainda em aberto (`open`). Para faturas de cartão, não há flag `PAID` dedicada: `isCardInvoiceOpen` considera a fatura quitada após passar o `dueDay` daquele mês.
   - Quando um cartão tem mais de 1 portador, `CashFlowRow.subRows` expõe os subtotais por portador de forma expansível em `CashFlowSheet.tsx`, mantendo `row.values` e `summary.expenses` consolidados em uma única linha.
   - `projectedBalance` carrega o saldo atual (`openingBalance`) mês a mês usando `leadIn` e retorna `null` para meses já fechados.

5. **Investimentos e Fontes Externas (`investments.service.ts`):**
   - **Renda Fixa (`FIXED_INCOME`):** usa série histórica do CDI (BCB série 12, cache 1h, fallback `14.9%` a.a. / 252 dias úteis) e aplica tabela regressiva de IR por dias corridos.
   - **B3 — Ações (`VARIABLE_INCOME`) e Fundos Imobiliários (`FII`):** cotações via `brapi.dev` (requer `BRAPI_TOKEN`; plano gratuito exige 1 ticker por requisição com intervalo sequencial `300ms` e cache de 20 min).
   - **EUA (`US_STOCK`):** cotações em USD via Yahoo Finance (primário) com fallback `brapi.dev` (cache 15 min) + câmbio `USD-BRL` via AwesomeAPI (cache 5 min). Calcula `currentValue` em BRL e separa `assetGainBrl` vs `fxGainBrl`.
   - **Cripto (`CRYPTO`):** cotações em BRL via CoinGecko (cache 5 min, mapa `COINGECKO_ID_MAP`).

6. **Milhas e Layout do Dashboard:**
   - **Milhas:** calcula estimativa de pontos por fatura usando `pointsPerDollar` do cartão e controla pipeline `PENDING -> TRANSFERRED -> CREDITED` + calculadora de bônus de transferência (`frontend/src/lib/miles.ts`).
   - **Dashboard Layout:** blocos disponíveis (`forecast`, `bills`, `moneywhere`, `cards`, `spending`, `cashflow-chart`, `investments-chart`). Layout usa `flex-wrap` responsivo (`md:` >= 768px) com **largura livre em porcentagem (`20..100%`, passo `1%`, sendo `33`/`67` formatados como `33.33%`/`66.66%` para encaixe exato em terços)** e **altura livre em pixels (`260..760px`, padrão `460px`)**. O redimensionamento ocorre diretamente pelo contorno (borda direita, borda inferior e canto inferior direito) em `DashboardGrid.tsx`, e no modo **Personalizar** os cards são arrastáveis diretamente para reposicionar (sem barras de botões `< >`, `P/M/G` ou `1/3`). `normalizeLayout()` preserva ordem, migra valores legados de 12 colunas (`3..12`) e alturas (`sm/md/lg`), remove duplicatas/inválidos e inclui novos blocos automaticamente. Persiste em `DashboardLayout` (`PUT /dashboard-layout`) com cache local (`mybudget:dashboard-layout:v1`).

---

## 8. Convenções de Código, UI e Testes

- **Lógica pura testável sem framework:**
  - No backend, manter cálculos puros em helpers/builders sem importar Prisma ou NestJS (ex.: `penny-pinching.helper.ts`, `invoice-calculator.helper.ts`, `account-yield.calculator.ts`, `cash-flow.builder.ts`), testados em `__tests__/*.spec.ts`.
  - No frontend, manter regras puras em `frontend/src/lib/*.ts` **sem React, APIs de browser ou path aliases `@/`**, importando com extensão `.ts` (`allowImportingTsExtensions: true`), para rodar diretamente com `node --test src/lib/*.test.ts`.
- **UI e Design System (`frontend/src/app/globals.css`, `layout.tsx`):**
  - Estética inspirada no Investidor10: header escuro (`--header: #1c1f24`), fundo neutro (`--background: #f1f2f4`), cards brancos (`--card: #ffffff`), bordas sutis (`--border: #e3e5e9`).
  - Usar tokens semânticos de cor (`text-positive`, `bg-positive-soft`, `bg-positive-fill` para gráficos/barras; `text-negative`, `bg-negative-soft`, `bg-negative-fill`; `text-asset-icon`).
  - **Modo Privacidade (olho no header):** valores monetários devem usar o componente `<Money />` ou a classe `.privacy-value`, controlada por `data-privacy="on"` no `<html>` (persistido em `localStorage` `myfinance:privacy`), aplicando `blur(6px)` sem deslocar layout.
  - Formatação pt-BR centralizada em `frontend/src/lib/format.ts` (`formatCurrency`, `formatUsd`, `formatRate`, `formatPercent`, `formatDate`, `MONTH_NAMES`).
- **Atenção ao rodar testes no Backend:**
  - `cd frontend && node --test src/lib/*.test.ts` passa integralmente (84/84 testes verificados).
  - `cd backend && npm test` executa todos os `*.spec.ts`, incluindo arquivos boilerplate gerados pelo Nest CLI (`*.controller.spec.ts`, `*.service.spec.ts` sem providers mockados) que atualmente falham por injeção de dependência não configurada; para validar módulos específicos ou lógica pura no backend, rode `npx jest <caminho-do-spec>` (e verifique `invoice-calculator.spec.ts` caso altere lógica de faturas).

---

## 9. Checklist Rápido para outra LLM ao Executar Planos

1. **Antes de editar schema:** ler `backend/prisma/schema.prisma`; após alterar, gerar/aplicar migration (`npx prisma migrate dev`) ou garantir sync com `prisma generate` e reiniciar/verificar backend.
2. **Antes de alterar regras de negócio:** checar os helpers puros correspondentes (`backend/src/**/helpers`, `account-yield.calculator.ts`, `cash-flow.builder.ts`, `frontend/src/lib/*.ts`) e seus testes unitários.
3. **Datas:** atenção a fuso horário (UTC vs local) — datas de operação no backend costumam usar local noon ou chaves `yyyy-mm-dd` (`toDateKey`); no frontend, datas ISO vindas da API usam `fromApiDate` quando aplicável.
4. **Endpoints no frontend:** lembrar que `http://localhost:3333` está referenciado diretamente nos arquivos do frontend; manter consistência ou centralizar se o plano pedir.
5. **Validação final:** rodar `node --test src/lib/*.test.ts` e `npm run build` / `npm run lint` no frontend, e `npm run build` + `npx jest` nos specs afetados do backend.
6. **Manutenção deste documento:** após implementar novas funcionalidades ou alterar contratos/regras, atualizar este `PROJECT_CONTEXT.md`.

---

## 10. Histórico de Alterações Recentes (`feat/resumo-layout-e-adicionais`)

- **Resumo — Redimensionamento livre pelo contorno e altura padronizada flexível:**
  - `backend/src/dashboard-layout/dashboard-layout.constants.ts` e `dto/update-dashboard-layout.dto.ts`: largura agora aceita porcentagem (`20..100`, mantendo `3..12` para compatibilidade) e altura opcional em pixels (`260..760`).
  - `frontend/src/lib/dashboard-layout.ts` e `dashboard-layout.test.ts`: `width` em `%` (`20..100`, terceiros `33.33%`/`66.66%`), `height` em `px` (`260..760`, padrão `460`), `setBlockSize()` e migração automática de formatos legados (`3..12` cols e `'sm' | 'md' | 'lg'`).
  - `frontend/src/components/dashboard/DashboardGrid.tsx` e `useDashboardLayout.ts`: removido o cabeçalho de botões (`< >`, `1/3..100%`, `P/M/G`); adicionadas alças no contorno direito (`ew-resize`), inferior (`ns-resize`) e canto (`nwse-resize`) com atualização ao vivo; grid convertido para `flex-wrap` (`md:w-[var(--card-w)]` e `md:h-[var(--card-h)]`) permitindo 3+ cards lado a lado a partir de `768px`.
  - Widgets (`DashCard.tsx`, `Panel.tsx`, `ForecastCard.tsx`, `BillsCard.tsx`, `MoneyWhereCard.tsx`, `CardsCard.tsx`, `SpendingCard.tsx`, `DonutChart.tsx`, `IncomeVsExpensesChart.tsx`, `app/page.tsx`): padronizados para preencher `h-full` com áreas internas roláveis (`overflow-y-auto`); `CardsCard` mantém o total consolidado do cartão no Resumo sem diferenciar por portador e preserva a proporção fixa do cartão visual (`aspect-[1.65] max-w-[300px]`) sem esticar ao expandir o widget.
- **Cartões Adicionais dentro do mesmo cartão:**
  - `frontend/src/lib/credit-cards.ts` e `credit-cards.test.ts`: adicionado `groupInvoiceByHolder()` para separar os lançamentos por portador dentro do mesmo cartão.
  - `frontend/src/app/cartoes/page.tsx`: extraído `InvoiceTypeGroups`; adicionada visualização **Por portador** (padrão quando há >1 portador) com seções colapsáveis de Titular e Adicionais contendo internamente **Fixos / Parcelados / À vista**, toggle para **Por tipo** e quebra por portador no `StatCard` da fatura.
  - `frontend/src/components/CardManager.tsx` e `CreateCardModal.tsx`: exibição dos portadores e acesso ao `CardHoldersModal` em Configurações, além de cadastro do `last4` do titular e cartões adicionais na criação do cartão.
  - `backend/src/cash-flow/cash-flow.builder.ts`, `cash-flow.service.ts`, `cash-flow.builder.spec.ts`, `frontend/src/lib/cash-flow.ts` e `CashFlowSheet.tsx`: suporte a `subRows` expansíveis por portador na linha do cartão no Fluxo de Caixa mantendo o total consolidado.
- **Edição de Gastos Fixos / Estimativas (`transactions`, `fluxo-de-caixa`):**
  - `backend/src/transactions/dto/update-transaction.dto.ts`, `update-transaction-status.dto.ts`, `transactions.controller.ts`, `transactions.service.ts` e `transactions.service.spec.ts`: adicionado `PATCH /transactions/:id` (com `scope: 'single' | 'series'`), ajuste opcional de `amount` na liquidação (`PATCH /transactions/:id/status`) e deduplicação de projeções por série `(type, description)` respeitando overrides mensais sem duplicar ou encerrar a série futura.
  - `frontend/src/components/TransactionModal.tsx`, `MonthTransactions.tsx`, `SettleTransactionDialog.tsx` e `app/fluxo-de-caixa/page.tsx`: adicionado modo de edição completo (com escolha entre alterar só o mês ou daqui para frente) e ajuste do valor real diretamente no diálogo de confirmação de pagamento/recebimento.
- **Investimentos — Consolidação de ativos duplicados, histórico de aportes, separação de Ações/FIIs, Gestão de Proventos e Criptomoedas padrão Binance (`investimentos`, `investimentos/proventos`):**
  - `backend/prisma/schema.prisma`, `backend/src/investments/investments.controller.ts` e `investments.service.ts`: adicionado `FII` ao enum `InvestmentType`, model `InvestmentDividend` e sincronização automática de proventos históricos e futuros programados via Yahoo Finance (`events=div`) e `brapi.dev` desde a `investmentDate` do aporte (`GET /investments/dividends`, `POST /investments/dividends/sync`). Cotações de criptomoedas consultam primariamente a API Spot da Binance (`1MBABYDOGEUSDT`, `1000SATSUSDT`, etc.) com fallback no CoinGecko, suportando custo em `US$` (Padrão Binance) ou `R$` e até 10 casas decimais.
  - `frontend/src/lib/investments.ts`, `investments.test.ts`, `investments-dividends.ts` e `investments-dividends.test.ts`: consolidação de lotes por ativo (`consolidateInvestments`), separação de proventos pagos (`PAID`) vs. a receber (`PENDING`), matriz histórica anual × 12 meses (`buildAnnualMonthlyMatrix`) e funções `grossValueOf` / `taxAmountOf` / `currentValueOf`.
  - `frontend/src/components/AppHeader.tsx`, `InvestmentsSubnav.tsx`, `frontend/src/app/investimentos/page.tsx` e `frontend/src/app/investimentos/proventos/page.tsx`: submenu em **Investimentos** (`Carteira` e `Proventos`), Patrimônio Total exibindo **Valor bruto** e **Valor líquido** lado a lado, seção de **Proventos a receber** e matriz de **Histórico mensal** com filtros (`Recebidos / A receber / Todos`, `Tipo de ativo`, `Ativos`).
- **Contas em Dólar (`USD`), Patrimônio Bruto vs. Líquido e Saldo Projetado Consolidado:**
  - `backend/src/accounts/accounts.service.ts`, `frontend/src/lib/accounts.ts`, `AccountManager.tsx` e `MoneyWhereCard.tsx`: suporte a contas em `USD` (`currency: "USD"`, `balanceUsd`, `investedBrl`, `purchaseExchangeRate`) com flutuação automática pelo `USD-BRL` atual; `MoneyWhereCard.tsx` exibe o valor bruto no topo, tooltip com detalhamento Bruto / Impostos / Líquido no canto superior direito e rodapé com subtração de impostos e valor líquido.
  - `backend/src/cash-flow/cash-flow.service.ts` e `cash-flow.builder.ts`: `openingBalance` (`SALDO` inicial do mês atual na linha **Saldo projetado**) soma o valor bruto de todas as contas + cofrinhos + investimentos e subtrai as despesas pendentes em aberto do mês atual (`openNet`).
- **Projeção de Rendimentos e Dividendos — 12 Meses (`feat/projecao-rendimentos-e-dividendos`):**
  - `backend/src/investments/projections/investments-projection.calculator.ts`, `investments.service.ts` e `investments.controller.ts`: endpoint `GET /investments/projections` projetando 12 meses de dividendos programados a receber (`PENDING`), média mensal de dividendos de FIIs (sem duplicar ativos já anunciados no mês) e retorno líquido mensal de Renda Fixa (descontado o IR regressivo por idade do lote e calculando o mês atual apenas pelos **dias úteis restantes** do mês via `countBusinessDays`, diminuindo diariamente à medida que os dias úteis passam).
  - `backend/src/cash-flow/cash-flow.builder.ts`, `cash-flow.service.ts` e `frontend/src/components/cash-flow/CashFlowSheet.tsx`: linha expansível **Rendimentos e Dividendos** na seção **Recebimentos** da Visão Geral do Fluxo de Caixa com as 3 sub-linhas projetadas somando aos recebimentos e saldo projetado.
  - `frontend/src/components/dashboard/YieldsProjectionCard.tsx`, `frontend/src/lib/dashboard-layout.ts` e `frontend/src/app/page.tsx`: novo card **Projeção de rendimentos — próximos 12 meses** no Resumo (`id: "yields-projection"`), exibindo também os dias úteis corridos vs. restantes do mês atual.
- **Transações Parceladas em Conta (`feat/transacao-parcelada`):**
  - `backend/prisma/schema.prisma`, `backend/src/transactions/dto/create-transaction.dto.ts`, `transactions/helpers/installment-transactions.helper.ts` e `transactions.service.ts`: `Transaction` recebeu `installments` (`1..480`) e `installmentGroupId`. Lançamentos não fixos (ex.: IPTU, IPVA, financiamento de carro em 48x) podem ser criados em múltiplas parcelas com distribuição exata de centavos (`distributeInstallments`), avanço mensal com clamp de fim de mês (`addMonthsClamped`), status automático por parcela (`PAID` até hoje, `PENDING` futuras) e exclusão opcional de apenas a parcela ou desta e das próximas (`scope: 'series'`).
  - `backend/src/cash-flow/cash-flow.builder.ts` e `cash-flow.service.ts`: parcelas com o mesmo `installmentGroupId` são consolidadas em uma única linha na visão geral de 12 meses removendo o sufixo `(k/N)`.
  - `frontend/src/components/TransactionModal.tsx` e `DeleteTransactionDialog.tsx`: campo numérico aberto de `Qtd. Parcelas` (`1..480`, mutuamente exclusivo com `Conta fixa`), preview do valor por parcela e opções de exclusão por parcela ou série.
- **Backup e Carga Inicial de Registros (`backend/src/seed/export-backup.ts`, `import-backup.ts`):**
  - Scripts `npm run db:export` e `npm run db:restore` no `backend` para salvar todas as tabelas do PostgreSQL (incluindo usuários, workspaces e RBAC na versão 2) em `backend/prisma/backup-data.json` e restaurar a carga completa em uma transação Prisma preservando IDs, relacionamentos e datas.
- **Autenticação, Multi-tenancy (Workspaces/Famílias), RBAC Granular e Super Admin (`feat/auth-multitenancy-rbac`):**
  - `backend/prisma/schema.prisma`: adicionados `Plan`, `User`, `Workspace`, `Role`, `Permission`, `RolePermission`, `WorkspaceUser`, `WorkspaceInvite`, enums `WorkspaceMemberStatus` e `InviteStatus`, além de `workspaceId` indexado em todos os modelos de domínio financeiro (`Account`, `Category`, `Transaction`, `CreditCard`, `CardTransaction`, `RecurringExpense`, `Investment`, `MilesEntry`, `BalanceAdjustment`, `AccountTransfer`, `DashboardLayout`).
  - `backend/src/auth/*`, `workspaces/*` e `admin-rbac/*`: autenticação JWT (`@nestjs/jwt` com `JWT_SECRET` forte via `registerAsync`) + hash `scrypt` + login social via Google (`POST /auth/google` com `google-auth-library` e `User.googleId`), guards globais `JwtAuthGuard` e `WorkspaceRbacGuard` (`APP_GUARD`), decorators `@Public()`, `@RequireSuperAdmin()`, `@RequirePermissions()`, `@RequireAnyPermissions()`, `@CurrentUser()` e `@CurrentWorkspace()`. Bootstrap automático no startup sincroniza o Super Admin via `.env` (`BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD`), catálogo de 27 permissões (`module:action`), roles padrão (`OWNER`, `EDITOR`, `VIEWER`) e planos padrão (`ESSENCIAL`, `PRO` sem `milhas`, `COMPLETO`), migrando dados legados sem `workspaceId` para `"Meu Workspace"`. As permissões efetivas do usuário resultam da interseção `Role ∩ Plan.allowedModules` (bloqueando módulos fora do plano mesmo para `OWNER`). CORS em `main.ts` restringido via `FRONTEND_URL`.
  - Todos os controllers e services financeiros (`accounts`, `transactions`, `credit-cards`, `card-holders`, `card-transactions`, `categories`, `investments`, `miles`, `reports`, `cash-flow`, `recurring-expenses`, `dashboard-layout`) foram isolados estritamente pelo `workspaceId` validado do `WorkspaceRbacGuard` (`x-workspace-id` ou `defaultWorkspaceId`), prevenindo acesso cruzado entre workspaces (IDOR).
  - `frontend/src/lib/auth.ts`, `AuthProvider.tsx`, `AppHeader.tsx`, `WorkspaceManager.tsx`, `app/login/page.tsx`, `app/register/page.tsx`, `app/admin/page.tsx`, `app/configuracoes/page.tsx` e `app/page.tsx`: login/registro, injeção automática de `Authorization` e `x-workspace-id` em chamadas à API, seletor de workspace ativo no header, gerenciamento de membros/convites em `/configuracoes` (aba **Integrações** restrita a `isSuperAdmin`), painel global RBAC em `/admin` para Super Admin e proteção de rotas/ações (ex.: perfil `VIEWER` visualiza apenas o Resumo em modo somente leitura).
  - `backend/src/workspaces/default-workspace-seed.ts`: carga padrão inicial (`seedDefaultWorkspaceData`) executada automaticamente ao criar novo workspace, registrar novo usuário ou subir banco vazio (1 conta `Conta Principal`, 1 cartão `Cartão Principal` com portador `Titular` e 10 categorias principais).



