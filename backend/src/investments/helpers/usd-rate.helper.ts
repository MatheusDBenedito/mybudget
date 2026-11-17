/**
 * Fetches the current USD -> BRL exchange rate with multi-provider fallback.
 * Provider priority:
 *   1. AwesomeAPI (direct, real-time bid)
 *   2. Yahoo Finance (USDBRL=X, real-time fallback when AwesomeAPI returns 429 on cloud IPs)
 *   3. open.er-api.com (open exchange rates CDN fallback)
 */
export async function fetchUsdRateWithFallback(
    fetchFn: typeof fetch = fetch
): Promise<{ rate: number; provider: 'awesomeapi' | 'yahoo' | 'open-er' } | null> {
    // 1. AwesomeAPI
    try {
        const response = await fetchFn('https://economia.awesomeapi.com.br/last/USD-BRL', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        });
        if (response.ok) {
            const data: any = await response.json();
            const bid = Number(data?.USDBRL?.bid);
            if (bid > 0) {
                return { rate: bid, provider: 'awesomeapi' };
            }
        }
    } catch {
        // fallback to Yahoo
    }

    // 2. Yahoo Finance (USDBRL=X)
    try {
        const response = await fetchFn(
            'https://query1.finance.yahoo.com/v8/finance/chart/USDBRL=X?interval=1d&range=1d',
            { headers: { 'User-Agent': 'Mozilla/5.0' } }
        );
        if (response.ok) {
            const data: any = await response.json();
            const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
            if (typeof price === 'number' && price > 0) {
                return { rate: price, provider: 'yahoo' };
            }
        }
    } catch {
        // fallback to open.er-api
    }

    // 3. open.er-api.com
    try {
        const response = await fetchFn('https://open.er-api.com/v6/latest/USD', {
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        if (response.ok) {
            const data: any = await response.json();
            const rate = Number(data?.rates?.BRL);
            if (rate > 0) {
                return { rate, provider: 'open-er' };
            }
        }
    } catch {
        // all providers failed
    }

    return null;
}
