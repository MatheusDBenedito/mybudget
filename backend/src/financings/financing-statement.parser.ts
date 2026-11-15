export type ParsedAmortizationSystem = 'SAC' | 'PRICE';
export type ParsedIndexer = 'TR' | 'IPCA' | 'POUPANCA' | 'FIXO';
export type ParsedInstallmentStatus = 'PAID' | 'PENDING' | 'PARTIAL' | 'OVERDUE';
export type ParsedExtraStrategy = 'REDUCE_TERM' | 'REDUCE_INSTALLMENT';
export type ParsedExtraSource = 'OWN_RESOURCES' | 'FGTS';

export interface ParsedFinancingContract {
  bankName?: string;
  contractNumber?: string;
  contractDate?: string; // YYYY-MM-DD
  releaseDate?: string; // YYYY-MM-DD
  propertyValue?: number;
  financedAmount?: number;
  currentBalance?: number;
  totalMonths?: number;
  paidMonths?: number;
  amortizationSystem?: ParsedAmortizationSystem;
  indexer?: ParsedIndexer;
  nominalAnnualRate?: number;
  effectiveAnnualRate?: number;
  cetAnnualRate?: number;
}

export interface ParsedInstallment {
  installmentNumber: number | null;
  code: string;
  dueDate: string; // YYYY-MM-DD
  totalAmount: number;
  principalAmount: number;
  interestAmount: number;
  indexerCorrection: number;
  mipInsurance: number;
  dfiInsurance: number;
  adminFee: number;
  penaltyAmount: number;
  lateInterest: number;
  fgtsMonthlyUsed: number;
  balanceCorrection: number;
  endingBalance: number;
  status: ParsedInstallmentStatus;
  paidDate: string | null;
  paidAmount: number | null;
}

export interface ParsedExtraAmortization {
  date: string; // YYYY-MM-DD
  ownAmount: number;
  fgtsAmount: number;
  totalAmount: number;
  monthsReduced: number | null;
  strategy: ParsedExtraStrategy;
  source: ParsedExtraSource;
}

export interface ParsedFinancingStatement {
  detectedFormat: 'BRADESCO_PDF' | 'CAIXA_PDF' | 'ITAU_PDF' | 'SANTANDER_PDF' | 'BB_PDF' | 'GENERIC_CSV' | 'GENERIC_TEXT';
  contract: ParsedFinancingContract;
  installments: ParsedInstallment[];
  extraAmortizations: ParsedExtraAmortization[];
  warnings: string[];
}

export interface ParsedFgtsStatement {
  currentBalance: number | null;
  lastUsageDate: string | null;
  lastUsageAmount: number | null;
  lastUsageDescription: string | null;
  warnings: string[];
}

/** Parses Brazilian or US formatted numbers into JS number. Returns null if invalid/dash. */
export function parseLocaleNumber(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '-' || trimmed === '—' || trimmed === 'N/A') return null;
  const cleaned = trimmed.replace(/[R$\s%]/g, '');
  if (!/^-?[\d.,]+$/.test(cleaned)) return null;

  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  let normalized = cleaned;
  if (hasComma && hasDot) {
    // Whichever appears last is the decimal separator
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = cleaned.replace(/,/g, '');
    }
  } else if (hasComma) {
    normalized = cleaned.replace(',', '.');
  } else if (hasDot) {
    // Check if dot is thousands separator (e.g. 1.234 or 227.035)
    const parts = cleaned.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3)) {
      normalized = cleaned.replace(/\./g, '');
    }
  }

  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

/** Parses DD/MM/YYYY or YYYY-MM-DD into YYYY-MM-DD. */
export function parseBrDate(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  const brMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    const [, dd, mm, yyyy] = brMatch;
    return `${yyyy}-${mm}-${dd}`;
  }
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return s;
  return null;
}

