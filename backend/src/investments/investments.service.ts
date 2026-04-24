import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { CreateInvestmentDto } from './dto/create-investment.dto';
import { UpdateInvestmentDto } from './dto/update-investment.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Investment } from '@prisma/client';
import { countBusinessDays } from './business-days.util';

interface CdiDayRate {
    date: string;   // "DD/MM/YYYY"
    rate: number;    // daily rate as decimal (e.g. 0.00055131)
}

@Injectable()
export class InvestmentsService {
    private readonly logger = new Logger(InvestmentsService.name);

    // In-memory cache for CDI rates
    private cdiCache: CdiDayRate[] = [];
    private cdiCacheExpiry: number = 0;
    private readonly CDI_CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

    // In-memory cache for B3 stock prices
    private b3PriceCache: Map<string, number> = new Map();
    private b3CacheExpiry: number = 0;
    private readonly B3_CACHE_TTL_MS = 1000 * 60 * 20; // 20 minutes

    // In-memory cache for Crypto prices (CoinGecko)
    private cryptoPriceCache: Map<string, number> = new Map();
    private cryptoCacheExpiry: number = 0;
    private readonly CRYPTO_CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes

    // Map common crypto symbols to CoinGecko IDs
    private readonly COINGECKO_ID_MAP: Record<string, string> = {
        'BTC': 'bitcoin',
        'ETH': 'ethereum',
        'USDT': 'tether',
        'BNB': 'binancecoin',
        'SOL': 'solana',
        'XRP': 'ripple',
        'USDC': 'usd-coin',
        'ADA': 'cardano',
        'AVAX': 'avalanche-2',
        'DOGE': 'dogecoin',
        'DOT': 'polkadot',
        'MATIC': 'matic-network',
        'WBTC': 'wrapped-bitcoin',
        'SHIB': 'shiba-inu',
        'LTC': 'litecoin',
        'LINK': 'chainlink',
        'BCH': 'bitcoin-cash',
    };

    // Fallback: fixed CDI for when BCB API is unavailable
    private readonly CDI_ANUAL_FALLBACK = 0.149;
    private readonly DIAS_UTEIS_ANO = 252;
    private readonly CDI_DIARIO_FALLBACK = Math.pow(1 + this.CDI_ANUAL_FALLBACK, 1 / this.DIAS_UTEIS_ANO) - 1;

    constructor(private prisma: PrismaService) { }

    async create(createInvestmentDto: CreateInvestmentDto) {
        const data: any = { ...createInvestmentDto };
        if (!data.currentValue) {
            data.currentValue = data.investedAmount;
        }
        // Handle date string to Date object
        if (data.investmentDate) {
            data.investmentDate = new Date(data.investmentDate);
        } else {
            data.investmentDate = new Date(); // default to today if missing
        }
        return this.prisma.investment.create({
            data,
        });
    }

    async findAll() {
        const investments = await this.prisma.investment.findMany({
            orderBy: { createdAt: 'desc' },
        });

        // Fetch live B3 prices for variable income investments
        const variableInvs = investments.filter(i => i.type === 'VARIABLE_INCOME' && i.tickerCode);
        if (variableInvs.length > 0) {
            const tickers = [...new Set(variableInvs.map(i => i.tickerCode!).filter(Boolean))];
            await this.fetchB3Prices(tickers);
        }

        // Fetch live Crypto prices
        const cryptoInvs = investments.filter(i => i.type === 'CRYPTO' && i.tickerCode);
        if (cryptoInvs.length > 0) {
            const tickers = [...new Set(cryptoInvs.map(i => i.tickerCode!).filter(Boolean))];
            await this.fetchCryptoPrices(tickers);
        }

        return Promise.all(investments.map(inv => this.enrichInvestment(inv)));
    }

    async findOne(id: string) {
        const investment = await this.prisma.investment.findUnique({
            where: { id },
        });
        if (!investment) {
            throw new NotFoundException(`Investment with ID ${id} not found`);
        }
        if (investment.type === 'VARIABLE_INCOME' && investment.tickerCode) {
            await this.fetchB3Prices([investment.tickerCode]);
        } else if (investment.type === 'CRYPTO' && investment.tickerCode) {
            await this.fetchCryptoPrices([investment.tickerCode]);
        }
        return this.enrichInvestment(investment);
    }

    async update(id: string, updateInvestmentDto: UpdateInvestmentDto) {
        await this.findOne(id); // Ensure exists

        const data: any = { ...updateInvestmentDto };
        if (data.investmentDate) {
            data.investmentDate = new Date(data.investmentDate);
        }

        const updated = await this.prisma.investment.update({
            where: { id },
            data,
        });
        if (updated.type === 'VARIABLE_INCOME' && updated.tickerCode) {
            await this.fetchB3Prices([updated.tickerCode]);
        } else if (updated.type === 'CRYPTO' && updated.tickerCode) {
            await this.fetchCryptoPrices([updated.tickerCode]);
        }
        return this.enrichInvestment(updated);
    }

    async remove(id: string) {
        await this.findOne(id); // Ensure exists
        return this.prisma.investment.delete({
            where: { id },
        });
    }

