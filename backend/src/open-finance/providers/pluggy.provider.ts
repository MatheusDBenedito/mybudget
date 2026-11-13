import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PluggyClient } from 'pluggy-sdk';
import type { ExternalTransaction } from '../helpers/open-finance-sync.helper';
import type {
    ExternalAccountInfo,
    ExternalItemInfo,
    OpenFinanceProvider,
} from './open-finance.provider';

@Injectable()
export class PluggyProvider implements OpenFinanceProvider {
    readonly name = 'PLUGGY' as const;
    private client: PluggyClient | null = null;

    isConfigured(): boolean {
        return Boolean(process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET);
    }

    isSandbox(): boolean {
        return process.env.PLUGGY_SANDBOX !== 'false';
    }

    private getClient(): PluggyClient {
        if (!this.isConfigured()) {
            throw new ServiceUnavailableException(
                'Pluggy não configurada. Defina PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET no .env do backend.',
            );
        }
        if (!this.client) {
            this.client = new PluggyClient({
                clientId: process.env.PLUGGY_CLIENT_ID!,
                clientSecret: process.env.PLUGGY_CLIENT_SECRET!,
            });
        }
        return this.client;
    }

    async createConnectToken(itemId?: string, clientUserId?: string): Promise<string> {
        const client = this.getClient();
        const result = await client.createConnectToken(itemId, {
            ...(clientUserId ? { clientUserId } : {}),
        });
        return result.accessToken;
    }

    async fetchItem(itemId: string): Promise<ExternalItemInfo> {
        const client = this.getClient();
        const item = await client.fetchItem(itemId);
        return {
            id: item.id,
            institutionName: item.connector?.name ?? 'Instituição Open Finance',
            status: item.status ?? 'UPDATED',
            consentExpiresAt: item.consentExpiresAt ? new Date(item.consentExpiresAt) : null,
        };
    }

    async fetchAccounts(itemId: string): Promise<ExternalAccountInfo[]> {
        const client = this.getClient();
        const res = await client.fetchAccounts(itemId);
        return (res.results ?? []).map((acc) => ({
            id: acc.id,
            name: acc.name || acc.marketingName || 'Conta Open Finance',
            type: acc.type === 'CREDIT' ? 'CREDIT' : 'BANK',
            subtype: acc.subtype ?? null,
        }));
    }

    async fetchTransactions(externalAccountId: string, fromDate?: string): Promise<ExternalTransaction[]> {
        const client = this.getClient();
        const res = await client.fetchTransactions(externalAccountId, {
            ...(fromDate ? { from: fromDate } : {}),
            pageSize: 100,
        });
        return (res.results ?? []).map((tx) => ({
            id: tx.id,
            description: tx.description || tx.descriptionRaw || 'Lançamento Open Finance',
            amount: Number(tx.amount),
            date: tx.date,
            type: tx.type === 'CREDIT' ? 'CREDIT' : 'DEBIT',
            creditCardMetadata: tx.creditCardMetadata
                ? {
                      installmentNumber: tx.creditCardMetadata.installmentNumber,
                      totalInstallments: tx.creditCardMetadata.totalInstallments,
                      billForecastDate: tx.creditCardMetadata.billForecastDate,
                      billPostDate: tx.creditCardMetadata.billPostDate,
                      cardNumber: tx.creditCardMetadata.cardNumber,
                      purchaseDate: tx.creditCardMetadata.purchaseDate,
                      otherCreditsType: tx.creditCardMetadata.otherCreditsType,
                  }
                : null,
        }));
    }
}