function detectBankName(text: string, fileName?: string): string | undefined {
  const combined = `${fileName ?? ''}\n${text.slice(0, 2500)}`.toUpperCase();
  if (combined.includes('BRADESCO')) return 'Bradesco';
  if (combined.includes('CAIXA') || combined.includes('CEF')) return 'Caixa Econômica Federal';
  if (combined.includes('ITAÚ') || combined.includes('ITAU')) return 'Itaú';
  if (combined.includes('SANTANDER')) return 'Santander';
  if (combined.includes('BANCO DO BRASIL') || /\bBB\b/.test(combined)) return 'Banco do Brasil';
  return undefined;
}

function mapIndexer(raw: string | undefined): ParsedIndexer | undefined {
  if (!raw) return undefined;
  const up = raw.toUpperCase();
  if (up.includes('IPCA')) return 'IPCA';
  if (up.includes('POUP')) return 'POUPANCA';
  if (up.includes('FIX')) return 'FIXO';
  if (up.includes('TR')) return 'TR';
  return undefined;
}

function mapSystem(raw: string | undefined): ParsedAmortizationSystem | undefined {
  if (!raw) return undefined;
  const up = raw.toUpperCase();
  if (up.includes('PRICE') || up.includes('FRANC')) return 'PRICE';
  if (up.includes('SAC')) return 'SAC';
  return undefined;
}

function isCsvText(text: string, fileName?: string): boolean {
  if (fileName && fileName.toLowerCase().endsWith('.csv')) return true;
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0).slice(0, 5);
  if (lines.length < 2) return false;
  const sepCount = (lines[0].match(/[;,]/g) ?? []).length;
  return sepCount >= 3 && !text.toUpperCase().includes('EXTRATO FINANCEIRO');
}

