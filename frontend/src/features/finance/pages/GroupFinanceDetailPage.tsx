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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Label } from "@/shared/ui/label";
import {
  ArrowLeft,
  Wallet,
  UserCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { financeService } from "@/features/finance/services/financeService";
import { DateRangeFilter } from "@/shared/components/DateRangeFilter";
import type { DateRange } from "@/shared/components/DateRangeFilter";
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
  const [filterTab, setFilterTab] = useState<"today" | "all">("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");

  // Advanced filters
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<"all" | "manual" | "qris" | "va" | "ewallet" | "card">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "success" | "failed">("all");
  const [filterCategory, setFilterCategory] = useState<"all" | "iuran" | "kegiatan" | "pengajuan">("all");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

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

  const filteredTx = (detail?.transactions || []).filter((tx) => {
    const matchSearch = tx.description.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;

    // Type filter
    const isIncome = tx.type === "INCOME" || tx.type === "CREDIT";
    if (filterType === "income" && !isIncome) return false;
    if (filterType === "expense" && isIncome) return false;

    // Tab: today
    const txDate = new Date(tx.createdAt);
    if (filterTab === "today") {
      const today = new Date();
      if (
        txDate.getDate() !== today.getDate() ||
        txDate.getMonth() !== today.getMonth() ||
        txDate.getFullYear() !== today.getFullYear()
      ) return false;
    }

    // Date range
    if (dateRange?.from) {
      const d = new Date(txDate);
      d.setHours(0, 0, 0, 0);
      const from = new Date(dateRange.from);
      from.setHours(0, 0, 0, 0);
      if (d < from) return false;
      if (dateRange.to) {
        const to = new Date(dateRange.to);
        to.setHours(23, 59, 59, 999);
        if (d > to) return false;
      }
    }
    // Advanced filters
    if (filterPaymentMethod === "manual" && tx.paymentGatewayTx) return false;
    if (filterPaymentMethod === "qris" && tx.paymentGatewayTx?.methodCategory !== "qris") return false;
    if (filterPaymentMethod === "va" && tx.paymentGatewayTx?.methodCategory !== "bank_transfer") return false;
    if (filterPaymentMethod === "ewallet" && !["gopay", "shopeepay", "ovo", "dana"].includes(tx.paymentGatewayTx?.methodCategory || "")) return false;
    if (filterPaymentMethod === "card" && tx.paymentGatewayTx?.methodCategory !== "credit_card") return false;
    if (filterStatus === "success") {
      if (tx.paymentGatewayTx && !["settlement", "capture"].includes(tx.paymentGatewayTx.status)) return false;
    }
    if (filterStatus === "failed") {
      if (!tx.paymentGatewayTx) return false;
      if (["settlement", "capture"].includes(tx.paymentGatewayTx.status)) return false;
    }
    if (filterCategory === "iuran" && !/iuran/i.test(tx.description)) return false;
    if (filterCategory === "kegiatan" && !/kegiatan|acara|event/i.test(tx.description)) return false;
    if (filterCategory === "pengajuan" && !/pengajuan|dana/i.test(tx.description)) return false;
    const minAmt = Number(minAmount);
    const maxAmt = Number(maxAmount);
    if (minAmount && !isNaN(minAmt) && tx.amount < minAmt) return false;
    if (maxAmount && !isNaN(maxAmt) && tx.amount > maxAmt) return false;
    return true;
  });

  const advancedFilterCount = [
    filterPaymentMethod !== "all",
    filterStatus !== "all",
    filterCategory !== "all",
    !!minAmount,
    !!maxAmount,
  ].filter(Boolean).length;

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
              Iuran per Bulan
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
        </div>

        {/* === FILTER BAR RESPONSIVE === */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          
          {/* Baris Atas di Mobile (Tabs & Type Select) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto shrink-0">
            {/* Tab: Hari Ini / Semua */}
            <div className="flex bg-slate-100 p-1 rounded-lg w-full sm:w-auto">
              <button
                onClick={() => { setFilterTab("today"); setDateRange(undefined); }}
                className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  filterTab === "today" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Hari Ini
              </button>
              <button
                onClick={() => setFilterTab("all")}
                className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  filterTab === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Semua
              </button>
            </div>

            {/* Filter Tanggal (Muncul jika Semua) */}
            {filterTab === "all" && (
              <div className="w-full sm:w-auto">
                <DateRangeFilter
                  value={dateRange}
                  onChange={setDateRange}
                  placeholder="Pilih rentang tanggal"
                />
              </div>
            )}

            {/* Type filter */}
            <div className="w-full sm:w-[160px] shrink-0">
              <Select value={filterType} onValueChange={(v) => setFilterType(v as "all" | "income" | "expense")}>
                <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white text-sm shadow-sm focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Tipe</SelectItem>
                  <SelectItem value="income">Pemasukan</SelectItem>
                  <SelectItem value="expense">Pengeluaran</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Baris Bawah di Mobile (Search & Advanced Toggle) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full">
            {/* Search Input */}
            <div className="relative w-full lg:max-w-md group">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors duration-200" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="11" cy="11" r="8" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Cari deskripsi atau ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-10 pr-4 rounded-xl text-sm bg-white text-slate-800 placeholder:text-slate-400 border border-slate-200 shadow-sm outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/10 hover:border-slate-300"
              />
            </div>

            {/* Actions: Advanced Filter & Reset */}
            <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 px-1 sm:px-0">
              <button
                onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
                className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                  showAdvancedFilter || advancedFilterCount > 0 ? "text-primary" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span>Filter Lanjut</span>
                {advancedFilterCount > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-white shadow-sm">
                    {advancedFilterCount}
                  </span>
                )}
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showAdvancedFilter ? "rotate-180" : ""}`} />
              </button>

              {(filterType !== "all" || dateRange?.from || filterTab === "today" || search || advancedFilterCount > 0) && (
                <button
                  onClick={() => { 
                    setFilterTab("all"); setDateRange(undefined); setFilterType("all"); 
                    setSearch(""); setFilterPaymentMethod("all"); setFilterStatus("all"); 
                    setFilterCategory("all"); setMinAmount(""); setMaxAmount("");
                  }}
                  className="text-xs font-semibold text-rose-500 hover:text-rose-700 transition-colors"
                >
                  Reset Semua
                </button>
              )}
            </div>
          </div>
        </div>

        {/* === ADVANCED FILTER PANEL === */}
        {showAdvancedFilter && (
          <Card className="border border-primary/20 bg-primary/5 shadow-none overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300 rounded-xl">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Method */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Metode Pembayaran</Label>
                  <Select value={filterPaymentMethod} onValueChange={(v) => setFilterPaymentMethod(v as "all" | "manual" | "qris" | "va" | "ewallet" | "card")}>
                    <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Metode</SelectItem>
                      <SelectItem value="manual">Manual / Tunai</SelectItem>
                      <SelectItem value="qris">QRIS</SelectItem>
                      <SelectItem value="va">Virtual Account</SelectItem>
                      <SelectItem value="ewallet">E-Wallet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status Transaksi</Label>
                  <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as "all" | "success" | "failed")}>
                    <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Status</SelectItem>
                      <SelectItem value="success">Berhasil (Success)</SelectItem>
                      <SelectItem value="failed">Gagal / Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Category */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Kategori</Label>
                  <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v as "all" | "iuran" | "kegiatan" | "pengajuan")}>
                    <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Kategori</SelectItem>
                      <SelectItem value="iuran">Iuran Warga</SelectItem>
                      <SelectItem value="kegiatan">Acara / Kegiatan</SelectItem>
                      <SelectItem value="pengajuan">Pengajuan Dana</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Amount Range */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Rentang Nominal</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Min (Rp)"
                      value={minAmount}
                      onChange={(e) => setMinAmount(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg text-sm bg-white text-slate-800 placeholder:text-slate-400 border border-slate-200 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                    <span className="text-slate-400 text-xs">—</span>
                    <input
                      type="number"
                      placeholder="Maks (Rp)"
                      value={maxAmount}
                      onChange={(e) => setMaxAmount(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg text-sm bg-white text-slate-800 placeholder:text-slate-400 border border-slate-200 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>
        )}

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
                {search || filterType !== "all" || dateRange?.from || filterTab === "today" || advancedFilterCount > 0
                  ? "Transaksi tidak ditemukan."
                  : "Belum ada transaksi."}
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
