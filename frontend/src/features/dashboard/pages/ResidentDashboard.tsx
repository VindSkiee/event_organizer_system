import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { Button } from "@/shared/ui/button";
import {
  Wallet,
  CreditCard,
  Download,
  Loader2,
  ArrowRight,
  CalendarDays,
  AlertCircle,
  CheckCircle2,
  Megaphone,
  PartyPopper,
  Clock,
  AlertTriangle,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { financeService } from "@/features/finance/services/financeService";
import { downloadFinanceReport } from "@/features/finance/services/reportService";
import { eventService } from "@/features/event/services/eventService";
import { paymentService } from "@/features/payment/services/paymentService";
import type { TransparencyBalance, MyBill, EventItem, PaymentItem } from "@/shared/types";

// --- FUNGSI HELPER STATUS EVENT ---
const eventStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    DRAFT: "Draft",
    SUBMITTED: "Diajukan",
    UNDER_REVIEW: "Dalam Review",
    REJECTED: "Ditolak",
    APPROVED: "Disetujui",
    CANCELLED: "Dibatalkan",
    FUNDED: "Didanai",
    ONGOING: "Berlangsung",
    COMPLETED: "Selesai",
    SETTLED: "Diselesaikan",
  };
  return labels[status] || status;
};

const eventStatusClassName = (status: string): string => {
  const classes: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-600 border-slate-200",
    SUBMITTED: "bg-amber-50 text-amber-700 border-amber-200",
    UNDER_REVIEW: "bg-yellow-50 text-yellow-700 border-yellow-200",
    APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    REJECTED: "bg-red-50 text-red-700 border-red-200",
    CANCELLED: "bg-rose-50 text-rose-700 border-rose-200",
    FUNDED: "bg-blue-50 text-blue-700 border-blue-200",
    ONGOING: "bg-purple-50 text-purple-700 border-purple-200",
    COMPLETED: "bg-teal-50 text-teal-700 border-teal-200",
    SETTLED: "bg-green-50 text-green-700 border-green-200",
  };
  return classes[status] || "bg-slate-50 text-slate-600 border-slate-200";
};
// ------------------------------------

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