function parseBradescoPdfText(text: string): ParsedFinancingStatement {
  const warnings: string[] = [];
  const contract: ParsedFinancingContract = {
    bankName: 'Bradesco',
  };

  const contractMatch =
    text.match(/CONTRATO\s+([0-9]{4,})/i) ||
    text.match(/CONTRATO\s+([A-Z0-9-]+)/i);
  if (contractMatch && !/parcela/i.test(contractMatch[1])) {
    contract.contractNumber = contractMatch[1].trim();
  }

  const contractDateMatch = text.match(
    /Data\s+do\s+contrato\s+(\d{2}\/\d{2}\/\d{4})/i
  );
  if (contractDateMatch)
    contract.contractDate = parseBrDate(contractDateMatch[1]) ?? undefined;

  const releaseDateMatch = text.match(
    /Data\s+da\s+libera[çc][ãa]o\s+(\d{2}\/\d{2}\/\d{4})/i
  );
  if (releaseDateMatch)
    contract.releaseDate = parseBrDate(releaseDateMatch[1]) ?? undefined;

  const financedMatch =
    text.match(/Valor\s+Financiamento\s*([\d.,]+)/i) ||
    text.match(/([\d.,]+)\s*Valor\s+Financiamento/i);
  if (financedMatch)
    contract.financedAmount =
      parseLocaleNumber(financedMatch[1]) ?? undefined;

  const propertyMatch =
    text.match(/Valor\s+Im[óo]vel\s*([\d.,]+)/i) ||
    text.match(/([\d.,]+)\s*Valor\s+Im[óo]vel/i);
  if (propertyMatch)
    contract.propertyValue =
      parseLocaleNumber(propertyMatch[1]) ?? undefined;

  const termMatch =
    text.match(/Prazo\s*(\d+)\s*\/\s*(\d+)/i) ||
    text.match(/(\d+)\s*\/\s*(\d+)\s*Prazo/i);
  if (termMatch) {
    contract.paidMonths = Number(termMatch[1]);
    contract.totalMonths = Number(termMatch[2]);
  }

  const indexerMatch = text.match(
    /(?:Indexador\s*(?:de\s+)?|\b)(TR|IPCA|POUPAN[ÇC]A|FIXO)(?:\s*Indexador|\b)/i
  );
  if (indexerMatch)
    contract.indexer = mapIndexer(indexerMatch[1]);

  const systemMatch = text.match(/Sistema\s*Amortiza[çc][ãa]o\s*([A-Z]+)/i);
  if (systemMatch) contract.amortizationSystem = mapSystem(systemMatch[1]);

  const nominalMatch = text.match(/Nominal\s*\(a\.a\)\s*([\d.,]+)\s*%/i);
  if (nominalMatch)
    contract.nominalAnnualRate = parseLocaleNumber(nominalMatch[1]) ?? undefined;

  const combinedRatesMatch = text.match(
    /Efetiva\s*\(a\.a\)\s*CET\s*\(a\.a\)\s*([\d.,]+)%\s*([\d.,]+)%/i
  );
  if (combinedRatesMatch) {
    contract.effectiveAnnualRate =
      parseLocaleNumber(combinedRatesMatch[1]) ?? undefined;
    contract.cetAnnualRate =
      parseLocaleNumber(combinedRatesMatch[2]) ?? undefined;
  } else {
    const cetMatch = text.match(/CET\s*\(a\.a\)\s*([\d.,]+)\s*%/i);
    if (cetMatch)
      contract.cetAnnualRate = parseLocaleNumber(cetMatch[1]) ?? undefined;

    const effectiveMatch = text.match(/Efetiva\s*\(a\.a\)\s*([\d.,]+)\s*%/i);
    if (effectiveMatch)
      contract.effectiveAnnualRate =
        parseLocaleNumber(effectiveMatch[1]) ?? undefined;
  }

  const balanceMatch = text.match(/SALDO\s+DEVEDOR[\s\S]*?([\d.]+,\d{2})/i);
  if (balanceMatch)
    contract.currentBalance = parseLocaleNumber(balanceMatch[1]) ?? undefined;

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const installments: ParsedInstallment[] = [];
  const extraAmortizations: ParsedExtraAmortization[] = [];

  // 1. Extra amortizations: multi-line block match (e.g. from pdf-parse)
  const extraRegex =
    /AMORTIZAÇÃO\s+REDUÇÃO[\s\S]*?Data\s+Evento\s+(\d{2}\/\d{2}\/\d{4})[\s\S]*?Especie\s+([\d.,-]+)[\s\S]*?Fgts\s+([\d.,-]+)[\s\S]*?Amortizadas\s+(\d+|-)/gi;
  let exMatch;
  while ((exMatch = extraRegex.exec(text)) !== null) {
    const d = parseBrDate(exMatch[1]);
    const own = parseLocaleNumber(exMatch[2]) ?? 0;
    const fgts = parseLocaleNumber(exMatch[3]) ?? 0;
    const total = Number((own + fgts).toFixed(2));
    const reduced = exMatch[4] === '-' ? null : Number(exMatch[4]);
    if (d && total > 0) {
      extraAmortizations.push({
        date: d,
        ownAmount: own,
        fgtsAmount: fgts,
        totalAmount: total,
        monthsReduced: Number.isFinite(reduced) ? reduced : null,
        strategy: reduced && reduced > 0 ? 'REDUCE_TERM' : 'REDUCE_INSTALLMENT',
        source: fgts > 0 ? 'FGTS' : 'OWN_RESOURCES',
      });
    }
  }

  // 2. Try vertical stream parsing for installments
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (
      /^(0|T|\d{1,3})$/.test(l) &&
      i + 1 < lines.length &&
      /^\d{2}\/\d{2}\/\d{4}$/.test(lines[i + 1])
    ) {
      const code = l;
      const dueDate = parseBrDate(lines[i + 1]);
      if (!dueDate) {
        i++;
        continue;
      }
      const totalAmount = parseLocaleNumber(lines[i + 2]) ?? 0;
      const principalAmount = parseLocaleNumber(lines[i + 3]) ?? 0;
      const indCorr = parseLocaleNumber(lines[i + 4]) ?? 0;
      const mip = lines[i + 5] === '-' ? 0 : parseLocaleNumber(lines[i + 5]) ?? 0;
      const dfi = lines[i + 6] === '-' ? 0 : parseLocaleNumber(lines[i + 6]) ?? 0;
      const tsa = lines[i + 7] === '-' ? 0 : parseLocaleNumber(lines[i + 7]) ?? 0;
      const multa = parseLocaleNumber(lines[i + 8]) ?? 0;
      const mora = parseLocaleNumber(lines[i + 9]) ?? 0;
      const fgts = parseLocaleNumber(lines[i + 10]) ?? 0;
      const indCorrSaldo = parseLocaleNumber(lines[i + 11]) ?? 0;
      const saldoDev = parseLocaleNumber(lines[i + 12]) ?? 0;
      const statusRaw = lines[i + 13] ?? '';

      let status: ParsedInstallmentStatus = 'PENDING';
      if (/Paga/i.test(statusRaw)) status = 'PAID';
      else if (/Vencida|Atras/i.test(statusRaw)) status = 'OVERDUE';
      else if (/Parcial/i.test(statusRaw)) status = 'PARTIAL';

      const paidDate =
        lines[i + 14] && /^\d{2}\/\d{2}\/\d{4}$/.test(lines[i + 14])
          ? parseBrDate(lines[i + 14])
          : null;
      const paidAmount =
        lines[i + 15] && lines[i + 15] !== '-'
          ? parseLocaleNumber(lines[i + 15])
          : null;

      let interestAmount = 0;
      let step = 16;
      if (
        i + step < lines.length &&
        lines[i + step] === 'Valor' &&
        i + step + 1 < lines.length &&
        lines[i + step + 1] === 'Juros'
      ) {
        interestAmount = parseLocaleNumber(lines[i + step + 2]) ?? 0;
        step += 3;
      } else if (
        i + step < lines.length &&
        /^[\d.,]+$/.test(lines[i + step]) &&
        !/^(0|T|\d{1,3})$/.test(lines[i + step])
      ) {
        interestAmount = parseLocaleNumber(lines[i + step]) ?? 0;
        step += 1;
      }

      if (interestAmount === 0 && totalAmount > 0 && principalAmount > 0) {
        interestAmount = Number(
          Math.max(
            0,
            totalAmount - principalAmount - mip - dfi - tsa
          ).toFixed(2)
        );
      }

      installments.push({
        code,
        installmentNumber: /^\d+$/.test(code) ? Number(code) : null,
        dueDate,
        totalAmount,
        principalAmount,
        interestAmount,
        indexerCorrection: indCorr,
        mipInsurance: mip,
        dfiInsurance: dfi,
        adminFee: tsa,
        penaltyAmount: multa,
        lateInterest: mora,
        fgtsMonthlyUsed: fgts,
        balanceCorrection: indCorrSaldo,
        endingBalance: saldoDev,
        status,
        paidDate: status === 'PAID' ? paidDate ?? dueDate : null,
        paidAmount:
          status === 'PAID' ? paidAmount ?? totalAmount : null,
      });

      i += step;
      continue;
    }
    i++;
  }

  // 3. Fallback: single-line row scanning if stream parsing didn't find rows
  if (installments.length === 0) {
    let section: 'HEADER' | 'ENCARGOS' | 'AMORTIZACAO' = 'HEADER';
    let currentRowBuffer = '';

    const flushInstallmentRow = (rowStr: string) => {
      const parsed = parseBradescoInstallmentRow(rowStr);
      if (parsed) installments.push(parsed);
    };

    for (const line of lines) {
      const upper = line.toUpperCase();
      if (
        upper.includes('AMORTIZAÇÃO') &&
        (upper.includes('REDUÇÃO') ||
          upper.includes('FGTS') ||
          upper.includes('PRESTAÇÃO'))
      ) {
        if (currentRowBuffer) {
          flushInstallmentRow(currentRowBuffer);
          currentRowBuffer = '';
        }
        section = 'AMORTIZACAO';
        continue;
      }
      if (upper.includes('ENCARGOS') && !upper.includes('SEGUROS')) {
        section = 'ENCARGOS';
        continue;
      }

      if (
        /^P[ÁA]GINA\s+\d+/i.test(line) ||
        /^EXTRATO\s+FINANCEIRO/i.test(line) ||
        /^CONTRATO\s+/i.test(line) ||
        /^(N[º°]|DATA\s+VENC|VALOR\s+TOTAL|SITUA[ÇC][ÃA]O)/i.test(line)
      ) {
        continue;
      }

      if (section === 'AMORTIZACAO') {
        const extraMatch = line.match(
          /^(\d{1,3})\s+(\d{2}\/\d{2}\/\d{4})\s+([\d.,-]+)\s+([\d.,-]+)\s+(\d+|-)/
        );
        if (extraMatch) {
          const ownAmount = parseLocaleNumber(extraMatch[3]) ?? 0;
          const fgtsAmount = parseLocaleNumber(extraMatch[4]) ?? 0;
          const totalAmount = Number((ownAmount + fgtsAmount).toFixed(2));
          const monthsReduced =
            extraMatch[5] === '-' ? null : Number(extraMatch[5]);
          const date = parseBrDate(extraMatch[2]);
          if (date && totalAmount > 0) {
            extraAmortizations.push({
              date,
              ownAmount,
              fgtsAmount,
              totalAmount,
              monthsReduced: Number.isFinite(monthsReduced)
                ? monthsReduced
                : null,
              strategy:
                monthsReduced && monthsReduced > 0
                  ? 'REDUCE_TERM'
                  : 'REDUCE_INSTALLMENT',
              source: fgtsAmount > 0 ? 'FGTS' : 'OWN_RESOURCES',
            });
          }
        }
        continue;
      }

      const startsRow = /^(?:0|T|\d{1,3})\s+\d{2}\/\d{2}\/\d{4}\b/.test(line);
      if (startsRow) {
        section = 'ENCARGOS';
        if (currentRowBuffer) flushInstallmentRow(currentRowBuffer);
        currentRowBuffer = line;
      } else if (section === 'ENCARGOS' && currentRowBuffer) {
        if (/^[\d.,\-\/\s]+$|Paga|Vencer|Parcial|Atraso/i.test(line)) {
          currentRowBuffer = `${currentRowBuffer} ${line}`;
        }
      }
    }

    if (currentRowBuffer) {
      flushInstallmentRow(currentRowBuffer);
    }
  }

  if (installments.length === 0) {
    warnings.push(
      'Nenhuma parcela encontrada na tabela de ENCARGOS do extrato Bradesco.'
    );
  }

  return {
    detectedFormat: 'BRADESCO_PDF',
    contract,
    installments,
    extraAmortizations,
    warnings,
  };
}

