import type { ExternalTransaction } from '../helpers/open-finance-sync.helper';

export interface ExternalItemInfo {
    id: string;
    institutionName: string;
    status: string;
    consentExpiresAt: Date | null;
}

export interface ExternalAccountInfo {
    id: string;
    name: string;
    type: 'BANK' | 'CREDIT';
    subtype: string | null;
}

export interface OpenFinanceProvider {
    readonly name: 'PLUGGY';
    isConfigured(): boolean;
    isSandbox(): boolean;
    createConnectToken(itemId?: string, clientUserId?: string): Promise<string>;
    fetchItem(itemId: string): Promise<ExternalItemInfo>;
    fetchAccounts(itemId: string): Promise<ExternalAccountInfo[]>;
    fetchTransactions(externalAccountId: string, fromDate?: string): Promise<ExternalTransaction[]>;
}

