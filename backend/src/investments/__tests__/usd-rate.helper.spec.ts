import { fetchUsdRateWithFallback } from '../helpers/usd-rate.helper';

describe('usd-rate.helper', () => {
    it('returns rate from AwesomeAPI when it responds successfully', async () => {
        const mockFetch = jest.fn().mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ USDBRL: { bid: '5.7838' } }),
        });

        const result = await fetchUsdRateWithFallback(mockFetch as unknown as typeof fetch);
        expect(result).toEqual({ rate: 5.7838, provider: 'awesomeapi' });
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith(
            'https://economia.awesomeapi.com.br/last/USD-BRL',
            expect.objectContaining({
                headers: expect.objectContaining({ 'User-Agent': expect.any(String) }),
            })
        );
    });

    it('falls back to Yahoo Finance when AwesomeAPI returns 429 Too Many Requests', async () => {
        const mockFetch = jest
            .fn()
            .mockResolvedValueOnce({
                ok: false,
                status: 429,
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    chart: {
                        result: [{ meta: { regularMarketPrice: 5.7838 } }],
                    },
                }),
            });

        const result = await fetchUsdRateWithFallback(mockFetch as unknown as typeof fetch);
        expect(result).toEqual({ rate: 5.7838, provider: 'yahoo' });
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(mockFetch.mock.calls[1][0]).toContain('query1.finance.yahoo.com');
    });

    it('falls back to open.er-api when both AwesomeAPI and Yahoo fail', async () => {
        const mockFetch = jest
            .fn()
            .mockRejectedValueOnce(new Error('Network error on AwesomeAPI'))
            .mockResolvedValueOnce({
                ok: false,
                status: 500,
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    rates: { BRL: 5.72 },
                }),
            });

        const result = await fetchUsdRateWithFallback(mockFetch as unknown as typeof fetch);
        expect(result).toEqual({ rate: 5.72, provider: 'open-er' });
        expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('returns null when all providers fail', async () => {
        const mockFetch = jest.fn().mockRejectedValue(new Error('All offline'));

        const result = await fetchUsdRateWithFallback(mockFetch as unknown as typeof fetch);
        expect(result).toBeNull();
        expect(mockFetch).toHaveBeenCalledTimes(3);
    });
});