function parseBradescoInstallmentRow(rowStr: string): ParsedInstallment | null {
  const normalized = rowStr.replace(/\s+/g, ' ').trim();
  const headMatch = normalized.match(/^(0|T|\d{1,3})\s+(\d{2}\/\d{2}\/\d{4})\s+(.+)$/);
  if (!headMatch) return null;

  const code = headMatch[1];
  const dueDate = parseBrDate(headMatch[2]);
  if (!dueDate) return null;

  const rest = headMatch[3];
  const statusMatch = rest.match(/\b(Paga|Pago|A\s+Vencer|Vencida|Em\s+Aberto|Parcial)\b/i);
  let status: ParsedInstallmentStatus = 'PENDING';
  let beforeStatus = rest;
  let afterStatus = '';

  if (statusMatch && statusMatch.index !== undefined) {
    const rawStatus = statusMatch[1].toUpperCase();
    if (rawStatus.startsWith('PAG')) status = 'PAID';
    else if (rawStatus.startsWith('PARC')) status = 'PARTIAL';
    else if (rawStatus.startsWith('VENC')) status = 'OVERDUE';
    else status = 'PENDING';

    beforeStatus = rest.slice(0, statusMatch.index).trim();
    afterStatus = rest.slice(statusMatch.index + statusMatch[0].length).trim();
  }

  const tokens = beforeStatus.split(/\s+/).filter(Boolean);
  // Expected up to 12 numeric/dash columns before Status:
  // 0: total, 1: principal, 2: interest, 3: indCorr, 4: mip, 5: dfi, 6: tsa, 7: multa, 8: mora, 9: fgtsMensal, 10: indCorrSaldo, 11: saldoDevedor
  const nums = tokens.map((t) => (t === '-' ? 0 : parseLocaleNumber(t)));

  const val = (idx: number): number => {
    const v = nums[idx];
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  };

  let paidDate: string | null = null;
  let paidAmount: number | null = null;
  if (afterStatus) {
    const afterTokens = afterStatus.split(/\s+/).filter(Boolean);
    for (const tok of afterTokens) {
      if (!paidDate && /^\d{2}\/\d{2}\/\d{4}$/.test(tok)) {
        paidDate = parseBrDate(tok);
      } else if (paidAmount === null && tok !== '-') {
        const parsed = parseLocaleNumber(tok);
        if (parsed !== null) paidAmount = parsed;
      }
    }
  }

  const installmentNumber = /^\d+$/.test(code) ? Number(code) : null;
  const totalAmount = val(0);
  const principalAmount = val(1);
  const interestAmount = val(2);
  const indexerCorrection = val(3);
  const mipInsurance = val(4);
  const dfiInsurance = val(5);
  const adminFee = val(6);
  const penaltyAmount = val(7);
  const lateInterest = val(8);
  const fgtsMonthlyUsed = val(9);
  const balanceCorrection = val(10);
  // endingBalance is usually last numeric token before status (index 11 or last valid number)
  const endingBalance =
    nums.length >= 12
      ? val(11)
      : (() => {
          for (let i = nums.length - 1; i >= 0; i--) {
            if (nums[i] !== null) return nums[i] as number;
          }
          return 0;
        })();

  return {
    installmentNumber,
    code,
    dueDate,
    totalAmount,
    principalAmount,
    interestAmount,
    indexerCorrection,
    mipInsurance,
    dfiInsurance,
    adminFee,
    penaltyAmount,
    lateInterest,
    fgtsMonthlyUsed,
    balanceCorrection,
    endingBalance,
    status,
    paidDate,
    paidAmount: paidAmount ?? (status === 'PAID' ? totalAmount : null),
  };
}

