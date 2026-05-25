// Finance and wallet-related API operations
import { api } from "@/shared/lib/axios";
import type { ApiResponse, TransparencyBalance, MyBill, WalletDetail, Transaction, DuesConfig, DuesRule, ChildrenWalletsData, GroupFinanceDetail, TransactionDetail, DuesProgressData } from "@/shared/types";

let myBillInFlight: Promise<MyBill> | null = null;

export const financeService = {
  /** Get RT & RW wallet balance (transparency endpoint) */
  getTransparencyBalance: async (): Promise<TransparencyBalance> => {
    const response = await api.get<ApiResponse<TransparencyBalance>>(
      "/finance/transparency/balance"
    );
    return response.data.data;
  },

  /** Get transparency transaction history */
  getTransparencyHistory: async (scope?: "RT" | "RW"): Promise<Transaction[]> => {
    const response = await api.get<ApiResponse<Transaction[]>>("/finance/transparency/history", {
      params: scope ? { scope } : {},
    });
    return response.data.data;
  },

  /** Get personal bill for logged-in resident */
  getMyBill: async (): Promise<MyBill> => {
    if (myBillInFlight) return myBillInFlight;

    myBillInFlight = api
      .get<ApiResponse<MyBill>>("/finance/dues/my-bill")
      .then((response) => response.data.data)
      .finally(() => {
        myBillInFlight = null;
      });

    return myBillInFlight;
  },

  /** Get wallet details (LEADER/TREASURER/ADMIN) */
  getWalletDetails: async (): Promise<WalletDetail> => {
    const response = await api.get<ApiResponse<WalletDetail>>("/finance/wallet");
    return response.data.data;
  },

  /** Get transaction history */
  getTransactions: async (): Promise<Transaction[]> => {
    const response = await api.get<ApiResponse<Transaction[]>>("/finance/transactions");
    return response.data.data;
  },

  /** Create manual transaction */
  createTransaction: async (data: { amount: number; type: string; description: string }): Promise<Transaction> => {
    const response = await api.post<ApiResponse<Transaction>>("/finance/transactions", data);
    return response.data.data;
  },

  /** Get dues configuration for current group + children */
  getDuesConfig: async (): Promise<DuesConfig> => {
    const response = await api.get<ApiResponse<DuesConfig>>("/finance/dues/config");
    return response.data.data;
  },

  /** Set dues amount and due day for current group */
  setDuesConfig: async (data: { amount: number; dueDay: number }): Promise<DuesRule> => {
    const response = await api.post<ApiResponse<DuesRule>>("/finance/dues/config", data);
    return response.data.data;
  },

  /** Get all RT children wallets (for LEADER/ADMIN) */
  getChildrenWallets: async (): Promise<ChildrenWalletsData> => {
    const response = await api.get<ApiResponse<ChildrenWalletsData>>("/finance/children-wallets");
    return response.data.data;
  },

  /** Get finance detail for a specific group */
  getGroupFinanceDetail: async (groupId: number): Promise<GroupFinanceDetail> => {
    const response = await api.get<ApiResponse<GroupFinanceDetail>>(`/finance/groups/${groupId}/detail`);
    return response.data.data;
  },

  /** Get single transaction detail */
  getTransactionDetail: async (id: string): Promise<TransactionDetail> => {
    const response = await api.get<ApiResponse<TransactionDetail>>(`/finance/transactions/${id}`);
    return response.data.data;
  },

  /** Get dues payment progress for a specific group */
  getDuesProgress: async (groupId: number, year?: number): Promise<DuesProgressData> => {
    const response = await api.get<ApiResponse<DuesProgressData>>(`/finance/groups/${groupId}/dues-progress`, {
      params: year ? { year } : {},
    });
    return response.data.data;
  },

  // 👇 TAMBAHKAN FUNGSI INI 👇
  /** Get collective dues progress for a parent group (e.g., RW viewing RTs) */
  getParentDuesProgress: async (groupId: number, year?: number): Promise<any> => {
    const response = await api.get<ApiResponse<any>>(`/finance/groups/${groupId}/parent-dues-progress`, {
      params: year ? { year } : {},
    });
    return response.data.data;
  },
};