    /**
     * Fetches daily CDI rates from BCB API (série 12) with caching.
     * Returns rates as decimals (e.g. 0.055131% -> 0.00055131).
     */
    private async fetchCdiRates(startDate: Date, endDate: Date): Promise<CdiDayRate[]> {
        // Check cache
        if (this.cdiCache.length > 0 && Date.now() < this.cdiCacheExpiry) {
            return this.filterCdiRatesByRange(this.cdiCache, startDate, endDate);
        }

        const fmt = (d: Date): string => {
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const yyyy = d.getFullYear();
            return `${dd}/${mm}/${yyyy}`;
        };

        // Fetch from the earliest possible investment date (we fetch a wide range to cache)
        const fetchStart = new Date(startDate);
        fetchStart.setMonth(fetchStart.getMonth() - 1); // 1 month buffer before

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
            this.cdiCacheExpiry = Date.now() + this.CDI_CACHE_TTL_MS;

            this.logger.log(`Fetched ${this.cdiCache.length} CDI rates from BCB API`);
            return this.filterCdiRatesByRange(this.cdiCache, startDate, endDate);
        } catch (error) {
            this.logger.warn(`Failed to fetch CDI rates from BCB: ${error.message}. Using fallback.`);
            return [];
        }
    }

    /**
     * Filters cached CDI rates to the given date range.
     */
    private filterCdiRatesByRange(rates: CdiDayRate[], startDate: Date, endDate: Date): CdiDayRate[] {
        const parseDate = (dateStr: string): Date => {
            const [dd, mm, yyyy] = dateStr.split('/');
            return new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
        };

        return rates.filter(r => {
            const d = parseDate(r.date);
            return d > startDate && d <= endDate;
        });
    }

    /**
     * Compounds daily CDI rates from BCB data.
     * M = P * ∏(1 + CDI_dia * cdiPercentage/100) for each business day
     */
    private compoundWithRealRates(investedAmount: number, cdiPercentage: number, rates: CdiDayRate[]): number {
        let accumulated = 1;
        const factor = cdiPercentage / 100;
        for (const r of rates) {
            accumulated *= (1 + r.rate * factor);
        }
        return investedAmount * accumulated;
    }

    /**
     * Calculates compound interest using real CDI rates from BCB,
     * with fallback to fixed rate if API is unavailable.
     */
    /**
     * Fetches current stock prices from brapi.dev (B3) with 15-min cache.
     */
    private async fetchB3Prices(tickers: string[]): Promise<void> {
        // Check cache
        if (this.b3PriceCache.size > 0 && Date.now() < this.b3CacheExpiry) {
            // Only fetch tickers not in cache
            const missing = tickers.filter(t => !this.b3PriceCache.has(t.toUpperCase()));
            if (missing.length === 0) return;
            tickers = missing;
        }

        const token = process.env.BRAPI_TOKEN;
        if (!token) {
            this.logger.warn(`BRAPI_TOKEN is not set in .env. Automatic price updates for ${tickers.length} tickers will be skipped.`);
            return;
        }

        // The free tier of brapi.dev allows querying ONLY 1 asset per request.
        // Therefore, we must fetch them individually.
        await Promise.allSettled(tickers.map(async (ticker) => {
            const url = `https://brapi.dev/api/quote/${ticker}?token=${token}`;
            try {
                const response = await fetch(url);
                if (response.status === 401 || response.status === 403) {
                    this.logger.error(`Invalid or expired BRAPI_TOKEN for ticker ${ticker}.`);
                    return;
                }
                if (!response.ok) {
                    this.logger.warn(`brapi.dev returned ${response.status} for ${ticker}`);
                    return;
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
        }));

        this.b3CacheExpiry = Date.now() + this.B3_CACHE_TTL_MS;
    }

    /**
     * Fetches current cryptocurrency prices from CoinGecko API with 5-min cache.
     */
    private async fetchCryptoPrices(tickers: string[]): Promise<void> {
        // Map tickers to CoinGecko IDs
        const idsToFetch = [...new Set(tickers.map(ticker => {
            const upperTicker = ticker.toUpperCase();
            return this.COINGECKO_ID_MAP[upperTicker] || ticker.toLowerCase();
        }))];

        // Check cache
        if (this.cryptoPriceCache.size > 0 && Date.now() < this.cryptoCacheExpiry) {
            const missing = idsToFetch.filter(id => !this.cryptoPriceCache.has(id));
            if (missing.length === 0) return;
        }

        // CoinGecko allows multiple IDs comma-separated
        const idsStr = idsToFetch.join(',');
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${idsStr}&vs_currencies=brl`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                this.logger.warn(`CoinGecko returned ${response.status}`);
                return;
            }

            const data = await response.json();

            // data format: { "bitcoin": { "brl": 300000 }, "ethereum": { "brl": 15000 } }
            for (const id in data) {
                if (data[id] && data[id].brl != null) {
                    this.cryptoPriceCache.set(id, data[id].brl);
                }
            }

            this.cryptoCacheExpiry = Date.now() + this.CRYPTO_CACHE_TTL_MS;
            this.logger.log(`Fetched Crypto prices for: ${idsStr}`);
        } catch (error) {
            this.logger.warn(`Failed to fetch Crypto prices: ${error.message}`);
        }
    }

    /**
     * Enriches an investment with calculated fields.
     * - FIXED_INCOME: CDI yield calculation
     * - VARIABLE_INCOME: live B3 price
     */
    private async enrichInvestment(inv: Investment): Promise<any> {
        // Variable income: enrich with live B3 price
        if (inv.type === 'VARIABLE_INCOME' && inv.tickerCode) {
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

        // Crypto: enrich with live CoinGecko price
        if (inv.type === 'CRYPTO' && inv.tickerCode) {
            const upperTicker = inv.tickerCode.toUpperCase();
            const cgId = this.COINGECKO_ID_MAP[upperTicker] || inv.tickerCode.toLowerCase();
            const livePrice = this.cryptoPriceCache.get(cgId);

            if (livePrice != null) {
                return {
                    ...inv,
                    currentPrice: livePrice,
                    currentValue: livePrice * (inv.quantity ?? 0),
                };
            }
            return inv;
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
}
