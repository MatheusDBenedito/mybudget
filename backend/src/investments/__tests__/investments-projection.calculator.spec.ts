import {
    calculateInvestmentsProjection,
    estimateDividendPaymentDate,
} from '../projections/investments-projection.calculator';

describe('calculateInvestmentsProjection', () => {
    const today = new Date('2026-11-12T12:00:00.000Z');

    it('allocates scheduled PENDING dividends to their payment month and skips projected FII average in months already announced', () => {
        const investments = [
            {
                id: 'fii-hglg',
                name: 'HGLG11',
                type: 'FII',
                tickerCode: 'HGLG11',
                quantity: 10,
                investedAmount: 1600,
                currentValue: 1600,
            },
            {
                id: 'fii-btlg',
                name: 'BTLG11',
                type: 'FII',
                tickerCode: 'BTLG11',
                quantity: 10,
                investedAmount: 1000,
                currentValue: 1000,
            },
        ];

        const dividends = [
            // HGLG11 paid in Oct 2026 (R$ 1.10/share) and announced in Nov 2026 (exDate 2026-11-03 -> pays 10th business day = 2026-11-16 > today)
            {
                id: 'd1',
                investmentId: 'fii-hglg',
                tickerCode: 'HGLG11',
                date: '2026-10-02T13:00:00.000Z',
                amountPerShare: 1.10,
                quantity: 10,
                totalOriginal: 11.0,
                currency: 'BRL',
                totalBrl: 11.0,
                investment: { id: 'fii-hglg', name: 'HGLG11', type: 'FII' },
            },
            {
                id: 'd2',
                investmentId: 'fii-hglg',
                tickerCode: 'HGLG11',
                date: '2026-11-03T13:00:00.000Z',
                amountPerShare: 1.10,
                quantity: 10,
                totalOriginal: 11.0,
                currency: 'BRL',
                totalBrl: 11.0,
                investment: { id: 'fii-hglg', name: 'HGLG11', type: 'FII' },
            },
            // BTLG11 paid in Oct 2026 (R$ 0.80/share -> pays 2026-10-26 <= today), not yet announced for Nov 2026
            {
                id: 'd3',
                investmentId: 'fii-btlg',
                tickerCode: 'BTLG11',
                date: '2026-10-15T13:00:00.000Z',
                amountPerShare: 0.80,
                quantity: 10,
                totalOriginal: 8.0,
                currency: 'BRL',
                totalBrl: 8.0,
                investment: { id: 'fii-btlg', name: 'BTLG11', type: 'FII' },
            },
        ];

        const result = calculateInvestmentsProjection({
            investments,
            dividends,
            startMonth: 11,
            startYear: 2026,
            monthsCount: 12,
            today,
        });

        expect(result.summary.scheduledTotalBrl).toBe(11.0);
        expect(result.summary.scheduledCount).toBe(1);
        expect(result.summary.fiiMonthlyAverageBrl).toBe(19.0); // 11.0 (HGLG11) + 8.0 (BTLG11)

        // Month 0 (Nov/2026): HGLG11 is in scheduledDividends (11.0), only BTLG11 is in projectedFiiDividends (8.0)
        expect(result.months[0].scheduledDividends).toBe(11.0);
        expect(result.months[0].projectedFiiDividends).toBe(8.0);
        expect(result.months[0].total).toBe(19.0);

        // Month 1..11 (Dec/2026..Oct/2027): both FIIs are in projectedFiiDividends (19.0)
        expect(result.months[1].scheduledDividends).toBe(0);
        expect(result.months[1].projectedFiiDividends).toBe(19.0);
    });

    it('projects net fixed income monthly yield discounting regressive IR tax', () => {
        const investments = [
            {
                id: 'cdb-1',
                name: 'CDB 100% CDI',
                type: 'FIXED_INCOME',
                investedAmount: 10000,
                currentValue: 10000,
                grossValue: 10000,
                investmentDate: '2024-01-01T00:00:00.000Z', // > 720 days -> 15% IR
                cdiPercentage: 100,
            },
        ];

        const result = calculateInvestmentsProjection({
            investments,
            dividends: [],
            startMonth: 11,
            startYear: 2026,
            monthsCount: 12,
            today,
            cdiDailyRate: 0.00055,
        });

        // On 2026-11-12, Nov/2026 has 19 total ANBIMA business days, 8 elapsed (counting Nov 12), and 11 remaining
        expect(result.months[0].businessDaysTotal).toBe(19);
        expect(result.months[0].businessDaysElapsed).toBe(8);
        expect(result.months[0].businessDaysRemaining).toBe(11);
        expect(result.months[0].fixedIncomeGrossYield).toBeGreaterThan(50);
        // At 15% IR, net is 85% of gross
        expect(result.months[0].fixedIncomeNetYield).toBeCloseTo(
            result.months[0].fixedIncomeGrossYield * 0.85,
            1,
        );
        expect(result.summary.fixedIncomeNet12mBrl).toBeGreaterThan(1100);

        // Next business day (2026-11-13 -> 9 elapsed, 10 remaining), current month remaining yield decreases
        const nextDayResult = calculateInvestmentsProjection({
            investments,
            dividends: [],
            startMonth: 11,
            startYear: 2026,
            monthsCount: 12,
            today: new Date('2026-11-13T12:00:00.000Z'),
            cdiDailyRate: 0.00055,
        });
        expect(nextDayResult.months[0].businessDaysElapsed).toBe(9);
        expect(nextDayResult.months[0].businessDaysRemaining).toBe(10);
        expect(nextDayResult.months[0].fixedIncomeNetYield).toBeLessThan(
            result.months[0].fixedIncomeNetYield,
        );
    });

    it('excludes FIIs that already paid in the current month from projectedFiiDividends of that month', () => {
        const refToday = new Date('2026-11-16T12:00:00.000Z');
        const investments = [
            {
                id: 'fii-mxrf',
                name: 'MXRF11',
                type: 'FII',
                tickerCode: 'MXRF11',
                quantity: 100,
                investedAmount: 1000,
                currentValue: 1000,
            },
        ];

        // exDate 2026-10-30 -> paymentDate is 10th business day of Nov/2026 (2026-11-13 <= 2026-11-15)
        const dividends = [
            {
                id: 'd-mxrf-nov',
                investmentId: 'fii-mxrf',
                tickerCode: 'MXRF11',
                date: '2026-10-30T13:00:00.000Z',
                amountPerShare: 0.10,
                quantity: 100,
                totalOriginal: 10.0,
                currency: 'BRL',
                totalBrl: 10.0,
                investment: { id: 'fii-mxrf', name: 'MXRF11', type: 'FII' },
            },
        ];

        const result = calculateInvestmentsProjection({
            investments,
            dividends,
            startMonth: 11,
            startYear: 2026,
            monthsCount: 12,
            today: refToday,
        });

        // Already paid in Nov/2026: scheduled is 0 and projectedFiiDividends for Nov/2026 must also be 0
        expect(result.months[0].scheduledDividends).toBe(0);
        expect(result.months[0].projectedFiiDividends).toBe(0);
        // Dec/2026..Oct/2027 (11 months) still project 10.0/month
        expect(result.months[1].projectedFiiDividends).toBe(10.0);
        expect(result.summary.fiiMonthlyAverageBrl).toBe(10.0);
        expect(result.summary.fiiTotal12mBrl).toBe(110.0);
    });

    it('uses ANBIMA holidays for 10th business day and treats BTHF11 (Nov/2026) as paid on 2026-11-16', () => {
        // Nov 2, 2026 is Finados holiday -> 10th ANBIMA business day of Nov/2026 is 2026-11-16
        const bthfPay = estimateDividendPaymentDate(new Date('2026-11-10T13:00:00.000Z'), 'FII', 'BTHF11');
        const hglgPay = estimateDividendPaymentDate(new Date('2026-11-03T13:00:00.000Z'), 'FII', 'HGLG11');
        const mxrfPay = estimateDividendPaymentDate(new Date('2026-11-03T13:00:00.000Z'), 'FII', 'MXRF11');
        const hgbsPay = estimateDividendPaymentDate(new Date('2026-11-03T13:00:00.000Z'), 'FII', 'HGBS11');

        expect(bthfPay.toISOString().slice(0, 10)).toBe('2026-11-16');
        expect(hglgPay.toISOString().slice(0, 10)).toBe('2026-11-16');
        expect(mxrfPay.toISOString().slice(0, 10)).toBe('2026-11-16');
        expect(hgbsPay.toISOString().slice(0, 10)).toBe('2026-11-16');
    });

    it('stops accruing fixed-income yield after maturityDate', () => {
        const refToday = new Date(2026, 10, 18, 12, 0, 0); // 18/11/2026
        const investments = [
            {
                id: 'cdb-1',
                name: 'CDB Banco X',
                type: 'FIXED_INCOME',
                investedAmount: 10000,
                currentValue: 11000,
                grossValue: 11000,
                investmentDate: '2025-11-18T12:00:00.000Z',
                maturityDate: '2026-12-15T12:00:00.000Z',
                cdiPercentage: 100,
            },
        ];

        const result = calculateInvestmentsProjection({
            investments,
            dividends: [],
            startMonth: 11,
            startYear: 2026,
            monthsCount: 4,
            today: refToday,
        });

        // Nov/2026 and Dec/2026 (up to Dec 15) accrue yield; Jan/2027 and Feb/2027 must be 0
        expect(result.months[0].fixedIncomeNetYield).toBeGreaterThan(0);
        expect(result.months[1].fixedIncomeNetYield).toBeGreaterThan(0);
        expect(result.months[2].fixedIncomeNetYield).toBe(0);
        expect(result.months[3].fixedIncomeNetYield).toBe(0);
    });
});

