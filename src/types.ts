export interface Profile {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    status: string;
    type: string;
    walletAddress?: string;
    walletAccountType?: string;
}

export interface Wallet {
    id: string;
    network: string;
    walletAddress: string;
    walletType: string;
    isDefault: boolean;
    createdAt: string;
    balances: Array<{
        balance: string;
        symbol: string;
    }>;
}

export interface Transfer {
    id: string;
    type: string;
    status: string;
    amount: number;
    currency: string;
    totalFee: number;
    feeCurrency: string;
    createdAt: string;
    sourceCountry?: string;
    destinationCountry?: string;
    sourceAccount?: {
        walletAddress: string;
    };
    destinationAccount?: {
        walletAddress: string;
    };
    paymentUrl?: string;
}

export interface Withdrawal extends Transfer {
    mode: string;
    purposeCode: string;
    sourceOfFunds: string;
    recipientRelationship: string;
    invoiceUrl?: string;
}

export interface ApiResponse<T> {
    data: T;
    count?: number;
    hasMore?: boolean;
}

export interface BatchResponse {
    responses: Array<{
        requestId: string;
        response?: Transfer;
        error?: {
            message: string;
        };
    }>;
} 