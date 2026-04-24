/**
 * ANBIMA Business Days Utility
 * Calculates business days for CDI compounding, excluding weekends and Brazilian holidays.
 */

/**
 * Calculates Easter Sunday for a given year using the Anonymous Gregorian algorithm (Computus).
 */
function getEasterSunday(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
}

/**
 * Adds `days` to a date and returns a new Date.
 */
function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

/**
 * Returns a Set of ANBIMA holiday date strings ("YYYY-MM-DD") for a given year.
 * Includes fixed national holidays and floating holidays derived from Easter.
 */
function getAnbimaHolidays(year: number): Set<string> {
    const holidays = new Set<string>();

    const fmt = (d: Date): string => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    // Fixed holidays
    holidays.add(`${year}-01-01`); // Confraternização Universal
    holidays.add(`${year}-04-21`); // Tiradentes
    holidays.add(`${year}-05-01`); // Dia do Trabalho
    holidays.add(`${year}-09-07`); // Independência do Brasil
    holidays.add(`${year}-10-12`); // Nossa Senhora Aparecida
    holidays.add(`${year}-11-02`); // Finados
    holidays.add(`${year}-11-15`); // Proclamação da República
    holidays.add(`${year}-11-20`); // Dia da Consciência Negra (nacional desde 2024)
    holidays.add(`${year}-12-25`); // Natal

    // Floating holidays (based on Easter)
    const easter = getEasterSunday(year);
    holidays.add(fmt(addDays(easter, -48))); // Carnaval Segunda
    holidays.add(fmt(addDays(easter, -47))); // Carnaval Terça
    holidays.add(fmt(addDays(easter, -2)));  // Sexta-feira Santa
    holidays.add(fmt(addDays(easter, 60)));  // Corpus Christi

    return holidays;
}

/**
 * Counts the number of ANBIMA business days between two dates (exclusive of start, inclusive of end).
 * This matches CDI accrual convention: the investment date itself does not count,
 * but the current/end date does count if it is a business day.
 */
export function countBusinessDays(startDate: Date, endDate: Date): number {
    const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

    if (end <= start) return 0;

    // Collect holidays for all years in range
    const holidaySets = new Map<number, Set<string>>();
    for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
        holidaySets.set(y, getAnbimaHolidays(y));
    }

    let count = 0;
    const current = new Date(start);
    current.setDate(current.getDate() + 1); // Start from day after startDate

    while (current <= end) {
        const dayOfWeek = current.getDay();
        // Skip weekends (0 = Sunday, 6 = Saturday)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            const y = current.getFullYear();
            const m = String(current.getMonth() + 1).padStart(2, '0');
            const d = String(current.getDate()).padStart(2, '0');
            const key = `${y}-${m}-${d}`;

            const holidays = holidaySets.get(y);
            if (!holidays || !holidays.has(key)) {
                count++;
            }
        }
        current.setDate(current.getDate() + 1);
    }

    return count;
}
