import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { CreateInvestmentDto } from './dto/create-investment.dto';
import { UpdateInvestmentDto } from './dto/update-investment.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Investment } from '@prisma/client';
import { countBusinessDays } from './business-days.util';
import {
    calculateInvestmentsProjection,
    estimateDividendPaymentDate,
    InvestmentsProjectionResult,
} from './projections/investments-projection.calculator';
import {
    calculateCreditDeltaForAccount,
    dividendKey,
    endOfUtcDay,
    ExistingDividendCredit,
    planDividendCredits,
    resolveAccountLinkUpdate,
} from './helpers/dividend-credit.helper';
import {
    CdiDayRate,
    filterCdiRatesByRange,
    compoundWithRealRates,
} from './helpers/cdi-calculation.helper';
import { fetchUsdRateWithFallback } from './helpers/usd-rate.helper';

@Injectable()
export class InvestmentsService {
    private readonly logger = new Logger(InvestmentsService.name);

    // In-memory cache for CDI rates
    private cdiCache: CdiDayRate[] = [];
    private cdiCacheExpiry: number = 0;
    private cdiCacheStart: Date | null = null;
    private cdiFetchInFlight: Promise<void> | null = null;
    private readonly CDI_CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

    // In-memory cache for US stock/ETF prices (USD)
    private usPriceCache: Map<string, number> = new Map();
    private usCacheExpiry: number = 0;
    private readonly US_CACHE_TTL_MS = 1000 * 60 * 15; // 15 minutes

    // In-memory cache for USD -> BRL rate
    private usdRate: number | null = null;
    private usdRateExpiry: number = 0;
    private usdFetchInFlight: Promise<void> | null = null;
    private readonly USD_RATE_TTL_MS = 1000 * 60 * 5; // 5 minutes

    // brapi.dev free tier rate-limits bursts, so tickers are fetched sequentially
    private readonly BRAPI_REQUEST_INTERVAL_MS = 300;
    private readonly BRAPI_RETRY_DELAY_MS = 1500;

    // In-memory cache for B3 stock prices
    private b3PriceCache: Map<string, number> = new Map();
    private b3CacheExpiry: number = 0;
    private b3FetchInFlight: Promise<void> | null = null;
    private readonly B3_CACHE_TTL_MS = 1000 * 60 * 20; // 20 minutes

    // In-memory cache for Crypto prices (Binance / CoinGecko) keyed by uppercase ticker
    private cryptoPriceCache: Map<string, { brl: number; usd: number }> = new Map();
    private cryptoCacheExpiry: number = 0;
    private readonly CRYPTO_CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes

    // Deduplicate concurrent findAll() calls per workspace (e.g. Resumo loading /investments + /projections + /cash-flow)
    private findAllInFlight: Map<string, Promise<any[]>> = new Map();

    // In-memory cache for historical dividend events per ticker
    private dividendEventsCache: Map<string, { fetchedAt: number; events: Array<{ date: Date; amountPerShare: number }> }> = new Map();
    private syncedInvestmentIds: Set<string> = new Set();
    private readonly DIVIDEND_CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour
    private readonly DIVIDEND_DB_FRESH_MS = 1000 * 60 * 60 * 12; // skip auto re-sync if synced in the last 12h

    // Map common crypto symbols (including Binance 1M/1000 bundle tokens) to Binance USDT pairs
    private readonly BINANCE_SYMBOL_MAP: Record<string, string> = {
        'BABYDOGE': '1MBABYDOGEUSDT',
        '1MBABYDOGE': '1MBABYDOGEUSDT',
        'SATS': '1000SATSUSDT',
        '1000SATS': '1000SATSUSDT',
        '1000SHIB': '1000SHIBUSDT',
        '1000PEPE': '1000PEPEUSDT',
        '1000FLOKI': '1000FLOKIUSDT',
        '1000BONK': '1000BONKUSDT',
        'MATIC': 'POLUSDT',
        'POL': 'POLUSDT',
    };

    // Map common crypto symbols to CoinGecko IDs and optional bundle multipliers
    private readonly COINGECKO_ID_MAP: Record<string, { id: string; multiplier?: number }> = {
        'BTC': { id: 'bitcoin' },
        'ETH': { id: 'ethereum' },
        'USDT': { id: 'tether' },
        'BNB': { id: 'binancecoin' },
        'SOL': { id: 'solana' },
        'XRP': { id: 'ripple' },
        'USDC': { id: 'usd-coin' },
        'ADA': { id: 'cardano' },
        'AVAX': { id: 'avalanche-2' },
        'DOGE': { id: 'dogecoin' },
        'DOT': { id: 'polkadot' },
        'MATIC': { id: 'matic-network' },
        'POL': { id: 'polygon-ecosystem-token' },
        'WBTC': { id: 'wrapped-bitcoin' },
        'SHIB': { id: 'shiba-inu' },
        'LTC': { id: 'litecoin' },
        'LINK': { id: 'chainlink' },
        'BCH': { id: 'bitcoin-cash' },
        'FET': { id: 'fetch-ai' },
        'BABYDOGE': { id: 'baby-doge-coin', multiplier: 1_000_000 },
        '1MBABYDOGE': { id: 'baby-doge-coin', multiplier: 1_000_000 },
        'SATS': { id: 'sats-ordinals', multiplier: 1_000 },
        '1000SATS': { id: 'sats-ordinals', multiplier: 1_000 },
    };

    // Fallback: fixed CDI for when BCB API is unavailable
    private readonly CDI_ANUAL_FALLBACK = 0.149;
    private readonly DIAS_UTEIS_ANO = 252;
    private readonly CDI_DIARIO_FALLBACK = Math.pow(1 + this.CDI_ANUAL_FALLBACK, 1 / this.DIAS_UTEIS_ANO) - 1;

    constructor(private prisma: PrismaService) { }