function parseCsvStatement(text: string, fileName?: string): ParsedFinancingStatement {
  const warnings: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const sep = (lines[0].match(/;/g) ?? []).length >= (lines[0].match(/,/g) ?? []).length ? ';' : ',';

  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  const findCol = (...patterns: string[]) =>
    headers.findIndex((h) => patterns.some((p) => h.includes(p)));

  const colNum = findCol('parcela', 'num', 'nº', 'prestacao');
  const colDate = findCol('vencimento', 'data');
  const colTotal = findCol('total', 'valor_parcela', 'prestacao', 'valor');
  const colPrincipal = findCol('amortizacao', 'principal');
  const colInterest = findCol('juros');
  const colInsurance = findCol('seguro', 'mip', 'taxas');
  const colBalance = findCol('saldo');
  const colStatus = findCol('status', 'situacao');
  const colPaidDate = findCol('pagamento', 'data_pag');
  const colPaidAmount = findCol('valor_pago', 'pago');

  const installments: ParsedInstallment[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map((c) => c.trim());
    const dueDate = colDate >= 0 ? parseBrDate(cols[colDate]) : null;
    if (!dueDate) continue;

    const rawNum = colNum >= 0 ? cols[colNum] : String(i);
    const installmentNumber = /^\d+$/.test(rawNum) ? Number(rawNum) : i;
    const totalAmount = colTotal >= 0 ? (parseLocaleNumber(cols[colTotal]) ?? 0) : 0;
    const principalAmount = colPrincipal >= 0 ? (parseLocaleNumber(cols[colPrincipal]) ?? 0) : 0;
    const interestAmount = colInterest >= 0 ? (parseLocaleNumber(cols[colInterest]) ?? 0) : 0;
    const mipInsurance = colInsurance >= 0 ? (parseLocaleNumber(cols[colInsurance]) ?? 0) : 0;
    const endingBalance = colBalance >= 0 ? (parseLocaleNumber(cols[colBalance]) ?? 0) : 0;

    const rawStatus = colStatus >= 0 ? (cols[colStatus] ?? '').toUpperCase() : '';
    const status: ParsedInstallmentStatus = rawStatus.includes('PAG') || rawStatus.includes('LIQ')
      ? 'PAID'
      : rawStatus.includes('VENCID') || rawStatus.includes('ATRAS')
        ? 'OVERDUE'
        : 'PENDING';

    const paidDate = colPaidDate >= 0 ? parseBrDate(cols[colPaidDate]) : null;
    const paidAmount = colPaidAmount >= 0 ? parseLocaleNumber(cols[colPaidAmount]) : null;

    installments.push({
      installmentNumber,
      code: String(installmentNumber),
      dueDate,
      totalAmount: totalAmount || Number((principalAmount + interestAmount + mipInsurance).toFixed(2)),
      principalAmount,
      interestAmount,
      indexerCorrection: 0,
      mipInsurance,
      dfiInsurance: 0,
      adminFee: 0,
      penaltyAmount: 0,
      lateInterest: 0,
      fgtsMonthlyUsed: 0,
      balanceCorrection: 0,
      endingBalance,
      status,
      paidDate,
      paidAmount: paidAmount ?? (status === 'PAID' ? totalAmount : null),
    });
  }

  if (installments.length === 0) {
    warnings.push('Nenhuma linha válida encontrada no CSV.');
  }

  return {
    detectedFormat: 'GENERIC_CSV',
    contract: { bankName: detectBankName(text, fileName) },
    installments,
    extraAmortizations: [],
    warnings,
  };
}

