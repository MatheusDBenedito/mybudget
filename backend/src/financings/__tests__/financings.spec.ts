import {
  compareAmortizeVsInvest,
  computeFgtsEligibility,
  simulateAmortization,
} from '../financing-calculator';
import {
  parseFgtsStatementText,
  parseFinancingStatementText,
} from '../financing-statement.parser';

describe('financing-calculator', () => {
  it('simulates SAC & PRICE schedules and reduces term vs installment properly', () => {
    const sim = simulateAmortization({
      currentBalance: 227035.68,
      remainingMonths: 295,
      annualInterestRatePct: 10.49,
      system: 'SAC',
      extraAmount: 20000,
      monthlyExtra: 500,
      monthlyInsurance: 95,
    });

    expect(sim.baseline.months).toBe(295);
    expect(sim.reduceTerm.months).toBeLessThan(sim.baseline.months);
    expect(sim.reduceTerm.interestSaved).toBeGreaterThan(0);
    expect(sim.reduceTerm.monthsSaved).toBeGreaterThan(0);

    // Reducing installment keeps the full remaining term when no monthlyExtra is used,
    // and its first installment is lower than baseline
    const lumpOnly = simulateAmortization({
      currentBalance: 227035.68,
      remainingMonths: 295,
      annualInterestRatePct: 10.49,
      system: 'SAC',
      extraAmount: 20000,
      monthlyExtra: 0,
      monthlyInsurance: 95,
    });
    expect(lumpOnly.reduceInstallment.firstInstallment).toBeLessThan(
      lumpOnly.baseline.firstInstallment
    );
    expect(lumpOnly.reduceTerm.interestSaved).toBeGreaterThan(
      lumpOnly.reduceInstallment.interestSaved
    );
  });

  it('snaps SAC REDUCE_TERM lump-sum extra amortization to integer monthly principal quotas', () => {
    const sim = simulateAmortization({
      currentBalance: 227035.68,
      remainingMonths: 295,
      annualInterestRatePct: 10.49,
      system: 'SAC',
      extraAmount: 15000,
      monthlyExtra: 0,
      monthlyAdminFee: 25,
      monthlyInsurance: 58.35,
    });

    // Monthly principal quota = 227035.68 / 295 ≈ 769.6125; floor(15000 / 769.6125) = 19 months
    expect(sim.reduceTerm.monthsSaved).toBe(19);
    expect(sim.reduceTerm.months).toBe(276);
    expect(sim.reduceTerm.effectiveExtraAmount).toBeCloseTo(14622.64, 1);
    expect(sim.reduceTerm.unusedExtraAmount).toBeCloseTo(377.36, 1);
    expect(sim.reduceTerm.firstInstallment).toBeLessThan(sim.baseline.firstInstallment);
  });

  it('compares amortizing vs investing in CDB and LCI accurately', () => {
    // High interest financing (15% a.a.) vs lower CDI (10% a.a.) -> AMORTIZE wins
    const amortizeWins = compareAmortizeVsInvest({
      amount: 30000,
      currentBalance: 227035.68,
      remainingMonths: 240,
      system: 'SAC',
      financingAnnualRatePct: 15,
      cdiAnnualRatePct: 10,
      cdiPercentage: 100,
      investmentType: 'CDB',
      horizonMonths: 36,
    });
    expect(amortizeWins.recommendation).toBe('AMORTIZE');
    expect(amortizeWins.netDifference).toBeGreaterThan(0);
    expect(amortizeWins.netInvestmentAnnualRatePct).toBeGreaterThan(8.3);
    expect(amortizeWins.netInvestmentAnnualRatePct).toBeLessThan(8.6);

    // Low financing rate (6% a.a.) vs high LCI (100% CDI @ 14.65%, tax-exempt) -> INVEST wins
    const investWins = compareAmortizeVsInvest({
      amount: 30000,
      currentBalance: 227035.68,
      remainingMonths: 240,
      system: 'SAC',
      financingAnnualRatePct: 6,
      cdiAnnualRatePct: 14.65,
      cdiPercentage: 100,
      investmentType: 'LCI_LCA',
      horizonMonths: 36,
    });
    expect(investWins.recommendation).toBe('INVEST');
    expect(investWins.netDifference).toBeLessThan(0);
    expect(investWins.breakEvenCdiPct).toBeLessThan(100);
  });

  it('computes FGTS 2-year eligibility correctly', () => {
    const now = new Date('2026-11-14T12:00:00Z');
    // Used 2025-10-28 -> eligible 2027-10-28 (not yet eligible)
    const blocked = computeFgtsEligibility('2025-10-28', now);
    expect(blocked.canUse).toBe(false);
    expect(blocked.nextEligibleDate).toBe('2027-10-28');
    expect(blocked.remainingDays).toBeGreaterThan(300);

    // Used 2023-08-21 -> eligible 2025-08-21 (eligible now)
    const eligible = computeFgtsEligibility('2023-08-21', now);
    expect(eligible.canUse).toBe(true);
    expect(eligible.remainingDays).toBe(0);

    // Never used -> eligible now
    const neverUsed = computeFgtsEligibility(null, now);
    expect(neverUsed.canUse).toBe(true);
    expect(neverUsed.lastUsageDate).toBeNull();
  });
});

