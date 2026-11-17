/**
 * Default average BRL value per 1,000 points/miles ("milheiro") for common Brazilian programs.
 * Users can override any program or add custom ones per workspace.
 */
export const DEFAULT_MILES_PROGRAM_RATES: Record<string, number> = {
    Smiles: 17.5,
    'LATAM Pass': 24.0,
    TudoAzul: 21.0,
    'TAP Miles&Go': 38.0,
    'Iberia Plus': 45.0,
    Livelo: 35.0,
    Esfera: 35.0,
    'Átomos': 35.0,
};

/**
 * Sanitizes and normalizes a map of program -> BRL per 1,000 miles.
 * Drops invalid keys/values, trims program names, and rounds rates to 2 decimal places.
 */
export function normalizeMilesProgramRates(raw: unknown): Record<string, number> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return {};
    }

    const normalized: Record<string, number> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        const program = key.trim();
        const num = Number(value);
        if (!program || !Number.isFinite(num) || num < 0) continue;
        normalized[program] = Math.round(num * 100) / 100;
    }
    return normalized;
}

/**
 * Merges workspace-configured rates with default rates so every standard program always has a sensible baseline.
 */
export function mergeMilesProgramRates(stored: unknown): Record<string, number> {
    return {
        ...DEFAULT_MILES_PROGRAM_RATES,
        ...normalizeMilesProgramRates(stored),
    };
}
