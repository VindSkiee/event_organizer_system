import { useMemo } from "react";
import { DataTable, type ColumnDef } from "@/shared/components/DataTable";
import { Badge } from "@/shared/ui/badge";
import { ArrowDownLeft, ArrowUpRight, CreditCard } from "lucide-react";
import { formatRupiah, formatDateTime } from "@/shared/helpers/formatters";
import type { Transaction } from "@/shared/types";

function isIncome(tx: Transaction) {
  return tx.type === "INCOME" || tx.type === "CREDIT";
}

function getMethodLabel(method?: string): string {
  const labels: Record<string, string> = {
    VIRTUAL_ACCOUNT: "VA",
    E_WALLET: "E-Wallet",
    CREDIT_CARD: "CC",
    CONVENIENCE_STORE: "Minimarket",
    QRIS: "QRIS",
    MANUAL_TRANSFER: "Manual",
  };
  return labels[method || ""] || method || "";
}

function getPaymentStatusConfig(status?: string) {
  switch (status) {
    case "PAID":
      return { label: "Lunas", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "PENDING":
      return { label: "Pending", className: "bg-yellow-50 text-yellow-700 border-yellow-200" };
    case "FAILED":
      return { label: "Gagal", className: "bg-red-50 text-red-700 border-red-200" };
    case "EXPIRED":
      return { label: "Expired", className: "bg-slate-50 text-slate-500 border-slate-200" };
    case "CANCELLED":
      return { label: "Batal", className: "bg-slate-50 text-slate-500 border-slate-200" };
    default:
      return null;
  }
}

interface TransactionTableProps {
  transactions: Transaction[];
  onRowClick?: (tx: Transaction) => void;
  /** Timestamp (ms). Rows with createdAt > this value get a "Baru" dot. Pass null/undefined to disable. */
  newSinceMs?: number | null;
}

export function TransactionTable({ transactions, onRowClick, newSinceMs }: TransactionTableProps) {
  const columns = useMemo((): ColumnDef<Transaction>[] => [
    {
      key: "description",
      header: "Deskripsi",
      render: (tx) => {
        const isNew = newSinceMs != null && new Date(tx.createdAt).getTime() > newSinceMs;
        return (
          <div className="flex items-center gap-2">
            <div className="relative shrink-0">
              <div
                className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                  isIncome(tx) ? "bg-emerald-100" : "bg-red-100"
                }`}
              >
                {isIncome(tx) ? (
                  <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                ) : (
                  <ArrowUpRight className="h-4 w-4 text-red-600" />
                )}
              </div>
              {isNew && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500 ring-2 ring-white"></span>
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-slate-900 truncate">{tx.description}</p>
                {isNew && (
                  <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-600 border border-sky-200 uppercase tracking-wide">
                    Baru
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <p className="text-xs text-slate-500">
                  {tx.createdBy?.fullName || "Sistem"}
                </p>
                {tx.paymentGatewayTx && (
                  <>
                    <span className="text-slate-300">&bull;</span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <CreditCard className="h-3 w-3" />
                      {getMethodLabel(tx.paymentGatewayTx.methodCategory)}
                      {tx.paymentGatewayTx.providerCode && (
                        <span className="uppercase">{tx.paymentGatewayTx.providerCode}</span>
                      )}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: "type",
      header: "Tipe",
      render: (tx) => {
        const paymentStatus = tx.paymentGatewayTx ? getPaymentStatusConfig(tx.paymentGatewayTx.status) : null;
        return (
          <div className="flex flex-col gap-1 items-center">
            <Badge
              variant={isIncome(tx) ? "default" : "destructive"}
              className="text-[10px] w-fit"
            >
              {isIncome(tx) ? "Masuk" : "Keluar"}
            </Badge>
            {paymentStatus && (
              <Badge variant="outline" className={`text-[9px] w-fit ${paymentStatus.className}`}>
                {paymentStatus.label}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      key: "amount",
      header: "Jumlah",
      render: (tx) => (
        <span
          className={`font-medium ${
            isIncome(tx) ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {isIncome(tx) ? "+" : "-"}
          {formatRupiah(Math.abs(tx.amount))}
        </span>
      ),
    },
    {
      key: "date",
      header: "Tanggal",
      render: (tx) => (
        <div>
          <span className="text-sm text-slate-500">{formatDateTime(tx.createdAt)}</span>
            <p className="text-[10px] text-slate-400 mt-0.5 font-mono truncate max-w-[140px]">
            </p>
        </div>
      ),
    },
  ], [newSinceMs]);

  return (
    <DataTable
      columns={columns}
      data={transactions}
      keyExtractor={(tx) => tx.id}
      showRowNumber
      rowNumberPadded
      onRowClick={onRowClick}
    />
  );
}
