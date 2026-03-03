import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { ArrowDownLeft, ArrowUpRight, ArrowRight, Wallet, ReceiptText } from "lucide-react";
import type { Transaction } from "@/shared/types";
import { useMemo } from "react";

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface RecentTransactionsProps {
  /** All transactions — component will filter to walletId */
  transactions: Transaction[];
  /** The wallet id belonging to the current user's group */
  walletId: number | null;
  loading: boolean;
  /** Link for "View All" button, e.g. "/dashboard/kas-bendahara" */
  viewAllLink: string;
  /** Max items to show, default 5 */
  limit?: number;
}

export function RecentTransactions({
  transactions,
  walletId,
  loading,
  viewAllLink,
  limit = 5,
}: RecentTransactionsProps) {
  // Filter to only show transactions from the user's own wallet/group
  const filtered = useMemo(() => {
  return walletId
    ? transactions.filter(tx => tx.walletId === walletId)
    : transactions;
}, [transactions, walletId]);
  const items = useMemo(() => filtered.slice(0, limit), [filtered, limit]);

  return (
    <Card className="flex flex-col border-0 ring-1 ring-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] rounded-2xl overflow-hidden h-full">
      {/* HEADER: Seragam dengan RecentEvents dan RecentFundRequests */}
      <CardHeader className="flex flex-row items-center justify-between pb-4 pt-5 px-6 border-b border-slate-50/80 bg-white">
        <div>
          <CardTitle className="text-base font-semibold text-slate-900 font-poppins flex items-center gap-2">
            <Wallet className="h-4 w-4 text-blue-600" />
            Transaksi Terakhir
          </CardTitle>
          <CardDescription className="text-xs text-slate-500 mt-1">
            {limit} transaksi terakhir grup Anda
          </CardDescription>
        </div>
        <Link 
          to={viewAllLink}
          className="group flex items-center text-[13px] font-medium text-slate-500 transition-colors px-2 py-1"
        >
          Semua
          <ArrowRight className="h-3.5 w-3.5 ml-1 opacity-50 group-hover:translate-x-0.5 group-hover:opacity-100 transition-all" />
        </Link>
      </CardHeader>

      <CardContent className="flex-1 p-0">
        {loading ? (
          <div className="p-4 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-2">
                <Skeleton className="h-10 w-10 rounded-xl shrink-0 bg-slate-100" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-3/4 bg-slate-100" />
                  <Skeleton className="h-2.5 w-1/2 bg-slate-100" />
                </div>
                <Skeleton className="h-5 w-20 rounded-full shrink-0 bg-slate-100" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center px-4">
            <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
              <ReceiptText className="h-6 w-6 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-600">Belum ada transaksi</p>
            <p className="text-xs text-slate-400 mt-0.5 max-w-[200px]">Riwayat pemasukan dan pengeluaran akan muncul di sini.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {items.map((tx) => {
              const isIncome = tx.type === "CREDIT" || tx.type === "INCOME";
              
              return (
                <div
                  key={tx.id}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/80 transition-all group"
                >
                  {/* ICON BOX: Menyesuaikan warna Pemasukan (Hijau) / Pengeluaran (Merah) */}
                  <div 
                    className={`flex items-center justify-center h-10 w-10 rounded-xl border shadow-sm shrink-0 transition-colors ${
                      isIncome 
                        ? "border-emerald-100 bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100/50 group-hover:border-emerald-200" 
                        : "border-red-100 bg-red-50 text-red-600 group-hover:bg-red-100/50 group-hover:border-red-200"
                    }`}
                  >
                    {isIncome ? (
                      <ArrowDownLeft className="h-5 w-5" />
                    ) : (
                      <ArrowUpRight className="h-5 w-5" />
                    )}
                  </div>

                  {/* INFO TEXT */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate group-hover:text-primary transition-colors">
                      {tx.description}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {formatDate(tx.createdAt)}
                    </p>
                  </div>

                  {/* AMOUNT TEXT */}
                  <span
                    className={`text-sm font-bold font-inter shrink-0 tabular-nums ${
                      isIncome ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {isIncome ? "+" : "-"}
                    {formatRupiah(Math.abs(tx.amount))}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}