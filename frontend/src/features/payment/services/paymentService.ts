// Payment-related API operations
import { api } from "@/shared/lib/axios";
import type { ApiResponse, PaymentItem, DuesPaymentResponse } from "@/shared/types";

export const paymentService = {
  /** Get all payment transactions (LEADER/ADMIN/TREASURER) */
  getAll: async (): Promise<PaymentItem[]> => {
    const response = await api.get<ApiResponse<PaymentItem[]>>("/payment/all-transactions");
    return response.data.data;
  },

  /** Get payment history for self */
  getHistory: async (): Promise<PaymentItem[]> => {
    const response = await api.get<ApiResponse<PaymentItem[]>>("/payment/history");
    return response.data.data;
  },

  /** Pay monthly dues (creates Midtrans Snap transaction) */
  payDues: async (months: number = 1): Promise<DuesPaymentResponse> => {
    const response = await api.post<ApiResponse<DuesPaymentResponse>>("/payment/pay-dues", { months });
    return response.data.data;
  },

  /** Get payment status by orderId */
  getPaymentStatus: async (orderId: string): Promise<{ dbStatus: PaymentItem; midtransStatus: unknown }> => {
    const response = await api.get<ApiResponse<{ dbStatus: PaymentItem; midtransStatus: unknown }>>(`/payment/status/${orderId}`);
    return response.data.data;
  },

  /** Cancel a pending payment */
  cancelPayment: async (orderId: string): Promise<void> => {
    await api.post(`/payment/cancel/${orderId}`);
  },

  /** Process refund (ADMIN/TREASURER/LEADER) */
  processRefund: async (refundId: string): Promise<void> => {
    await api.post(`/payment/refund/${refundId}/process`);
  },

  /** Manually sync payment status from Midtrans (fallback when webhook not received) */
  syncPayment: async (orderId: string): Promise<{ message: string; status: string; updated: boolean; midtransStatus?: string }> => {
    const response = await api.post<ApiResponse<{ message: string; status: string; updated: boolean; midtransStatus?: string }>>(`/payment/sync/${orderId}`);
    return response.data.data;
  },
};