function parseGenericBankText(text: string, fileName?: string): ParsedFinancingStatement {
  const bankName = detectBankName(text, fileName);
  const detectedFormat: ParsedFinancingStatement['detectedFormat'] =
    bankName === 'Caixa Econômica Federal'
      ? 'CAIXA_PDF'
      : bankName === 'Itaú'
        ? 'ITAU_PDF'
        : bankName === 'Santander'
          ? 'SANTANDER_PDF'
          : bankName === 'Banco do Brasil'
            ? 'BB_PDF'
            : 'GENERIC_TEXT';

  const contract: ParsedFinancingContract = {
    bankName,
    contractNumber: text.match(/CONTRATO[:\s]+([A-Z0-9.-]+)/i)?.[1],
    amortizationSystem: mapSystem(text.match(/\b(SAC|PRICE)\b/i)?.[1]),
    indexer: mapIndexer(text.match(/\b(TR|IPCA|POUPAN[ÇC]A|FIXO)\b/i)?.[1]),
  };

  const installments: ParsedInstallment[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Generic pattern: <installmentNumber> <DD/MM/YYYY> <money...> [Paga|Pago|Liquidada|A Vencer]
    const match = line.match(/^(\d{1,3})\s+(\d{2}\/\d{2}\/\d{4})\s+(.+)$/);
    if (!match) continue;
    const dueDate = parseBrDate(match[2]);
    if (!dueDate) continue;

    const nums = (match[3].match(/[\d.]+,\d{2}/g) ?? [])
      .map((n) => parseLocaleNumber(n))
      .filter((n): n is number => n !== null);
    if (nums.length === 0) continue;

    const upper = match[3].toUpperCase();
    const status: ParsedInstallmentStatus =
      upper.includes('PAG') || upper.includes('LIQUID')
        ? 'PAID'
        : upper.includes('ATRAS') || upper.includes('VENCID')
          ? 'OVERDUE'
          : 'PENDING';

    const principalAmount = nums.length >= 3 ? nums[0] : 0;
    const interestAmount = nums.length >= 3 ? nums[1] : 0;
    const totalAmount = nums.length >= 3 ? nums[2] : nums[0];
    const endingBalance = nums.length >= 4 ? nums[nums.length - 1] : 0;

    installments.push({
      installmentNumber: Number(match[1]),
      code: match[1],
      dueDate,
      totalAmount,
      principalAmount,
      interestAmount,
      indexerCorrection: 0,
      mipInsurance: 0,
      dfiInsurance: 0,
      adminFee: 0,
      penaltyAmount: 0,
      lateInterest: 0,
      fgtsMonthlyUsed: 0,
      balanceCorrection: 0,
      endingBalance,
      status,
      paidDate: status === 'PAID' ? dueDate : null,
      paidAmount: status === 'PAID' ? totalAmount : null,
    });
  }

  return {
    detectedFormat,
    contract,
    installments,
    extraAmortizations: [],
    warnings: installments.length === 0 ? ['Formato não reconhecido automaticamente; revise ou utilize CSV.'] : [],
  };
}