export default function ResidentDashboard() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState<TransparencyBalance | null>(null);
  const [bill, setBill] = useState<MyBill | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PaymentItem[]>([]);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [loading, setLoading] = useState(true);

  const user = useMemo(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [balanceData, billData, eventsData, paymentsData] = await Promise.allSettled([
          financeService.getTransparencyBalance(),
          financeService.getMyBill(),
          eventService.getAll(),
          paymentService.getHistory(),
        ]);

        if (balanceData.status === "fulfilled") setBalance(balanceData.value);
        if (billData.status === "fulfilled") setBill(billData.value);
        if (eventsData.status === "fulfilled") setEvents(eventsData.value);
        if (paymentsData.status === "fulfilled") {
          const pending = paymentsData.value.filter(
            (p: PaymentItem) => p.status === "PENDING" && p.orderId.startsWith("DUES-")
          );
          setPendingPayments(pending);
        }
      } catch {
        toast.error("Terjadi kesalahan saat memuat data dashboard.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleDownloadSummaryReport = async () => {
    const now = new Date();
    const startOfCurrentYear = new Date(now.getFullYear(), 0, 1);

    setDownloadingReport(true);
    try {
      await downloadFinanceReport({
        reportType: "summary",
        startDate: startOfCurrentYear.toISOString(),
        endDate: now.toISOString(),
      });
      toast.success("Laporan keuangan berhasil diunduh.");
    } catch {
      toast.error("Gagal mengunduh laporan keuangan.");
    } finally {
      setDownloadingReport(false);
    }
  };

  const hasUnpaidBill = bill !== null && bill.totalAmount > 0;

  // Full-year paid: no unpaid bill AND next bill is in the following year
  const currentYear = new Date().getFullYear();
  const paidFullYear = !hasUnpaidBill && bill !== null && bill.nextBillYear > currentYear;

  const approvedEvents = events.filter((e) =>
    ["APPROVED", "FUNDED", "ONGOING", "COMPLETED", "SETTLED"].includes(e.status)
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-poppins text-slate-900">
            Halo, {user?.fullName || "Warga"}! 👋
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">
            Selamat datang di portal informasi warga.
          </p>
        </div>

        <Button
          onClick={handleDownloadSummaryReport}
          disabled={downloadingReport}
          className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white"
        >
          {downloadingReport ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Mengunduh...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Download Laporan Keuangan
            </>
          )}
        </Button>
      </div>

      {/* === PENDING PAYMENT REMINDER === */}
      {!loading && pendingPayments.length > 0 && (
        <Card className="relative overflow-hidden border-0 ring-1 ring-amber-200/50 bg-white shadow-[0_2px_10px_-3px_rgba(251,191,36,0.2)] rounded-2xl animate-in slide-in-from-top duration-500">
          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400"></div>

          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 ring-1 ring-amber-100">
                <AlertTriangle className="h-6 w-6" strokeWidth={2.5} />
              </div>

              <div className="flex-1 space-y-1">
                <h3 className="text-base font-semibold text-slate-900 font-poppins tracking-tight">
                  Menunggu Pembayaran
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed max-w-lg">
                  Anda memiliki <span className="font-medium text-amber-600">{pendingPayments.length} transaksi</span> yang belum diselesaikan. Segera selesaikan agar iuran tercatat.
                </p>

                <div className="mt-3 space-y-2 max-w-sm border-l-2 border-amber-200 pl-3">
                  {pendingPayments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Clock className="h-3.5 w-3.5 text-amber-500" />
                        <span className="font-mono text-xs">{p.orderId.length > 20 ? p.orderId.substring(0, 20) + "..." : p.orderId}</span>
                      </div>
                      <span className="font-semibold text-slate-800">{formatRupiah(Number(p.amount))}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                className="w-full sm:w-auto mt-4 sm:mt-0 bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-200 rounded-xl"
                onClick={() => navigate("/dashboard/pembayaran-warga")}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Bayar Sekarang
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* === MAIN CARDS: Status Tagihan === */}
      {loading ? (
        <Skeleton className="h-32 w-full rounded-2xl" />
      ) : (bill === null || bill.baseMonthlyAmount === 0) ? (
        <Card className="relative overflow-hidden border-0 ring-1 ring-blue-200/60 bg-white shadow-sm rounded-2xl">
          <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-blue-400"></div>
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-500">
                <AlertCircle className="h-6 w-6" strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 font-poppins tracking-tight">
                  Biaya Pembayaran Belum Ditentukan
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Pengurus belum mengatur biaya iuran untuk kelompok Anda. Status tagihan tidak tersedia saat ini.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : hasUnpaidBill ? (
        <Card className="relative overflow-hidden border-0 ring-1 ring-red-100 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl">
          <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-red-500"></div>

          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-4 flex-1">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                  <AlertCircle className="h-6 w-6" strokeWidth={2.5} />
                </div>
                <div className="space-y-1 w-full">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-900 font-poppins tracking-tight">
                      Tagihan Iuran Bulanan
                    </h3>
                    {/* Tambahkan Badge Tunggakan jika lebih dari 1 bulan */}
                    {bill?.unpaidMonthsCount && bill.unpaidMonthsCount > 1 && (
                      <Badge variant="destructive" className="text-[10px] h-5 px-1.5 py-0 bg-red-100 text-red-700 hover:bg-red-100 border-none">
                        Nunggak {bill.unpaidMonthsCount} Bulan
                      </Badge>
                    )}
                  </div>

                  <p className="text-sm text-slate-500 max-w-sm leading-snug">
                    {bill?.dueDateDescription || "Segera lunasi iuran bulan ini"}
                  </p>

                  {/* Total Keseluruhan */}
                  <div className="pt-3">
                    <p className="text-sm text-slate-500 font-medium mb-0.5">Total yang harus dibayar:</p>
                    <p className="text-3xl sm:text-4xl font-bold text-slate-900 font-poppins tracking-tight">
                      {formatRupiah(bill?.totalAmount || 0)}
                    </p>

                    {/* Breakdown Harga Dasar per Bulan */}
                    {bill?.baseMonthlyAmount && bill.baseMonthlyAmount > 0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-400">Tarif Dasar:</span>
                        {bill?.breakdown?.map((item, idx) => {
                          // Karena item.amount dari backend sudah dikalikan bulan nunggak, 
                          // kita harus membaginya kembali untuk menampilkan tarif ASLI per bulan di Badge ini.
                          const baseAmountPerType = bill.unpaidMonthsCount > 0
                            ? item.amount / bill.unpaidMonthsCount
                            : item.amount;

                          return (
                            <div key={idx} className="inline-flex items-center gap-1.5 rounded-md bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200/50">
                              <span className="text-slate-400">Iuran {item.type}</span>
                              <span className="text-slate-900">{formatRupiah(baseAmountPerType)}<span className="text-slate-400 font-normal">/bln</span></span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="w-full md:w-auto shrink-0 border-t border-slate-100 md:border-t-0 pt-5 md:pt-0">
                <Button
                  size="lg"
                  className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-12 px-8"
                  onClick={() => navigate("/dashboard/pembayaran-warga")}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Bayar Sekarang
                  <ArrowRight className="h-4 w-4 ml-2 opacity-70" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : paidFullYear ? (
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md rounded-2xl">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 h-32 w-32 rounded-full bg-white/10 blur-2xl"></div>
          <div className="absolute bottom-0 left-0 -mb-4 -ml-4 h-24 w-24 rounded-full bg-black/5 blur-xl"></div>

          <CardContent className="relative p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm ring-1 ring-white/30 shadow-inner">
                <Trophy className="h-8 w-8 text-white" strokeWidth={2} />
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-lg sm:text-xl font-bold font-poppins tracking-tight">
                    Iuran Lunas Setahun Penuh! 🎉
                  </h3>
                  <span className="inline-flex items-center rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm ring-1 ring-inset ring-white/20">
                    Tahun {currentYear}
                  </span>
                </div>
                <p className="text-sm sm:text-base text-white/90 leading-relaxed max-w-2xl">
                  Selamat! Seluruh kewajiban iuran Anda di tahun <strong>{currentYear}</strong> telah selesai. Terima kasih atas dedikasi Anda untuk memajukan lingkungan.
                </p>

                <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 rounded-lg bg-black/10 backdrop-blur-sm text-xs font-medium text-white/90">
                  <Megaphone className="h-3.5 w-3.5" />
                  <span>Pantau terus MarinaKas untuk event lingkungan terbaru.</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="relative overflow-hidden border-0 ring-1 ring-emerald-100 bg-white shadow-sm rounded-2xl">
          <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-emerald-500"></div>
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 font-poppins tracking-tight">
                  Status Iuran Terkini
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Anda tidak memiliki tagihan tertunggak saat ini. Terima kasih!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* === SALDO KAS === */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        <Card className="group hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 font-poppins">Saldo Kas RT</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-40" />
            ) : balance?.rt ? (
              <>
                <div className="text-2xl sm:text-3xl font-bold text-slate-900 font-poppins">
                  {formatRupiah(balance.rt.balance)}
                </div>
                <p className="text-xs text-slate-500 mt-1">{balance.rt.groupName}</p>
              </>
            ) : (
              <p className="text-sm text-slate-400">Data tidak tersedia</p>
            )}
          </CardContent>
        </Card>

        <Card className="group hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 font-poppins">Saldo Kas RW</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-40" />
            ) : balance?.rw ? (
              <>
                <div className="text-2xl sm:text-3xl font-bold text-slate-900 font-poppins">
                  {formatRupiah(balance.rw.balance)}
                </div>
                <p className="text-xs text-slate-500 mt-1">{balance.rw.groupName}</p>
              </>
            ) : (
              <p className="text-sm text-slate-400">Data tidak tersedia</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* === QUICK ACTIONS === */}
      <div className="grid gap-3 grid-cols-2">
        <Link to="/dashboard/pembayaran-warga" className="block">
          <Card className="h-full hover:shadow-md transition-all cursor-pointer group border-transparent hover:border-primary/20">
            <CardContent className="flex flex-col items-center justify-center py-5 text-center">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <p className="text-xs sm:text-sm font-medium text-slate-700">Pembayaran</p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/dashboard/organisasi-warga" className="block">
          <Card className="h-full hover:shadow-md transition-all cursor-pointer group border-transparent hover:border-primary/20">
            <CardContent className="flex flex-col items-center justify-center py-5 text-center">
              <div className="h-10 w-10 rounded-xl bg-violet-50 flex items-center justify-center mb-2 group-hover:bg-violet-100 transition-colors">
                <PartyPopper className="h-5 w-5 text-violet-600" />
              </div>
              <p className="text-xs sm:text-sm font-medium text-slate-700">Organisasi</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* === INFORMASI KEGIATAN RT/RW (LIST VIEW) === */}
      {/* === INFORMASI KEGIATAN RT/RW (LIST VIEW) === */}
      <Card className="border-0 shadow-sm ring-1 ring-slate-200 overflow-hidden bg-slate-50/30">
        <CardHeader className="bg-white border-b border-slate-100 pb-4 pt-5 px-5 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100/50">
                <Megaphone className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold font-poppins text-slate-900">
                  Papan Pengumuman Kegiatan
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm mt-0.5">
                  Daftar acara dan kegiatan lingkungan RT/RW Anda.
                </CardDescription>
              </div>
            </div>
            {/* Badge Total Acara */}
            <Badge variant="secondary" className="hidden sm:inline-flex bg-slate-100 text-slate-600 hover:bg-slate-200 border-transparent font-medium">
              {approvedEvents.length} Kegiatan Tercatat
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-6">
          {loading ? (
            // Skeleton Loader (Card-based)
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="border-slate-200 shadow-none p-4 flex gap-4 w-full">
                  <Skeleton className="h-14 w-14 rounded-xl shrink-0" />
                  <div className="space-y-2.5 w-full">
                    <Skeleton className="h-5 w-1/2" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </Card>
              ))}
            </div>
          ) : approvedEvents.length === 0 ? (
            // Empty State
            <div className="flex flex-col items-center justify-center py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200">
              <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center mb-4 ring-1 ring-slate-100">
                <CalendarDays className="h-8 w-8 text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-600">Belum ada kegiatan</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Saat ini belum ada jadwal kegiatan atau acara yang disetujui untuk lingkungan Anda.
              </p>
            </div>
          ) : (
            // Nested Card Event Items
            <div className="flex flex-col space-y-6">
              {(() => {
                // 1. Pisahkan Data: Acara RT (Local) vs Acara RW (Parent/Leader)
                const userGroupId = user?.communityGroupId;

                const localEvents = approvedEvents.filter(
                  (e) => e.communityGroupId === userGroupId
                );
                const parentEvents = approvedEvents.filter(
                  (e) => e.communityGroupId !== userGroupId
                );

                // 2. Helper Component untuk merender baris Event
                const renderEventCards = (eventsToRender: typeof approvedEvents) => {
                  if (eventsToRender.length === 0) {
                    return (
                      <div className="py-6 bg-white rounded-2xl border border-dashed border-slate-200 text-center text-sm text-slate-400 italic">
                        Tidak ada acara di kategori ini.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      {eventsToRender.map((event) => {
                        const eventDate = event.startDate ? new Date(event.startDate) : null;
                        const monthShort = eventDate ? eventDate.toLocaleDateString("id-ID", { month: "short" }) : "-";
                        const dateNum = eventDate ? eventDate.getDate() : "-";

                        // Menentukan gaya badge penyelenggara (RT = Biru, RW = Ungu)
                        const groupType = event.communityGroup?.type?.toUpperCase() || "UNKNOWN";
                        const isRW = groupType === "RW";

                        return (
                          <Link
                            key={event.id}
                            to={`/dashboard/events-warga/${event.id}`}
                            className="block group"
                          >
                            <Card className="flex flex-col sm:flex-row items-start sm:items-center p-4 sm:p-5 gap-4 bg-white border-slate-200/60 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-200 rounded-2xl cursor-pointer overflow-hidden relative">

                              {/* Left: Calendar Icon / Date Box */}
                              <div className="flex sm:flex-col items-center justify-center w-14 h-14 rounded-xl bg-slate-50 border border-slate-100 shrink-0 group-hover:border-indigo-200 group-hover:bg-indigo-50/50 transition-colors text-center">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{monthShort}</span>
                                <span className="text-lg font-black text-slate-800 leading-none group-hover:text-indigo-700">{dateNum}</span>
                              </div>

                              {/* Middle: Content */}
                              <div className="flex-1 min-w-0 w-full">
                                <div className="flex flex-col gap-1.5 sm:gap-2 mb-1.5">
                                  <h4 className="text-base font-semibold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                                    {event.title}
                                  </h4>

                                  {/* Badges Container */}
                                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                    {/* Badge Status */}
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] font-semibold px-2 py-0.5 border ${eventStatusClassName(event.status)}`}
                                    >
                                      {eventStatusLabel(event.status)}
                                    </Badge>

                                    {/* Badge Penyelenggara (RT/RW) */}
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] font-semibold px-2 py-0.5 border ${isRW
                                        ? "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200"
                                        : "bg-sky-50 text-sky-700 border-sky-200"
                                        }`}
                                    >
                                      {event.communityGroup?.name || "Organisasi"}
                                    </Badge>
                                  </div>
                                </div>

                                <p className="text-sm text-slate-500 line-clamp-2 mt-2 leading-relaxed">
                                  {event.description || "Tidak ada deskripsi rinci untuk acara ini."}
                                </p>

                                {/* Mobile Date Info */}
                                {event.startDate && (
                                  <div className="flex sm:hidden items-center gap-1 mt-3 text-xs text-slate-400 font-medium">
                                    <CalendarDays className="h-3.5 w-3.5" />
                                    {formatDate(event.startDate)}
                                  </div>
                                )}
                              </div>

                              {/* Right: Chevron Arrow (Desktop) */}
                              <div className="hidden sm:flex shrink-0 h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors ml-2">
                                <ArrowRight className="h-4 w-4" />
                              </div>

                            </Card>
                          </Link>
                        );
                      })}
                    </div>
                  );
                };

                return (
                  <>
                    {/* --- SECTION 1: ACARA LINGKUNGAN SENDIRI (RT) --- */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                          <div className="w-1.5 h-4 bg-sky-500 rounded-full" />
                          Lingkungan {user?.communityGroupId ? "(RT)" : ""}
                        </h3>
                        <span className="text-xs font-semibold text-slate-500 bg-slate-200/50 px-2 py-1 rounded-md">
                          {localEvents.length} Acara
                        </span>
                      </div>
                      {renderEventCards(localEvents)}
                    </div>

                    {/* --- SECTION 2: ACARA GABUNGAN / ATASAN (RW) --- */}
                    {/* Hanya render section ini jika memang ada acara dari RW */}
                    {parentEvents.length > 0 && (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between px-1">
                          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-fuchsia-500 rounded-full" />
                            Gabungan (RW)
                          </h3>
                          <span className="text-xs font-semibold text-slate-500 bg-slate-200/50 px-2 py-1 rounded-md">
                            {parentEvents.length} Acara
                          </span>
                        </div>
                        {renderEventCards(parentEvents)}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}