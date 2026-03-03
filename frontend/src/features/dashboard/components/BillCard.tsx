import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { CreditCard, AlertCircle } from "lucide-react";
import type { MyBill } from "@/shared/types";

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

interface BillCardProps {
  bill: MyBill | null;
  loading: boolean;
}

export function BillCard({ bill, loading }: BillCardProps) {
  const hasUnpaidBill = bill !== null && bill.totalAmount > 0;

  return (
    <Card className={hasUnpaidBill ? "border-red-200 bg-red-50/30" : undefined}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-600 font-poppins">
          Tagihan Iuran Anda
        </CardTitle>
        <CreditCard
          className={`h-4 w-4 ${hasUnpaidBill ? "text-red-500" : "text-slate-400"}`}
        />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-4 w-48" />
          </div>
        ) : bill ? (
          <>
            <div
              className={`text-xl sm:text-2xl font-bold ${
                hasUnpaidBill ? "text-red-600" : "text-slate-900"
              }`}
            >
              {formatRupiah(bill.totalAmount)}
            </div>
            {bill.breakdown?.length ? (
              <div className="mt-2 space-y-1">
                {bill.breakdown.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs sm:text-sm"
                  >
                    <span className="text-slate-500">
                      Iuran {item.type} ({item.groupName})
                    </span>
                    <span
                      className={`font-medium ${
                        hasUnpaidBill ? "text-red-600" : "text-slate-700"
                      }`}
                    >
                      {formatRupiah(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 mt-1">Tidak ada tagihan saat ini.</p>
            )}
            {hasUnpaidBill && (
              <div className="flex items-center gap-1.5 mt-3 text-xs text-red-500 font-medium">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Belum dibayar &middot; {bill.dueDateDescription}</span>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-400">Tidak ada data tagihan.</p>
        )}
      </CardContent>
    </Card>
  );
}