/**
 * Parses a financing statement (Bradesco PDF Extrato Financeiro, Caixa/Itaú/Santander/BB PDFs, or CSV).
 */
export function parseFinancingStatementText(text: string, fileName?: string): ParsedFinancingStatement {
  if (isCsvText(text, fileName)) {
    return parseCsvStatement(text, fileName);
  }
  const upper = text.toUpperCase();
  if (upper.includes('BRADESCO') || (upper.includes('ENCARGOS') && upper.includes('SALDO DEVEDOR'))) {
    return parseBradescoPdfText(text);
  }
  return parseGenericBankText(text, fileName);
}

/**
 * Parses an FGTS statement text (Caixa FGTS PDF/Extrato) to extract current balance
 * and the most recent housing/amortization usage date.
 */
export function parseFgtsStatementText(text: string): ParsedFgtsStatement {
  const warnings: string[] = [];
  let currentBalance: number | null = null;
  let lastUsageDate: string | null = null;
  let lastUsageAmount: number | null = null;
  let lastUsageDescription: string | null = null;

  const balanceMatch = text.match(
    /(?:SALDO\s+ATUAL|SALDO\s+TOTAL|VALOR\s+DISPON[ÍI]VEL|SALDO\s+PARA\s+SAQUE)[:\sR$]*([\d.,]+)/i
  );
  if (balanceMatch) {
    currentBalance = parseLocaleNumber(balanceMatch[1]);
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const housingKeywords = /(MORADIA|HABITA[ÇC][ÃA]O|AMORTIZA[ÇC][ÃA]O|AQUISI[ÇC][ÃA]O|IM[ÓO]VEL|SAQUE\s+COD\s*9[12]|DAMP)/i;

  const candidates: Array<{ date: string; amount: number | null; description: string }> = [];
  for (const line of lines) {
    if (!housingKeywords.test(line)) continue;
    const dateMatch = line.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (!dateMatch) continue;
    const isoDate = parseBrDate(dateMatch[1]);
    if (!isoDate) continue;
    const moneyMatches = line.match(/-?[\d.]+,\d{2}/g);
    const amount = moneyMatches ? Math.abs(parseLocaleNumber(moneyMatches[moneyMatches.length - 1]) ?? 0) : null;
    candidates.push({ date: isoDate, amount, description: line });
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.date.localeCompare(a.date));
    lastUsageDate = candidates[0].date;
    lastUsageAmount = candidates[0].amount;
    lastUsageDescription = candidates[0].description;
  } else {
    warnings.push('Nenhuma movimentação de uso habitacional do FGTS encontrada no texto.');
  }

  return {
    currentBalance,
    lastUsageDate,
    lastUsageAmount,
    lastUsageDescription,
    warnings,
  };
}
