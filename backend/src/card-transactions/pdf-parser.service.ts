import { Injectable } from '@nestjs/common';

export interface ParsedTransaction {
    date: string;            // ISO date string (YYYY-MM-DD)
    description: string;
    amount: number;          // positive float in BRL
    installmentsCurrent: number | null;
    installmentsTotal: number | null;
    suggestedCategoryId: string | null;
    hasCategoryMatch: boolean;
}

interface CategoryLike {
    id: string;
    name: string;
}

interface TextItem {
    str: string;
    transform: number[]; // [sx, sk1, sk2, sy, tx, ty]
}

// Portuguese abbreviated month names -> month number
const PT_MONTHS: Record<string, number> = {
    jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
    jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

// Keywords that indicate a credit/reversal line — skip these
const SKIP_KEYWORDS = [
    'pagamento', 'estorno', 'crédito', 'credito', 'reembolso',
    'cashback', 'devolucao', 'devolução', 'cancelamento',
];

@Injectable()
export class PdfParserService {

    async parseStatementPdf(buffer: Buffer, categories: CategoryLike[], password?: string): Promise<ParsedTransaction[]> {
        const text = await this.extractTextFromPdf(buffer, password);
        return this.extractTransactions(text, categories);
    }

    async extractRawText(buffer: Buffer, password?: string): Promise<string> {
        return this.extractTextFromPdf(buffer, password);
    }

    private async extractTextFromPdf(buffer: Buffer, password?: string): Promise<string> {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

        const uint8 = new Uint8Array(buffer);
        const loadingTask = pdfjsLib.getDocument({
            data: uint8,
            password: password ?? '',
        });

        const pdfDoc = await loadingTask.promise;
        const numPages: number = pdfDoc.numPages;
        const allLines: string[] = [];

        for (let i = 1; i <= numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const content = await page.getTextContent();
            const pageLines = this.reconstructLines(content.items as TextItem[]);
            allLines.push(...pageLines);
        }

        return allLines.join('\n');
    }

    private reconstructLines(items: TextItem[]): string[] {
        if (!items.length) return [];

        const TOLERANCE = 2;
        const groups = new Map<number, { x: number; str: string }[]>();

        for (const item of items) {
            if (!item.str.trim()) continue;
            const ty = item.transform[5];
            const tx = item.transform[4];

            let key: number | undefined;
            for (const k of groups.keys()) {
                if (Math.abs(k - ty) <= TOLERANCE) { key = k; break; }
            }
            if (key === undefined) { key = ty; groups.set(key, []); }
            groups.get(key)!.push({ x: tx, str: item.str });
        }

        const sortedKeys = [...groups.keys()].sort((a, b) => b - a);
        const lines: string[] = [];
        for (const key of sortedKeys) {
            const group = groups.get(key)!.sort((a, b) => a.x - b.x);
            const line = group.map(g => g.str).join(' ').trim();
            if (line) lines.push(line);
        }

        return lines;
    }

    private extractTransactions(text: string, categories: CategoryLike[]): ParsedTransaction[] {
        const transactions: ParsedTransaction[] = [];
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

        // Try to find invoice close date for year resolution
        // e.g. "fechamento desta fatura em 29/01/26"
        const { closeMonth, closeYear } = this.extractCloseDate(lines);

        // C6 Bank format:
        //   DD MMM DESCRIPTION [- Parcela X/Y] AMOUNT
        //   e.g.: "07 out AMAZONMKTPLC*RFGARCIAC - Parcela 4/4 87,75"
        //   e.g.: "29 dez RDSAUDE ONLINE 43,99"
        //   e.g.: "17 jan IG*IGRALAMEDA 1.851,20"
        const txRegex = new RegExp(
            `^(\\d{1,2})\\s+(${Object.keys(PT_MONTHS).join('|')})\\s+(.+?)(?:\\s+-\\s+Parcela\\s+(\\d+)\\/(\\d+))?\\s+([\\d.]+,\\d{2})\\s*$`,
            'i'
        );

        for (const line of lines) {
            const match = line.match(txRegex);
            if (!match) continue;

            const [, dayStr, monthStr, description, installCurrentStr, installTotalStr, amountRaw] = match;

            // Skip payments, reversals, credits
            const descLower = description.toLowerCase();
            if (SKIP_KEYWORDS.some(kw => descLower.includes(kw))) continue;

            // Parse date
            const monthNum = PT_MONTHS[monthStr.toLowerCase()];
            const year = monthNum > closeMonth ? closeYear - 1 : closeYear;
            const day = parseInt(dayStr, 10);
            const date = new Date(year, monthNum - 1, day);
            if (isNaN(date.getTime())) continue;
            const parsedDate = date.toISOString().split('T')[0];

            // Parse amount
            const amount = parseFloat(amountRaw.replace(/\./g, '').replace(',', '.'));
            if (isNaN(amount) || amount <= 0) continue;

            const installmentsCurrent = installCurrentStr ? parseInt(installCurrentStr, 10) : null;
            const installmentsTotal = installTotalStr ? parseInt(installTotalStr, 10) : null;

            const { id: suggestedCategoryId, matched: hasCategoryMatch } = this.matchCategory(description, categories);

            transactions.push({
                date: parsedDate,
                description: description.trim(),
                amount,
                installmentsCurrent,
                installmentsTotal,
                suggestedCategoryId,
                hasCategoryMatch,
            });
        }

        return transactions;
    }

    /**
     * Extracts the invoice close date to resolve transaction years.
     * Looks for patterns like "fechamento desta fatura em DD/MM/YY" or "DD/MM/26"
     */
    private extractCloseDate(lines: string[]): { closeMonth: number; closeYear: number } {
        const pattern = /fechament\w*\s+desta\s+fatura\s+em\s+(\d{2})\/(\d{2})\/(\d{2,4})/i;
        for (const line of lines) {
            const match = line.match(pattern);
            if (match) {
                const closeMonth = parseInt(match[2], 10);
                let closeYear = parseInt(match[3], 10);
                if (closeYear < 100) closeYear += 2000;
                return { closeMonth, closeYear };
            }
        }
        // Fallback: use current date
        const now = new Date();
        return { closeMonth: now.getMonth() + 1, closeYear: now.getFullYear() };
    }

    private matchCategory(description: string, categories: CategoryLike[]): { id: string | null; matched: boolean } {
        const desc = description.toLowerCase();
        for (const cat of categories) {
            const words = cat.name.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
            if (words.some(word => desc.includes(word))) {
                return { id: cat.id, matched: true };
            }
        }
        return { id: null, matched: false };
    }
}