    async create(workspaceId: string, createInvestmentDto: CreateInvestmentDto) {
        const data: any = { ...createInvestmentDto, workspaceId };
        const linkUpdate = resolveAccountLinkUpdate(data.accountId, null, null);
        if (linkUpdate) {
            await this.ensureAccountInWorkspace(workspaceId, linkUpdate.accountId);
            data.accountId = linkUpdate.accountId;
            data.accountLinkedAt = linkUpdate.accountLinkedAt;
        }
        this.applyUsStockInvestedAmount(data);
        this.applyCryptoInvestedAmount(data);
        if (!data.currentValue) {
            data.currentValue = data.investedAmount;
        }
        // Handle date string to Date object
        if (data.investmentDate) {
            data.investmentDate = new Date(data.investmentDate);
        } else {
            data.investmentDate = new Date(); // default to today if missing
        }
        const created = await this.prisma.investment.create({
            data,
            include: {
                account: { select: { id: true, name: true, currency: true } },
            },
        });
        await this.syncDividendsForInvestment(created);
        return created;
    }

    async findAll(workspaceId: string) {
        const existing = this.findAllInFlight.get(workspaceId);
        if (existing) return existing;

        const run = this.findAllInternal(workspaceId).finally(() => {
            this.findAllInFlight.delete(workspaceId);
        });
        this.findAllInFlight.set(workspaceId, run);
        return run;
    }