describe('financing-statement.parser', () => {
  it('parses Bradesco Extrato Financeiro PDF text with ENCARGOS and FGTS extra amortization', () => {
    const bradescoSample = `
EXTRATO FINANCEIRO BRADESCO
CONTRATO 9147646
Data do contrato 21/08/2023
Data da liberação 02/10/2023
Valor Financiamento 262.250,00
Valor Imóvel 450.000,00
Prazo 38/333
Indexador TR
Sistema Amortização SAC
Nominal(a.a) 10,02%
CET(a.a) 11,12%
Efetiva(a.a) 10,49%
SALDO DEVEDOR 227.035,68

ENCARGOS
0 02/10/2023 190,69 0,00 0,00 - - - 190,69 - - - - 262.250,00 Paga 02/10/2023 190,69
1 02/11/2023 2.987,45 787,54 2.104,91 - 65,00 30,00 0,00 - - - - 261.462,46 Paga 02/11/2023 2.987,45
39 02/12/2026 2.750,12 812,30 1.842,82 - 65,00 30,00 0,00 - - - - 226.223,38 A Vencer - -

AMORTIZAÇÃO REDUÇÃO VALOR PRESTAÇÃO/PRAZO COM FGTS
1 28/10/2025 0,00 20.348,98 27
`;

    const parsed = parseFinancingStatementText(bradescoSample, 'extrato-bradesco.pdf');
    expect(parsed.detectedFormat).toBe('BRADESCO_PDF');
    expect(parsed.contract.bankName).toBe('Bradesco');
    expect(parsed.contract.contractNumber).toBe('9147646');
    expect(parsed.contract.contractDate).toBe('2023-08-21');
    expect(parsed.contract.financedAmount).toBe(262250);
    expect(parsed.contract.propertyValue).toBe(450000);
    expect(parsed.contract.paidMonths).toBe(38);
    expect(parsed.contract.totalMonths).toBe(333);
    expect(parsed.contract.amortizationSystem).toBe('SAC');
    expect(parsed.contract.indexer).toBe('TR');
    expect(parsed.contract.effectiveAnnualRate).toBe(10.49);
    expect(parsed.contract.currentBalance).toBe(227035.68);

    expect(parsed.installments).toHaveLength(3);
    expect(parsed.installments[0].status).toBe('PAID');
    expect(parsed.installments[0].adminFee).toBe(190.69);
    expect(parsed.installments[1].principalAmount).toBe(787.54);
    expect(parsed.installments[1].interestAmount).toBe(2104.91);
    expect(parsed.installments[2].status).toBe('PENDING');

    expect(parsed.extraAmortizations).toHaveLength(1);
    expect(parsed.extraAmortizations[0]).toMatchObject({
      date: '2025-10-28',
      fgtsAmount: 20348.98,
      monthsReduced: 27,
      source: 'FGTS',
      strategy: 'REDUCE_TERM',
    });
  });

  it('parses Bradesco Extrato Financeiro multi-line stream format (from pdf-parse)', () => {
    const streamSample = `
CONTRATO
9147646
Data do contrato
21/08/2023
Extrato Financeiro
Ativo
DADOS FINANCEIROS
262.250,00
Valor Financiamento
TAXAS
Efetiva(a.a)
10,49%
CET(a.a)
11,12%
SALDO DEVEDOR
02/10/2023
14/11/2026
227.035,68
Nominal(a.a)
10,02%
Valor Imóvel
450.000,00
Sistema AmortizaçãoSAC
38/333
Prazo
TRIndexador

AMORTIZAÇÃO REDUÇÃO VALOR PRESTAÇÃO/PRAZO COM FGTS
#1
Data Evento
28/10/2025
Valor Amortização
Especie
0,00
Valor Amortização
Fgts
20.348,98
Qtd Prest.
Amortizadas
27

ENCARGOSParcela
Data
Amortização
Valor Total
Parcela
Valor
Principal
Ind.
Correção
Parcela
Valor
MIP*
Valor
DFI**
Valor
TSA***
Valor
Multa
Valor
Mora
FGTS
Mensal
Ind. Correção
Saldo Dev.
Saldo
Devedor
Situação
Parcela
Data
Pagamento
Valor
Pagamento
0
21/08/2023
58,95
0,00
1,000000
34,20
24,75
0,00
0,00
0,00
0,00
1,000000
262.250,00
Paga
28/08/2023
58,95
Valor
Juros
0,00
1
21/09/2023
3.006,76
729,77
1,001778
34,16
24,79
25,00
0,00
0,00
0,00
1,001778
261.986,51
Paga
21/09/2023
3.006,76
Valor
Juros
2.193,04
2
21/10/2023
3.003,99
730,60
1,001150
34,11
24,82
25,00
0,00
0,00
0,00
1,001150
261.557,19
A Vencer
-
-
Valor
Juros
2.189,46
`;

    const parsed = parseFinancingStatementText(streamSample, 'extrato.pdf');
    expect(parsed.detectedFormat).toBe('BRADESCO_PDF');
    expect(parsed.contract.contractNumber).toBe('9147646');
    expect(parsed.contract.contractDate).toBe('2023-08-21');
    expect(parsed.contract.financedAmount).toBe(262250);
    expect(parsed.contract.propertyValue).toBe(450000);
    expect(parsed.contract.currentBalance).toBe(227035.68);
    expect(parsed.contract.paidMonths).toBe(38);
    expect(parsed.contract.totalMonths).toBe(333);
    expect(parsed.contract.amortizationSystem).toBe('SAC');
    expect(parsed.contract.indexer).toBe('TR');

    expect(parsed.extraAmortizations).toHaveLength(1);
    expect(parsed.extraAmortizations[0].fgtsAmount).toBe(20348.98);
    expect(parsed.extraAmortizations[0].monthsReduced).toBe(27);

    expect(parsed.installments).toHaveLength(3);
    expect(parsed.installments[0].code).toBe('0');
    expect(parsed.installments[0].status).toBe('PAID');
    expect(parsed.installments[1].code).toBe('1');
    expect(parsed.installments[1].interestAmount).toBe(2193.04);
    expect(parsed.installments[2].status).toBe('PENDING');
  });

  it('parses generic CSV financing schedules', () => {
    const csv = [
      'Parcela;Vencimento;Amortizacao;Juros;Seguro;Total;Saldo Devedor;Status',
      '1;10/01/2025;1.000,00;1.500,00;80,00;2.580,00;199.000,00;Paga',
      '2;10/02/2025;1.000,00;1.490,00;80,00;2.570,00;198.000,00;A Vencer',
    ].join('\n');

    const parsed = parseFinancingStatementText(csv, 'caixa.csv');
    expect(parsed.detectedFormat).toBe('GENERIC_CSV');
    expect(parsed.installments).toHaveLength(2);
    expect(parsed.installments[0].status).toBe('PAID');
    expect(parsed.installments[0].principalAmount).toBe(1000);
    expect(parsed.installments[1].status).toBe('PENDING');
  });

  it('parses Caixa FGTS statement balance and last housing usage date', () => {
    const fgtsText = `
CAIXA ECONÔMICA FEDERAL - EXTRATO DO FGTS
28/10/2025 SAQUE COD 91 - AMORTIZACAO MORADIA PROPRIA -20.348,98
10/11/2026 DEPOSITO EMPREGADOR 1.250,00
SALDO ATUAL: R$ 18.420,55
`;
    const fgts = parseFgtsStatementText(fgtsText);
    expect(fgts.currentBalance).toBe(18420.55);
    expect(fgts.lastUsageDate).toBe('2025-10-28');
    expect(fgts.lastUsageAmount).toBe(20348.98);
  });
});
