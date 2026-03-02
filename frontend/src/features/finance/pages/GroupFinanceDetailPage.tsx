import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { Input } from "@/shared/ui/input";
import {
  ArrowLeft,
  Wallet,
  UserCircle,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { financeService } from "@/features/finance/services/financeService";
import type { GroupFinanceDetail } from "@/shared/types";

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

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function GroupFinanceDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<GroupFinanceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Determine correct back path based on role
  const userRole = (() => {
    try {
      const stored = localStorage.getItem("user");
      if (stored) return JSON.parse(stored).role;
    } catch { /* ignore */ }
    return null;
  })();

  const backPath =
    userRole === "LEADER"    ? "/dashboard/kas" :
    userRole === "TREASURER" ? "/dashboard/kas-bendahara" :
                               "/dashboard/kas-rt";
  const txDetailBasePath = "/dashboard/transaksi";

  useEffect(() => {
    if (!groupId) return;
    fetchDetail();
  }, [groupId]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const data = await financeService.getGroupFinanceDetail(Number(groupId));
      setDetail(data);
    } catch {
      toast.error("Gagal memuat detail keuangan RT.");
    } finally {
      setLoading(false);
    }
  };

  const filteredTx = (detail?.transactions || []).filter(
    (tx) => tx.description.toLowerCase().includes(search.toLowerCase())
  );

  const incomeCount = (detail?.transactions || []).filter(
    (tx) => tx.type === "INCOME" || tx.type === "CREDIT"
  ).length;
  const expenseCount = (detail?.transactions || []).filter(
    (tx) => tx.type === "EXPENSE" || tx.type === "DEBIT"
  ).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(backPath)}
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-poppins text-slate-900">
            {loading ? (
              <Skeleton className="h-8 w-40 inline-block" />
            ) : (
              detail?.group.name || "Detail RT"
            )}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {detail?.group.parentName
              ? `Bagian dari ${detail.group.parentName}`
              : "Detail keuangan RT"}
          </p>
        </div>
      </div>

      {/* Wallet Card */}
      <Card className="bg-gradient-to-br from-primary to-primary/80 text-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-white/80 font-poppins">
            Saldo Kas {detail?.group.name || ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-10 w-40 bg-white/20" />
          ) : (
            <>
              <div className="text-3xl sm:text-4xl font-bold">
                {detail?.wallet ? formatRupiah(detail.wallet.balance) : "Rp 0"}
              </div>
              <p className="text-sm text-white/70 mt-1">
                Diperbarui{" "}
                {detail?.wallet ? formatDate(detail.wallet.updatedAt) : "—"}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Officers + Dues Rule */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {/* Admin / Ketua RT */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-slate-600 font-poppins flex items-center gap-2">
              <UserCircle className="h-4 w-4 text-blue-500" />
              Ketua RT
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-5 w-32" />
            ) : detail?.admin ? (
              <div>
                <p className="font-semibold text-slate-900">{detail.admin.fullName}</p>
                <p className="text-xs text-slate-500">{detail.admin.email}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Belum ditentukan</p>
            )}
          </CardContent>
        </Card>

        {/* Treasurer / Bendahara */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-slate-600 font-poppins flex items-center gap-2">
              <UserCircle className="h-4 w-4 text-emerald-500" />
              Bendahara
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-5 w-32" />
            ) : detail?.treasurer ? (
              <div>
                <p className="font-semibold text-slate-900">
                  {detail.treasurer.fullName}
                </p>
                <p className="text-xs text-slate-500">{detail.treasurer.email}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Belum ditentukan</p>
            )}
          </CardContent>
        </Card>

        {/* Dues Rule */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-slate-600 font-poppins flex items-center gap-2">
              <Receipt className="h-4 w-4 text-amber-500" />
              Aturan Iuran
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-5 w-32" />
            ) : detail?.duesRule ? (
              <div>
                <p className="font-semibold text-slate-900">
                  {formatRupiah(detail.duesRule.amount)}
                </p>
                <p className="text-xs text-slate-500">
                  Jatuh tempo tanggal {detail.duesRule.dueDay} setiap bulan
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Belum diatur</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transaction History */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 font-poppins">
              Riwayat Transaksi
            </h2>
            <p className="text-xs text-slate-500">
              {incomeCount} pemasukan · {expenseCount} pengeluaran
            </p>
          </div>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Cari transaksi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </CardContent>
          </Card>
        ) : filteredTx.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <Wallet className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm text-slate-500 font-medium">
                {search ? "Transaksi tidak ditemukan." : "Belum ada transaksi."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredTx.map((tx) => {
                const isIncome = tx.type === "INCOME" || tx.type === "CREDIT";
                return (
                  <div
                    key={tx.id}
                    className="px-4 py-3.5 cursor-pointer hover:bg-slate-50/80 active:bg-slate-100 transition-colors"
                    onClick={() => navigate(`${txDetailBasePath}/${tx.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                          isIncome ? "bg-emerald-100" : "bg-red-100"
                        }`}
                      >
                        {isIncome ? (
                          <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-slate-900 truncate">{tx.description}</p>
                          <span className={`text-sm font-semibold shrink-0 ${
                            isIncome ? "text-emerald-600" : "text-red-600"
                          }`}>
                            {isIncome ? "+" : "-"}{formatRupiah(Math.abs(tx.amount))}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className="text-xs text-slate-500">{tx.createdBy?.fullName || "Sistem"}</p>
                          <p className="text-xs text-slate-400">{formatDateTime(tx.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 ml-12">
                      <Badge variant={isIncome ? "default" : "destructive"} className="text-[10px]">
                        {isIncome ? "Masuk" : "Keluar"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">#</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Deskripsi</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Tipe</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Jumlah</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-4 py-3">Tanggal</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTx.map((tx, idx) => {
                    const isIncome = tx.type === "INCOME" || tx.type === "CREDIT";
                    return (
                      <tr
                        key={tx.id}
                        className="border-b border-slate-50 hover:bg-slate-50/80 cursor-pointer transition-colors"
                        onClick={() => navigate(`${txDetailBasePath}/${tx.id}`)}
                      >
                        <td className="px-4 py-3 text-sm text-slate-500">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div
                              className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                                isIncome ? "bg-emerald-100" : "bg-red-100"
                              }`}
                            >
                              {isIncome ? (
                                <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <ArrowUpRight className="h-4 w-4 text-red-600" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-900">{tx.description}</p>
                              <p className="text-xs text-slate-500">{tx.createdBy?.fullName || "Sistem"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={isIncome ? "default" : "destructive"} className="text-[10px]">
                            {isIncome ? "Masuk" : "Keluar"}
                          </Badge>
                        </td>
                        <td className={`px-4 py-3 font-medium ${
                          isIncome ? "text-emerald-600" : "text-red-600"
                        }`}>
                          {isIncome ? "+" : "-"}{formatRupiah(Math.abs(tx.amount))}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500">{formatDateTime(tx.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