    private async findAllInternal(workspaceId: string) {
        const investments = await this.prisma.investment.findMany({
            where: { workspaceId },
            include: {
                account: { select: { id: true, name: true, currency: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        const variableTickers = [
            ...new Set(
                investments
                    .filter(i => (i.type === 'VARIABLE_INCOME' || i.type === 'FII') && i.tickerCode)
                    .map(i => i.tickerCode!)
                    .filter(Boolean),
            ),
        ];
        const cryptoTickers = [
            ...new Set(
                investments
                    .filter(i => i.type === 'CRYPTO' && i.tickerCode)
                    .map(i => i.tickerCode!)
                    .filter(Boolean),
            ),
        ];
        const usTickers = [
            ...new Set(
                investments
                    .filter(i => i.type === 'US_STOCK' && i.tickerCode)
                    .map(i => i.tickerCode!)
                    .filter(Boolean),
            ),
        ];
        const fixedDates = investments
            .filter(i => i.type === 'FIXED_INCOME' && i.investmentDate && i.cdiPercentage)
            .map(i => new Date(i.investmentDate!).getTime());

        const tasks: Promise<unknown>[] = [];
        if (variableTickers.length > 0) {
            tasks.push(this.fetchB3Prices(variableTickers));
        }
        if (cryptoTickers.length > 0 || usTickers.length > 0) {
            tasks.push(this.fetchUsdRate());
        }
        if (cryptoTickers.length > 0) {
            tasks.push(this.fetchCryptoPrices(cryptoTickers));
        }
        if (usTickers.length > 0) {
            tasks.push(this.fetchUsPrices(usTickers));
        }
        if (fixedDates.length > 0) {
            tasks.push(this.ensureCdiRates(new Date(Math.min(...fixedDates)), new Date()));
        }

        await Promise.all(tasks);

        return Promise.all(investments.map(inv => this.enrichInvestment(inv)));
    }

    async findOne(workspaceId: string, id: string) {
        const investment = await this.prisma.investment.findFirst({
            where: { id, workspaceId },
            include: {
                account: { select: { id: true, name: true, currency: true } },
            },
        });
        if (!investment) {
            throw new NotFoundException(`Investment with ID ${id} not found`);
        }
        if ((investment.type === 'VARIABLE_INCOME' || investment.type === 'FII') && investment.tickerCode) {
            await this.fetchB3Prices([investment.tickerCode]);
        } else if (investment.type === 'CRYPTO' && investment.tickerCode) {
            await this.fetchUsdRate();
            await this.fetchCryptoPrices([investment.tickerCode]);
        } else if (investment.type === 'US_STOCK' && investment.tickerCode) {
            await Promise.all([this.fetchUsPrices([investment.tickerCode]), this.fetchUsdRate()]);
        }
        return this.enrichInvestment(investment);
    }

    async update(workspaceId: string, id: string, updateInvestmentDto: UpdateInvestmentDto) {
        const existing = await this.prisma.investment.findFirst({ where: { id, workspaceId } });
        if (!existing) {
            throw new NotFoundException(`Investment with ID ${id} not found`);
        }

        const data: any = { ...updateInvestmentDto };
        const linkUpdate = resolveAccountLinkUpdate(
            data.accountId,
            existing.accountId,
            existing.accountLinkedAt,
        );
        if (linkUpdate) {
            await this.ensureAccountInWorkspace(workspaceId, linkUpdate.accountId);
            data.accountId = linkUpdate.accountId;
            data.accountLinkedAt = linkUpdate.accountLinkedAt;
        }
        if (data.investmentDate) {
            data.investmentDate = new Date(data.investmentDate);
        }
        // Partial updates must still recompute the BRL cost from the merged values
        this.applyUsStockInvestedAmount(data, existing);
        this.applyCryptoInvestedAmount(data, existing);

        const updated = await this.prisma.investment.update({
            where: { id },
            data,
            include: {
                account: { select: { id: true, name: true, currency: true } },
            },
        });
        if ((updated.type === 'VARIABLE_INCOME' || updated.type === 'FII') && updated.tickerCode) {
            await this.fetchB3Prices([updated.tickerCode]);
        } else if (updated.type === 'CRYPTO' && updated.tickerCode) {
            await this.fetchUsdRate();
            await this.fetchCryptoPrices([updated.tickerCode]);
        } else if (updated.type === 'US_STOCK' && updated.tickerCode) {
            await Promise.all([this.fetchUsPrices([updated.tickerCode]), this.fetchUsdRate()]);
        }
        await this.syncDividendsForInvestment(updated);
        return this.enrichInvestment(updated);
    }

    /**
     * For US stocks the BRL cost is derived: average price (USD) × quantity × dollar rate paid.
     */
    private applyUsStockInvestedAmount(data: any, existing?: Investment): void {
        const type = data.type ?? existing?.type;
        if (type !== 'US_STOCK') return;

        if (data.tickerCode) {
            data.tickerCode = String(data.tickerCode).trim().toUpperCase();
        }

        const avg = data.averagePrice ?? existing?.averagePrice;
        const qty = data.quantity ?? existing?.quantity;
        const rate = data.purchaseExchangeRate ?? existing?.purchaseExchangeRate;
        if (avg != null && qty != null && rate != null) {
            data.investedAmount = avg * qty * rate;
            if (data.currentValue == null || !existing) {
                data.currentValue = data.investedAmount;
            }
        }
    }

    /**
     * For Crypto: supports either BRL cost price (purchaseExchangeRate null/0)
     * or USD/Binance cost price (purchaseExchangeRate > 0).
     */
    private applyCryptoInvestedAmount(data: any, existing?: Investment): void {
        const type = data.type ?? existing?.type;
        if (type !== 'CRYPTO') return;

        if (data.tickerCode) {
            data.tickerCode = String(data.tickerCode).trim().toUpperCase();
        }

        const avg = data.averagePrice ?? existing?.averagePrice;
        const qty = data.quantity ?? existing?.quantity;
        const rawRate = data.purchaseExchangeRate !== undefined ? data.purchaseExchangeRate : existing?.purchaseExchangeRate;
        const rate = rawRate && rawRate > 0 ? rawRate : null;

        if (data.purchaseExchangeRate !== undefined && (!data.purchaseExchangeRate || data.purchaseExchangeRate <= 0)) {
            data.purchaseExchangeRate = null;
        }

        if (avg != null && qty != null) {
            data.investedAmount = rate ? avg * qty * rate : avg * qty;
            if (data.currentValue == null || !existing) {
                data.currentValue = data.investedAmount;
            }
        }
    }

    async remove(workspaceId: string, id: string) {
        await this.findOne(workspaceId, id); // Ensure exists in workspace
        return this.prisma.investment.delete({
            where: { id },
        });
    }

    /**
     * Fetches daily CDI rates from BCB API (série 12) with caching.
     * Returns rates as decimals (e.g. 0.055131% -> 0.00055131).
     */
    private async fetchCdiRates(startDate: Date, endDate: Date): Promise<CdiDayRate[]> {
        await this.ensureCdiRates(startDate, endDate);
        if (!this.isCdiCacheValidFor(startDate)) {
            return [];
        }
        return this.filterCdiRatesByRange(this.cdiCache, startDate, endDate);
    }

    private isCdiCacheValidFor(startDate: Date): boolean {
        return this.cdiCache.length > 0
            && Date.now() < this.cdiCacheExpiry
            && this.cdiCacheStart !== null
            && this.cdiCacheStart <= startDate;
    }

    /**
     * Makes sure the cache covers startDate..today. Concurrent callers share a single request,
     * and the cache is only ever widened, never narrowed to a later start date.
     */
    private async ensureCdiRates(startDate: Date, endDate: Date): Promise<void> {
        // Two passes: an in-flight request started by another caller may not reach back far enough
        for (let attempt = 0; attempt < 2; attempt++) {
            if (this.isCdiCacheValidFor(startDate)) return;

            if (!this.cdiFetchInFlight) {
                const fetchStart = new Date(startDate);
                fetchStart.setMonth(fetchStart.getMonth() - 1); // 1 month buffer before
                // Never narrow the range already covered by a previous fetch
                if (this.cdiCacheStart && this.cdiCacheStart < fetchStart) {
                    fetchStart.setTime(this.cdiCacheStart.getTime());
                }

                this.cdiFetchInFlight = this.loadCdiRates(fetchStart, endDate)
                    .finally(() => { this.cdiFetchInFlight = null; });
            }
            await this.cdiFetchInFlight;
        }
    }

    private async loadCdiRates(fetchStart: Date, endDate: Date): Promise<void> {
        const fmt = (d: Date): string => {
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const yyyy = d.getFullYear();
            return `${dd}/${mm}/${yyyy}`;
        };

        const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados?formato=json&dataInicial=${fmt(fetchStart)}&dataFinal=${fmt(endDate)}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`BCB API returned ${response.status}`);
            }

            const data: Array<{ data: string; valor: string }> = await response.json();

            this.cdiCache = data.map(item => ({
                date: item.data,
                rate: parseFloat(item.valor) / 100, // Convert from % to decimal
            }));
            this.cdiCacheStart = fetchStart;
            this.cdiCacheExpiry = Date.now() + this.CDI_CACHE_TTL_MS;

            this.logger.log(`Fetched ${this.cdiCache.length} CDI rates from BCB API (since ${fmt(fetchStart)})`);
        } catch (error) {
            this.logger.warn(`Failed to fetch CDI rates from BCB: ${error.message}. Using fallback.`);
        }
    }

    /**
     * Filters cached CDI rates to the given date range using YYYY-MM-DD comparison.
     * Compares calendar days in UTC to avoid timezone drift (e.g. UTC server vs UTC-3 Brazil)
     * and includes the investment date rate per Brazilian fixed income convention.
     */
    private filterCdiRatesByRange(rates: CdiDayRate[], startDate: Date, endDate: Date): CdiDayRate[] {
        return filterCdiRatesByRange(rates, startDate, endDate);
    }

    /**
     * Compounds daily CDI rates from BCB data.
     * M = P * ∏(1 + CDI_dia * cdiPercentage/100) for each business day
     */
    private compoundWithRealRates(investedAmount: number, cdiPercentage: number, rates: CdiDayRate[]): number {
        return compoundWithRealRates(investedAmount, cdiPercentage, rates);
    }

    /**
     * Calculates compound interest using real CDI rates from BCB,
     * with fallback to fixed rate if API is unavailable.
     */
    /**
     * Fetches current stock prices from brapi.dev (B3) with 20-min cache.
     */
    private async fetchB3Prices(tickers: string[]): Promise<void> {
        if (this.b3FetchInFlight) {
            await this.b3FetchInFlight;
        }

        const normalized = [...new Set(tickers.map(t => t.trim().toUpperCase()).filter(Boolean))];
        if (normalized.length === 0) return;

        let toFetch = normalized;
        // Check cache
        if (this.b3PriceCache.size > 0 && Date.now() < this.b3CacheExpiry) {
            // Only fetch tickers not in cache
            const missing = normalized.filter(t => !this.b3PriceCache.has(t));
            if (missing.length === 0) return;
            toFetch = missing;
        }

        this.b3FetchInFlight = (async () => {
            // 1. Primary: Yahoo Finance (<TICKER>.SA) — no key, no monthly quota, fetched in parallel
            const results = await Promise.allSettled(
                toFetch.map(async ticker => ({ ticker, price: await this.fetchB3PriceFromYahoo(ticker) })),
            );
            const missing: string[] = [];
            for (const [index, result] of results.entries()) {
                if (result.status === 'fulfilled' && result.value.price != null) {
                    this.b3PriceCache.set(result.value.ticker, result.value.price);
                } else {
                    missing.push(toFetch[index]);
                }
            }

            // 2. Fallback: brapi.dev only for tickers Yahoo could not resolve (saves the brapi quota)
            const token = process.env.BRAPI_TOKEN;
            if (missing.length > 0 && token) {
                await this.fetchB3PricesFromBrapi(missing, token);
            } else if (missing.length > 0) {
                this.logger.warn(`No B3 price for ${missing.join(', ')} (Yahoo failed and BRAPI_TOKEN is not set).`);
            }

            this.b3CacheExpiry = Date.now() + this.B3_CACHE_TTL_MS;
        })().finally(() => {
            this.b3FetchInFlight = null;
        });

        return this.b3FetchInFlight;
    }

    private async fetchB3PriceFromYahoo(ticker: string): Promise<number | null> {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(`${ticker}.SA`)}?interval=1d&range=1d`;
        try {
            const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (!response.ok) {
                this.logger.warn(`Yahoo Finance returned ${response.status} for ${ticker}.SA`);
                return null;
            }
            const data = await response.json();
            const meta = data?.chart?.result?.[0]?.meta;
            if (meta?.regularMarketPrice == null) return null;
            if (meta.currency && meta.currency !== 'BRL') return null;
            return Number(meta.regularMarketPrice);
        } catch (error) {
            this.logger.warn(`Failed to fetch Yahoo price for ${ticker}.SA: ${error.message}`);
            return null;
        }
    }

    private async fetchB3PricesFromBrapi(toFetch: string[], token: string): Promise<void> {
        {
            // The free tier of brapi.dev allows querying ONLY 1 asset per request and
            // rate-limits bursts, so tickers are fetched one at a time with a short pause.
            for (const [index, ticker] of toFetch.entries()) {
                if (index > 0) {
                    await this.sleep(this.BRAPI_REQUEST_INTERVAL_MS);
                }
                const url = `https://brapi.dev/api/quote/${ticker}?token=${token}`;
                try {
                    let response = await fetch(url);
                    if (response.status === 429) {
                        this.logger.warn(`brapi.dev rate limit for ${ticker}, retrying in ${this.BRAPI_RETRY_DELAY_MS}ms`);
                        await this.sleep(this.BRAPI_RETRY_DELAY_MS);
                        response = await fetch(url);
                    }
                    if (response.status === 401 || response.status === 403) {
                        this.logger.error(`Invalid or expired BRAPI_TOKEN for ticker ${ticker}.`);
                        continue;
                    }
                    if (!response.ok) {
                        this.logger.warn(`brapi.dev returned ${response.status} for ${ticker}`);
                        continue;
                    }

                    const data = await response.json();
                    this.logger.log(`Brapi response for ${ticker}: ${JSON.stringify(data).substring(0, 100)}...`);
                    if (data.results && Array.isArray(data.results)) {
                        for (const result of data.results) {
                            if (result.symbol && result.regularMarketPrice != null) {
                                this.logger.log(`Caching ${result.symbol.toUpperCase()} as ${result.regularMarketPrice}`);
                                this.b3PriceCache.set(result.symbol.toUpperCase(), result.regularMarketPrice);
                            } else {
                                this.logger.warn(`No regularMarketPrice for ${result.symbol}`);
                            }
                        }
                    }
                } catch (error) {
                    this.logger.warn(`Failed to fetch B3 price for ${ticker}: ${error.message}`);
                }
            }
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Fetches current cryptocurrency prices from Binance API (primary) and CoinGecko API (fallback) with 5-min cache.
     */
    private async fetchCryptoPrices(tickers: string[]): Promise<void> {
        const normalizedTickers = [...new Set(tickers.map(t => t.trim().toUpperCase()).filter(Boolean))];
        if (normalizedTickers.length === 0) return;

        // Check cache
        let missing = normalizedTickers;
        if (this.cryptoPriceCache.size > 0 && Date.now() < this.cryptoCacheExpiry) {
            missing = normalizedTickers.filter(t => !this.cryptoPriceCache.has(t));
            if (missing.length === 0) return;
        }

        // Ensure USD->BRL rate is resolved before converting Binance USD prices to BRL
        // (avoids race condition with parallel fetchUsdRate() on serverless cold starts)
        await this.fetchUsdRate();
        const usdRate = this.usdRate ?? 5.64;

        // 1. Try Binance first for exact Spot USDT prices (e.g. 1MBABYDOGEUSDT, 1000SATSUSDT, BNBUSDT, SOLUSDT)
        const remainingForCoinGecko: string[] = [];
        await Promise.allSettled(missing.map(async (ticker) => {
            if (ticker === 'USDT' || ticker === 'USDC') {
                this.cryptoPriceCache.set(ticker, { usd: 1, brl: usdRate });
                return;
            }
            // For MATIC, CoinGecko tracks the legacy MATIC price accurately while Binance migrated to POL
            if (ticker === 'MATIC') {
                remainingForCoinGecko.push(ticker);
                return;
            }
            const binanceSymbol = this.BINANCE_SYMBOL_MAP[ticker] || `${ticker}USDT`;
            try {
                const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(binanceSymbol)}`);
                if (res.ok) {
                    const data = await res.json();
                    const usdPrice = Number(data?.price);
                    if (usdPrice > 0) {
                        this.cryptoPriceCache.set(ticker, {
                            usd: usdPrice,
                            brl: usdPrice * usdRate,
                        });
                        return;
                    }
                }
            } catch {
                // fallback to CoinGecko
            }
            remainingForCoinGecko.push(ticker);
        }));

        // 2. Fallback to CoinGecko for any ticker not resolved via Binance
        if (remainingForCoinGecko.length > 0) {
            const idsToFetch = [...new Set(remainingForCoinGecko.map(ticker => {
                return this.COINGECKO_ID_MAP[ticker]?.id || ticker.toLowerCase();
            }))];
            const idsStr = idsToFetch.join(',');
            const url = `https://api.coingecko.com/api/v3/simple/price?ids=${idsStr}&vs_currencies=brl,usd`;

            try {
                const response = await fetch(url);
                if (response.ok) {
                    const data = await response.json();
                    for (const ticker of remainingForCoinGecko) {
                        const mapping = this.COINGECKO_ID_MAP[ticker];
                        const cgId = mapping?.id || ticker.toLowerCase();
                        const multiplier = mapping?.multiplier ?? 1;
                        const entry = data?.[cgId];
                        if (entry && (entry.brl != null || entry.usd != null)) {
                            const usd = entry.usd != null ? Number(entry.usd) * multiplier : (Number(entry.brl) * multiplier) / usdRate;
                            const brl = entry.brl != null ? Number(entry.brl) * multiplier : usd * usdRate;
                            this.cryptoPriceCache.set(ticker, { brl, usd });
                        }
                    }
                } else {
                    this.logger.warn(`CoinGecko returned ${response.status}`);
                }
            } catch (error) {
                this.logger.warn(`Failed to fetch Crypto prices from CoinGecko: ${error.message}`);
            }
        }

        this.cryptoCacheExpiry = Date.now() + this.CRYPTO_CACHE_TTL_MS;
        this.logger.log(`Fetched Crypto prices for: ${normalizedTickers.join(',')}`);
    }

    /**
     * Fetches US stock/ETF prices in USD. Yahoo Finance first (no key, no shared quota),
     * brapi.dev as fallback when a token is configured.
     */
    private async fetchUsPrices(tickers: string[]): Promise<void> {
        if (Date.now() < this.usCacheExpiry) {
            tickers = tickers.filter(t => !this.usPriceCache.has(t.toUpperCase()));
            if (tickers.length === 0) return;
        } else {
            this.usPriceCache.clear();
        }

        await Promise.allSettled(tickers.map(async (rawTicker) => {
            const ticker = rawTicker.toUpperCase();
            const price = await this.fetchUsPriceFromYahoo(ticker) ?? await this.fetchUsPriceFromBrapi(ticker);
            if (price != null) {
                this.usPriceCache.set(ticker, price);
            } else {
                this.logger.warn(`No US price available for ${ticker}`);
            }
        }));

        this.usCacheExpiry = Date.now() + this.US_CACHE_TTL_MS;
    }

    private async fetchUsPriceFromYahoo(ticker: string): Promise<number | null> {
        // Yahoo uses "-" for share classes (BRK.B -> BRK-B)
        const symbol = encodeURIComponent(ticker.replace('.', '-'));
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
        try {
            const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (!response.ok) {
                this.logger.warn(`Yahoo Finance returned ${response.status} for ${ticker}`);
                return null;
            }
            const data = await response.json();
            const meta = data?.chart?.result?.[0]?.meta;
            if (meta?.regularMarketPrice == null) return null;
            if (meta.currency && meta.currency !== 'USD') {
                this.logger.warn(`${ticker} is quoted in ${meta.currency}, expected USD`);
                return null;
            }
            return meta.regularMarketPrice;
        } catch (error) {
            this.logger.warn(`Failed to fetch Yahoo price for ${ticker}: ${error.message}`);
            return null;
        }
    }

    private async fetchUsPriceFromBrapi(ticker: string): Promise<number | null> {
        const token = process.env.BRAPI_TOKEN;
        if (!token) return null;
        try {
            const response = await fetch(`https://brapi.dev/api/quote/${encodeURIComponent(ticker)}?token=${token}`);
            if (!response.ok) return null;
            const data = await response.json();
            const result = data?.results?.[0];
            if (result?.regularMarketPrice == null || (result.currency && result.currency !== 'USD')) return null;
            return result.regularMarketPrice;
        } catch {
            return null;
        }
    }

    /**
     * Fetches the current USD -> BRL rate with multi-provider fallback and 5-min cache.
     * Providers in order: AwesomeAPI -> Yahoo Finance (USDBRL=X) -> open.er-api
     */
    private async fetchUsdRate(): Promise<void> {
        if (this.usdRate != null && Date.now() < this.usdRateExpiry) return;
        if (this.usdFetchInFlight) {
            await this.usdFetchInFlight;
            return;
        }

        this.usdFetchInFlight = (async () => {
            const result = await fetchUsdRateWithFallback();
            if (result != null && result.rate > 0) {
                this.usdRate = result.rate;
                this.usdRateExpiry = Date.now() + this.USD_RATE_TTL_MS;
                if (result.provider !== 'awesomeapi') {
                    this.logger.log(`Fetched USD rate from ${result.provider} fallback: ${result.rate}`);
                }
            } else {
                this.logger.warn('All USD rate providers failed. Keeping existing or fallback rate.');
            }
        })().finally(() => {
            this.usdFetchInFlight = null;
        });

        await this.usdFetchInFlight;
    }

    /**
     * Enriches an investment with calculated fields.
     * - FIXED_INCOME: CDI yield calculation
     * - VARIABLE_INCOME: live B3 price
     */
    private async enrichInvestment(inv: Investment): Promise<any> {
        // Variable income & FII: enrich with live B3 price
        if ((inv.type === 'VARIABLE_INCOME' || inv.type === 'FII') && inv.tickerCode) {
            const livePrice = this.b3PriceCache.get(inv.tickerCode.toUpperCase());
            if (livePrice != null) {
                return {
                    ...inv,
                    currentPrice: livePrice,
                    currentValue: livePrice * (inv.quantity ?? 0),
                };
            }
            return inv;
        }

        // Crypto: enrich with live Binance / CoinGecko price
        if (inv.type === 'CRYPTO' && inv.tickerCode) {
            const upperTicker = inv.tickerCode.trim().toUpperCase();
            const livePrice = this.cryptoPriceCache.get(upperTicker);
            const qty = inv.quantity ?? 0;
            const isUsdCost = inv.purchaseExchangeRate != null && inv.purchaseExchangeRate > 0;
            const currentRate = this.usdRate ?? inv.purchaseExchangeRate ?? 5.64;

            if (isUsdCost) {
                const avgUsd = inv.averagePrice ?? 0;
                const curUsd = livePrice?.usd ?? (inv.currentPrice ? inv.currentPrice / currentRate : avgUsd);
                const avgBrl = avgUsd * currentRate;
                const curBrl = livePrice?.brl ?? (curUsd * currentRate);
                const investedUsd = avgUsd * qty;
                const currentValueUsd = curUsd * qty;
                const investedBrl = avgBrl * qty;
                const currentValueBrl = curBrl * qty;

                return {
                    ...inv,
                    averagePrice: avgBrl,
                    currentPrice: curBrl,
                    averagePriceUsd: avgUsd,
                    currentPriceUsd: curUsd,
                    investedUsd,
                    currentValueUsd,
                    investedAmount: investedBrl,
                    currentValue: currentValueBrl,
                    currentExchangeRate: currentRate,
                };
            }

            if (livePrice != null) {
                return {
                    ...inv,
                    currentPrice: livePrice.brl,
                    currentPriceUsd: livePrice.usd,
                    currentValue: livePrice.brl * qty,
                    currentValueUsd: livePrice.usd * qty,
                    currentExchangeRate: currentRate,
                };
            }
            return inv;
        }

        // US stocks/ETFs: live USD price converted to BRL with the current dollar rate.
        // currentValue is BRL so dashboards that only sum currentValue stay correct.
        if (inv.type === 'US_STOCK') {
            const qty = inv.quantity ?? 0;
            const avgUsd = inv.averagePrice ?? 0;
            const purchaseRate = inv.purchaseExchangeRate ?? 0;
            const livePriceUsd = inv.tickerCode ? this.usPriceCache.get(inv.tickerCode.toUpperCase()) : undefined;
            const currentPriceUsd = livePriceUsd ?? inv.currentPrice ?? avgUsd;
            const currentRate = this.usdRate ?? purchaseRate;

            const investedUsd = avgUsd * qty;
            const currentValueUsd = currentPriceUsd * qty;
            const currentValueBrl = currentValueUsd * currentRate;

            return {
                ...inv,
                currentPrice: currentPriceUsd,
                currentExchangeRate: currentRate,
                investedUsd,
                currentValueUsd,
                currentValue: currentValueBrl,
                // Splits the BRL result into what came from the asset and what came from the dollar
                assetGainBrl: (currentPriceUsd - avgUsd) * qty * currentRate,
                fxGainBrl: investedUsd * (currentRate - purchaseRate),
                priceIsLive: livePriceUsd != null,
            };
        }

        // Fixed income: CDI simulation
        if (inv.type !== 'FIXED_INCOME' || !inv.investmentDate || !inv.cdiPercentage) {
            return inv;
        }

        const now = new Date();
        const startDate = new Date(inv.investmentDate);

        // Calendar days for IR tax bracket (per tax law)
        const msPerDay = 1000 * 60 * 60 * 24;
        const calendarDays = Math.floor((now.getTime() - startDate.getTime()) / msPerDay);

        if (calendarDays <= 0) {
            return {
                ...inv,
                daysInvested: 0,
                grossValue: inv.investedAmount,
                taxAmount: 0,
                netValue: inv.investedAmount,
                irTaxRate: 22.5
            };
        }

        // Fetch real CDI rates from BCB
        const cdiRates = await this.fetchCdiRates(startDate, now);

        let grossValue: number;
        let businessDays: number;

        if (cdiRates.length > 0) {
            grossValue = this.compoundWithRealRates(inv.investedAmount, inv.cdiPercentage, cdiRates);
            businessDays = cdiRates.length;
        } else {
            businessDays = countBusinessDays(startDate, now);
            const taxaDiariaAtivo = this.CDI_DIARIO_FALLBACK * (inv.cdiPercentage / 100);
            grossValue = inv.investedAmount * Math.pow(1 + taxaDiariaAtivo, businessDays);
        }

        // Truncate per-lot gross value to 2 decimal places (matching bank/B3 CDB convention)
        grossValue = Math.trunc((grossValue + 1e-9) * 100) / 100;

        const grossProfit = grossValue - inv.investedAmount;

        let irTaxRate = 0;
        if (calendarDays <= 180) {
            irTaxRate = 0.225;
        } else if (calendarDays <= 360) {
            irTaxRate = 0.20;
        } else if (calendarDays <= 720) {
            irTaxRate = 0.175;
        } else {
            irTaxRate = 0.15;
        }

        const taxAmount = grossProfit > 0 ? grossProfit * irTaxRate : 0;
        const netValue = grossValue - taxAmount;

        return {
            ...inv,
            daysInvested: businessDays,
            grossValue,
            taxAmount,
            netValue,
            irTaxRate: irTaxRate * 100
        };
    }

    private isDividendEligible(inv: Investment): boolean {
        return (
            (inv.type === 'VARIABLE_INCOME' || inv.type === 'FII' || inv.type === 'US_STOCK') &&
            Boolean(inv.tickerCode?.trim()) &&
            Number(inv.quantity) > 0
        );
    }

    async findAllDividends(workspaceId: string) {
        const investments = await this.prisma.investment.findMany({
            where: { workspaceId },
            include: {
                account: { select: { id: true, name: true, currency: true } },
            },
            orderBy: { investmentDate: 'asc' },
        });

        const eligible = investments.filter(i => this.isDividendEligible(i));
        let unsynced = eligible.filter(i => !this.syncedInvestmentIds.has(i.id));
        if (unsynced.length > 0) {
            // Serverless instances start with an empty in-memory cache, so use the DB
            // (rows are recreated on every sync) to skip investments synced recently.
            const lastSyncs = await this.prisma.investmentDividend.groupBy({
                by: ['investmentId'],
                where: { investmentId: { in: unsynced.map(i => i.id) } },
                _max: { createdAt: true },
            });
            const freshSince = Date.now() - this.DIVIDEND_DB_FRESH_MS;
            for (const row of lastSyncs) {
                if (row._max.createdAt && row._max.createdAt.getTime() >= freshSince) {
                    this.syncedInvestmentIds.add(row.investmentId);
                }
            }
            unsynced = unsynced.filter(i => !this.syncedInvestmentIds.has(i.id));
        }
        if (unsynced.length > 0) {
            await this.syncInvestmentsDividends(unsynced);
        }

        await this.settleMaturedPendingDividends(workspaceId);

        const dividends = await this.prisma.investmentDividend.findMany({
            where: { investment: { workspaceId } },
            include: {
                investment: {
                    select: {
                        id: true,
                        name: true,
                        type: true,
                        tickerCode: true,
                        sector: true,
                        investmentDate: true,
                        quantity: true,
                        investedAmount: true,
                        accountId: true,
                        account: { select: { id: true, name: true, currency: true } },
                    },
                },
            },
            orderBy: { date: 'asc' },
        });

        return {
            dividends,
            investments: eligible.map(inv => ({
                id: inv.id,
                name: inv.name,
                type: inv.type,
                tickerCode: inv.tickerCode,
                sector: inv.sector,
                investmentDate: inv.investmentDate,
                quantity: inv.quantity,
                investedAmount: inv.investedAmount,
                accountId: inv.accountId,
                account: inv.account,
            })),
        };
    }

    async syncAllDividends(workspaceId: string, force = false) {
        if (force) {
            this.dividendEventsCache.clear();
            this.syncedInvestmentIds.clear();
        }

        const investments = await this.prisma.investment.findMany({
            where: { workspaceId },
        });
        const eligible = investments.filter(i => this.isDividendEligible(i));
        await this.syncInvestmentsDividends(eligible);

        return this.findAllDividends(workspaceId);
    }

    private async syncInvestmentsDividends(list: Investment[]): Promise<void> {
        if (list.length === 0) return;
        if (list.some(i => i.type === 'US_STOCK')) {
            await this.fetchUsdRate();
        }
        // Limited concurrency: much faster than sequential without hammering Yahoo/DB
        const CONCURRENCY = 5;
        for (let i = 0; i < list.length; i += CONCURRENCY) {
            await Promise.allSettled(list.slice(i, i + CONCURRENCY).map(inv => this.syncDividendsForInvestment(inv)));
        }
    }

    async syncDividendsForInvestment(inv: Investment): Promise<void> {
        if (!this.isDividendEligible(inv)) {
            await this.prisma.investmentDividend.deleteMany({ where: { investmentId: inv.id } });
            return;
        }

        const ticker = inv.tickerCode!.trim().toUpperCase();
        if (inv.type === 'US_STOCK') {
            await this.fetchUsdRate();
        }

        const events = await this.fetchTickerDividendEvents(inv.type, ticker);
        const purchaseDate = inv.investmentDate ? new Date(inv.investmentDate) : new Date(inv.createdAt);
        const purchaseStart = new Date(Date.UTC(
            purchaseDate.getUTCFullYear(),
            purchaseDate.getUTCMonth(),
            purchaseDate.getUTCDate(),
            0, 0, 0,
        ));
        const now = new Date();
        const qty = Number(inv.quantity ?? 0);
        const isUs = inv.type === 'US_STOCK';
        const fxRate = isUs ? (this.usdRate ?? inv.purchaseExchangeRate ?? 5.6) : 1;

        const matchingRows = events
            .filter(ev => ev.date >= purchaseStart && ev.date <= now && ev.amountPerShare > 0)
            .map(ev => {
                const amountPerShare = Number(ev.amountPerShare.toFixed(6));
                const totalOriginal = Number((amountPerShare * qty).toFixed(2));
                const totalBrl = Number((totalOriginal * fxRate).toFixed(2));
                return {
                    investmentId: inv.id,
                    tickerCode: ticker,
                    date: ev.date,
                    paymentDate: estimateDividendPaymentDate(ev.date, inv.type, ticker),
                    amountPerShare,
                    quantity: qty,
                    totalOriginal,
                    currency: isUs ? 'USD' : 'BRL',
                    totalBrl,
                };
            });

        const existingRows = await this.prisma.investmentDividend.findMany({
            where: { investmentId: inv.id },
            select: {
                date: true,
                amountPerShare: true,
                creditedAccountId: true,
                creditedAt: true,
            },
        });
        const existingByKey = new Map<string, ExistingDividendCredit>(
            existingRows.map(r => [
                dividendKey(r.date, r.amountPerShare),
                { creditedAccountId: r.creditedAccountId, creditedAt: r.creditedAt },
            ]),
        );

        const linkedAccount = inv.accountId
            ? await this.prisma.account.findFirst({
                  where: { id: inv.accountId, workspaceId: inv.workspaceId },
                  select: { id: true, currency: true },
              })
            : null;

        const plan = planDividendCredits({
            rows: matchingRows,
            existingByKey,
            account: linkedAccount,
            accountLinkedAt: inv.accountLinkedAt ?? null,
            usdRate: this.usdRate ?? inv.purchaseExchangeRate ?? 5.6,
            now,
        });

        const dbRows = plan.rows.map(({ paymentDate: _paymentDate, ...row }) => row);

        await this.prisma.$transaction(async tx => {
            await tx.investmentDividend.deleteMany({ where: { investmentId: inv.id } });
            if (dbRows.length > 0) {
                await tx.investmentDividend.createMany({ data: dbRows, skipDuplicates: true });
            }
            if (linkedAccount && plan.newlyCreditedCount > 0 && (plan.brlDelta > 0 || plan.usdDelta > 0)) {
                await tx.account.update({
                    where: { id: linkedAccount.id },
                    data: {
                        ...(plan.brlDelta > 0 ? { balance: { increment: plan.brlDelta } } : {}),
                        ...(plan.usdDelta > 0 ? { balanceUsd: { increment: plan.usdDelta } } : {}),
                    },
                });
            }
        });

        this.syncedInvestmentIds.add(inv.id);
    }

    /**
     * Credits any previously stored uncredited dividends whose estimated payment date
     * falls between the investment's accountLinkedAt and today, without waiting for
     * the 12h external Yahoo Finance sync cache to expire.
     */
    private async settleMaturedPendingDividends(workspaceId: string): Promise<void> {
        const pendingRows = await this.prisma.investmentDividend.findMany({
            where: {
                creditedAt: null,
                totalOriginal: { gt: 0 },
                investment: {
                    workspaceId,
                    accountId: { not: null },
                    accountLinkedAt: { not: null },
                },
            },
            include: {
                investment: {
                    select: {
                        type: true,
                        accountId: true,
                        accountLinkedAt: true,
                        purchaseExchangeRate: true,
                        account: { select: { id: true, currency: true } },
                    },
                },
            },
        });

        if (pendingRows.length === 0) return;

        const now = new Date();
        const endToday = endOfUtcDay(now);

        const matured = pendingRows.filter(row => {
            const linkedAt = row.investment.accountLinkedAt;
            const account = row.investment.account;
            if (!linkedAt || !account) return false;
            const paymentDate = estimateDividendPaymentDate(row.date, row.investment.type, row.tickerCode);
            return paymentDate >= linkedAt && paymentDate <= endToday;
        });

        if (matured.length === 0) return;

        if (matured.some(r => r.currency === 'USD' || r.investment.account?.currency === 'USD')) {
            await this.fetchUsdRate();
        }

        await this.prisma.$transaction(async tx => {
            const deltasByAccount = new Map<string, { brlDelta: number; usdDelta: number }>();

            for (const row of matured) {
                const account = row.investment.account!;
                const updated = await tx.investmentDividend.updateMany({
                    where: { id: row.id, creditedAt: null },
                    data: { creditedAccountId: account.id, creditedAt: now },
                });
                if (updated.count !== 1) continue;

                const fxRate = this.usdRate ?? row.investment.purchaseExchangeRate ?? 5.6;
                const delta = calculateCreditDeltaForAccount(row, account.currency, fxRate);
                const prev = deltasByAccount.get(account.id) ?? { brlDelta: 0, usdDelta: 0 };
                prev.brlDelta = Number((prev.brlDelta + delta.brlDelta).toFixed(2));
                prev.usdDelta = Number((prev.usdDelta + delta.usdDelta).toFixed(2));
                deltasByAccount.set(account.id, prev);
            }

            for (const [accountId, delta] of deltasByAccount.entries()) {
                if (delta.brlDelta <= 0 && delta.usdDelta <= 0) continue;
                await tx.account.update({
                    where: { id: accountId },
                    data: {
                        ...(delta.brlDelta > 0 ? { balance: { increment: delta.brlDelta } } : {}),
                        ...(delta.usdDelta > 0 ? { balanceUsd: { increment: delta.usdDelta } } : {}),
                    },
                });
            }
        });
    }

    private async ensureAccountInWorkspace(workspaceId: string, accountId: string | null): Promise<void> {
        if (!accountId) return;
        const account = await this.prisma.account.findFirst({
            where: { id: accountId, workspaceId },
            select: { id: true },
        });
        if (!account) {
            throw new BadRequestException(`Account ${accountId} not found in this workspace`);
        }
    }

    private async fetchTickerDividendEvents(
        type: Investment['type'],
        ticker: string,
    ): Promise<Array<{ date: Date; amountPerShare: number }>> {
        const cacheKey = `${type}:${ticker}`;
        const cached = this.dividendEventsCache.get(cacheKey);
        if (cached && Date.now() - cached.fetchedAt < this.DIVIDEND_CACHE_TTL_MS) {
            return cached.events;
        }

        const yahooSymbol = type === 'US_STOCK'
            ? encodeURIComponent(ticker.replace('.', '-'))
            : encodeURIComponent(`${ticker}.SA`);

        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=10y&events=div`;

        try {
            const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (response.ok) {
                const data = await response.json();
                const rawDividends = data?.chart?.result?.[0]?.events?.dividends;
                if (rawDividends && typeof rawDividends === 'object') {
                    const events = Object.values(rawDividends as Record<string, { amount?: number; date?: number }>)
                        .filter(d => typeof d?.amount === 'number' && d.amount > 0 && typeof d?.date === 'number')
                        .map(d => ({
                            date: new Date(d.date! * 1000),
                            amountPerShare: Number(d.amount),
                        }))
                        .sort((a, b) => a.date.getTime() - b.date.getTime());

                    this.dividendEventsCache.set(cacheKey, { fetchedAt: Date.now(), events });
                    return events;
                }
            }
        } catch (error: any) {
            this.logger.warn(`Failed to fetch Yahoo dividends for ${ticker}: ${error?.message}`);
        }

        this.dividendEventsCache.set(cacheKey, { fetchedAt: Date.now(), events: [] });
        return [];
    }

    async getProjections(
        workspaceId: string,
        month?: number,
        year?: number,
        monthsCount = 12,
        today = new Date(),
        preloadedInvestments?: any[],
    ): Promise<InvestmentsProjectionResult> {
        const startMonth = month && month >= 1 && month <= 12 ? month : today.getMonth() + 1;
        const startYear = year && year >= 2000 ? year : today.getFullYear();

        const [investments, dividendsPayload] = await Promise.all([
            preloadedInvestments ? Promise.resolve(preloadedInvestments) : this.findAll(workspaceId),
            this.findAllDividends(workspaceId),
        ]);

        const latestCdiRate = this.cdiCache.length > 0
            ? this.cdiCache[this.cdiCache.length - 1].rate
            : this.CDI_DIARIO_FALLBACK;

        return calculateInvestmentsProjection({
            investments,
            dividends: dividendsPayload.dividends as any,
            startMonth,
            startYear,
            monthsCount,
            today,
            cdiDailyRate: latestCdiRate,
        });
    }
}
