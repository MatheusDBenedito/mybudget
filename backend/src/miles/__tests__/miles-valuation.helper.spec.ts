import {
    DEFAULT_MILES_PROGRAM_RATES,
    mergeMilesProgramRates,
    normalizeMilesProgramRates,
} from '../helpers/miles-valuation.helper';

describe('miles-valuation.helper', () => {
    it('normalizes valid program rates and strips invalid entries', () => {
        const result = normalizeMilesProgramRates({
            '  Smiles  ': 18.234,
            '': 20,
            Negative: -5,
            NotANumber: 'abc',
            'Custom Air': 52.5,
        });

        expect(result).toEqual({
            Smiles: 18.23,
            'Custom Air': 52.5,
        });
    });

    it('returns empty object when input is null, primitive, or array', () => {
        expect(normalizeMilesProgramRates(null)).toEqual({});
        expect(normalizeMilesProgramRates([])).toEqual({});
        expect(normalizeMilesProgramRates('invalid')).toEqual({});
    });

    it('merges stored workspace overrides with defaults', () => {
        const merged = mergeMilesProgramRates({ Smiles: 16.0, 'Air France': 40 });
        expect(merged.Smiles).toBe(16.0);
        expect(merged['LATAM Pass']).toBe(DEFAULT_MILES_PROGRAM_RATES['LATAM Pass']);
        expect(merged['Air France']).toBe(40);
    });
});
