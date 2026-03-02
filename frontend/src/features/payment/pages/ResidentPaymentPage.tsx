import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
} from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { markAsSeen } from "@/shared/helpers/seenPagesStore";
import { invalidateBadgeCache } from "@/shared/hooks/useBadgeNotifications";
import { emitSidebarUpdate } from "@/shared/helpers/sidebarEvents";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import {
  CreditCard,
  Search,
  Wallet,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  ShieldCheck,
  ArrowRight,
  FileText,
  AlertTriangle,
  AlertCircle,
  QrCode,
  RefreshCw,
  Check,
  WalletCards,
  ReceiptText,
} from "lucide-react";
import { toast } from "sonner";
import { financeService } from "@/features/finance/services/financeService";
import { paymentService } from "@/features/payment/services/paymentService";
import type { MyBill, PaymentItem } from "@/shared/types";
import { DateRangeFilter } from "@/shared/components/DateRangeFilter";
import type { DateRange } from "@/shared/components/DateRangeFilter";
import { AnimatedNumber } from "../components";

// === HELPERS ===

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusConfig(status: string) {
  switch (status) {
    case "PAID":
      return { label: "Berhasil", variant: "default" as const, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" };
    case "PENDING":
      return { label: "Menunggu", variant: "outline" as const, icon: Clock, color: "text-amber-600", bg: "bg-amber-50", badgeClassName: "bg-yellow-50 text-yellow-700 border-yellow-200" };
    case "FAILED":
      return { label: "Gagal", variant: "destructive" as const, icon: XCircle, color: "text-red-600", bg: "bg-red-50" };
    case "EXPIRED":
      return { label: "Kedaluwarsa", variant: "outline" as const, icon: Clock, color: "text-slate-500", bg: "bg-slate-50" };
    case "CANCELLED":
      return { label: "Dibatalkan", variant: "outline" as const, icon: XCircle, color: "text-slate-500", bg: "bg-slate-50" };
    default:
      return { label: status, variant: "outline" as const, icon: Clock, color: "text-slate-500", bg: "bg-slate-50" };
  }
}

function getMethodLabel(method?: string): string {
  const labels: Record<string, string> = {
    VIRTUAL_ACCOUNT: "Virtual Account",
    E_WALLET: "E-Wallet",
    CREDIT_CARD: "Kartu Kredit",
    CONVENIENCE_STORE: "Minimarket",
    QRIS: "QRIS",
  };
  return labels[method || ""] || method || "-";
}

// === CONSTANTS ===

const MONTH_NAMES_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const MONTH_SHORT_ID = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

// === Midtrans Snap Loader ===

const MIDTRANS_SNAP_URL = import.meta.env.VITE_MIDTRANS_IS_PRODUCTION === "true"
  ? "https://app.midtrans.com/snap/snap.js"
  : "https://app.sandbox.midtrans.com/snap/snap.js";
const MIDTRANS_CLIENT_KEY = import.meta.env.VITE_MIDTRANS_CLIENT_KEY || "";

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        options: {
          onSuccess?: (result: unknown) => void;
          onPending?: (result: unknown) => void;
          onError?: (result: unknown) => void;
          onClose?: () => void;
        }
      ) => void;
    };
  }
}

function loadMidtransSnap(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.snap) {
      resolve();
      return;
    }
    const existing = document.querySelector(`script[src*="snap.js"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    const script = document.createElement("script");
    script.src = MIDTRANS_SNAP_URL;
    script.setAttribute("data-client-key", MIDTRANS_CLIENT_KEY);
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Gagal memuat Midtrans Snap"));
    document.head.appendChild(script);
  });
}

// === MAIN COMPONENT ===

export default function ResidentPaymentPage() {
  const navigate = useNavigate();
  const [bill, setBill] = useState<MyBill | null>(null);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [paying, setPaying] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedMonthCount, setSelectedMonthCount] = useState(1);
  const payingRef = useRef(false); // Prevent double-click
  const [filterTab, setFilterTab] = useState<"today" | "all">("today");
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  // Countdown seconds until next auto-poll (0 = polling inactive)
  const [pollCountdown, setPollCountdown] = useState(0);

  // Track "new since last visit" — captured before mark-as-seen so we can show badges
  const prevPaymentSeenAtRef = useRef<number | null>(null);

  const fetchBill = useCallback(async () => {
    try {
      const data = await financeService.getMyBill();
      setBill(data);
    } catch {
      // Bill might not be available — that's OK
      setBill(null);
    }
  }, []);

  const fetchPayments = useCallback(async () => {
    setLoadingPayments(true);
    try {
      const data = await paymentService.getHistory();
      setPayments(data);
    } catch {
      toast.error("Gagal memuat riwayat pembayaran.");
    } finally {
      setLoadingPayments(false);
    }
  }, []);

  useEffect(() => {
    // Mark page as seen immediately so sidebar badge clears
    prevPaymentSeenAtRef.current = markAsSeen("payment");
    invalidateBadgeCache();
    emitSidebarUpdate();

    const init = async () => {
      setLoading(true);
      await Promise.allSettled([fetchBill(), fetchPayments()]);
      setLoading(false);
    };
    init();
    // Preload Midtrans Snap
    loadMidtransSnap().catch(() => { });
  }, [fetchBill, fetchPayments]);

  // Derived: find any pending DUES payment for polling & UI
  const pendingPayment = payments.find((p) => p.status === "PENDING" && p.orderId.startsWith("DUES-"));
  const hasPendingPayment = !!pendingPayment;

  // === AUTO-POLLING dengan countdown: 1 tick/detik, poll setiap POLL_SECONDS ===
  const POLL_SECONDS = 5;

  useEffect(() => {
    if (!hasPendingPayment || !pendingPayment) {
      setPollCountdown(0);
      return;
    }

    const orderId = pendingPayment.orderId;
    let secondsLeft = POLL_SECONDS;
    let stopped = false;
    setPollCountdown(POLL_SECONDS);

    const tickId = setInterval(async () => {
      if (stopped) return;
      secondsLeft -= 1;

      if (secondsLeft <= 0) {
        // Waktu poll — reset countdown dulu, lalu cek backend
        secondsLeft = POLL_SECONDS;
        setPollCountdown(POLL_SECONDS);
        try {
          const result = await paymentService.syncPayment(orderId);
          if (!result.updated) return; // masih PENDING, lanjut polling

          const status = (result.status ?? "").toUpperCase();
          if (status === "PAID" || status === "SETTLEMENT") {
            stopped = true;
            clearInterval(tickId);
            setPollCountdown(0);
            setShowSuccessPopup(true);
            await Promise.allSettled([fetchPayments(), fetchBill()]);
            invalidateBadgeCache();
            emitSidebarUpdate();
          } else if (["EXPIRED", "CANCELLED", "FAILED"].includes(status)) {
            stopped = true;
            clearInterval(tickId);
            setPollCountdown(0);
            toast.info(`Status pembayaran: ${result.status}`);
            await Promise.allSettled([fetchPayments(), fetchBill()]);
          }
        } catch {
          // Silent — hiccup jaringan, coba lagi di tick berikutnya
        }
      } else {
        setPollCountdown(secondsLeft);
      }
    }, 1_000);

    return () => {
      stopped = true;
      clearInterval(tickId);
      setPollCountdown(0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPendingPayment, pendingPayment?.orderId]);

  // Reset month selection whenever bill data changes
  useEffect(() => {
    // Default seleksi: minimal pilih 1 bulan, atau lunasi semua tunggakan jika ada.
    const defaultSelect = bill && bill.unpaidMonthsCount > 0 ? bill.unpaidMonthsCount : 1;
    setSelectedMonthCount(defaultSelect);
  }, [bill?.nextBillMonth, bill?.nextBillYear, bill?.unpaidMonthsCount]);

  // Daftar bulan Jan–Des tahun tagihan — capped ke Desember
  const monthGrid = useMemo(() => {
    const startMonth = bill?.nextBillMonth ?? (new Date().getMonth() + 1);
    const year = bill?.nextBillYear ?? new Date().getFullYear();
    const unpaidCount = bill?.unpaidMonthsCount || 0;

    const maxSelectable = 12 - startMonth + 1;

    return {
      months: Array.from({ length: 12 }, (_, i) => {
        const m = i + 1; // 1-12
        const offset = m - startMonth; // <0=paid, 0=current nextBillMonth

        // Logika Status:
        // Jika offset negatif (bulan sebelumnya), berarti sudah LUNAS (paid)
        // Jika offset positif tapi MASIH DI DALAM rentang nunggak, berarti WAJIB (locked)
        // Jika di luar rentang nunggak, berarti BISA DIPILIH (selectable)
        let state = "selectable";
        if (offset < 0) {
          state = "paid";
        } else if (offset < unpaidCount) {
          // Semua bulan nunggak statusnya terkunci (harus dibayar)
          state = "locked";
        }

        // isChecked = bukan paid, dan posisinya di bawah selectedMonthCount
        const isChecked = state !== "paid" && offset < selectedMonthCount;

        return { month: m, year, label: MONTH_NAMES_ID[i], short: MONTH_SHORT_ID[i], state, offset, isChecked };
      }),
      maxSelectable,
      startMonth,
      year,
    };
  }, [bill?.nextBillMonth, bill?.nextBillYear, bill?.unpaidMonthsCount, selectedMonthCount]);

  // Toggle bulan — hanya dalam tahun berjalan (maks Desember)
  const handleMonthToggle = (m: number) => {
    const startMonth = monthGrid.startMonth;
    if (m < startMonth) return; // paid — locked
    if (m === startMonth) return; // wajib — locked
    const offset = m - startMonth; // 1+
    // Cegah memilih melebihi Desember
    if (offset >= monthGrid.maxSelectable) return;
    if (offset < selectedMonthCount) {
      setSelectedMonthCount(offset);     // uncheck ini dan ke atas
    } else {
      setSelectedMonthCount(offset + 1); // check sampai bulan ini
    }
  };

  // === SYNC PENDING PAYMENT FROM MIDTRANS ===
  const handleSyncPending = async () => {
    if (!pendingPayment) return;
    setSyncing(true);
    try {
      const result = await paymentService.syncPayment(pendingPayment.orderId);
      if (result.updated) {
        toast.success(`Status diperbarui: ${result.status}`);
        await Promise.allSettled([fetchBill(), fetchPayments()]);
      } else {
        toast.info(result.message || "Pembayaran masih pending di Midtrans. Silakan selesaikan pembayaran terlebih dahulu.");
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : "Gagal mengecek status");
      toast.error(msg);
    } finally {
      setSyncing(false);
    }
  };

  // === PAYMENT HANDLER ===
  const handlePayDues = async () => {
    setShowConfirmDialog(false);

    // Double-click prevention
    if (payingRef.current) return;
    payingRef.current = true;
    setPaying(true);

    try {
      // 1. Ensure Snap is loaded
      await loadMidtransSnap();

      // 2. Create payment on backend
      const result = await paymentService.payDues(selectedMonthCount);

      if (!result.token) {
        throw new Error("Token pembayaran tidak diterima");
      }

      // 3. Open Midtrans Snap popup
      window.snap?.pay(result.token, {
        onSuccess: async () => {
          // Refresh data; popup sukses akan muncul via polling setelah status terkonfirmasi
          await Promise.allSettled([fetchPayments(), fetchBill()]);
          invalidateBadgeCache();
          emitSidebarUpdate();
        },
        onPending: async () => {
          toast.info("Pembayaran sedang diproses. Auto-polling akan memantau status.");
          // Refresh agar state pendingPayment segera terisi → auto-polling aktif
          await Promise.allSettled([fetchPayments(), fetchBill()]);
        },
        onError: async () => {
          toast.error("Pembayaran gagal. Silakan coba lagi.");
          await fetchPayments();
        },
        onClose: async () => {
          toast.info("Jendela pembayaran ditutup. Jika sudah membayar, status akan diperbarui otomatis.");
          await Promise.allSettled([fetchPayments(), fetchBill()]);
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal memproses pembayaran";
      toast.error(message);
    } finally {
      setPaying(false);
      payingRef.current = false;
    }
  };

  const currentYear = new Date().getFullYear();
  const hasUnpaidBill = bill !== null && bill.totalAmount > 0;
  const isFullYearPaid =
    bill !== null &&
    bill.baseMonthlyAmount > 0 &&
    bill.nextBillYear > currentYear;
  const isCurrentMonthPaidAhead =
    !hasUnpaidBill &&
    !isFullYearPaid &&
    bill !== null &&
    bill.baseMonthlyAmount > 0;
  const paidCount = payments.filter((p) => p.status === "PAID").length;
  const totalPaid = payments.filter((p) => p.status === "PAID").reduce((s, p) => s + Number(p.amount), 0);

  const filteredPayments = payments.filter((p) => {
    // 1. Cek Pencarian Teks
    const matchSearch =
      p.orderId.toLowerCase().includes(search.toLowerCase()) ||
      p.status.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;

    const paymentDate = new Date(p.createdAt);

    // 2. Cek Filter Tab ("today" vs "all")
    if (filterTab === "today") {
      const today = new Date();
      // Pastikan tahun, bulan, dan tanggal sama
      if (
        paymentDate.getDate() !== today.getDate() ||
        paymentDate.getMonth() !== today.getMonth() ||
        paymentDate.getFullYear() !== today.getFullYear()
      ) {
        return false;
      }
    }

    // 3. Cek DateRange (Jika pengguna memilih tanggal spesifik dari kalender)
    // DateRange ini akan tetap jalan meskipun tab-nya "all"
    if (dateRange?.from) {
      const d = new Date(paymentDate);
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
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* ===== PAYMENT SUCCESS POPUP ===== */}
      <Dialog open={showSuccessPopup} onOpenChange={setShowSuccessPopup}>
        <DialogContent className="sm:max-w-sm p-0 overflow-hidden border-0">
          <div className="bg-gradient-to-b from-emerald-50/80 to-white px-6 pt-10 pb-6 flex flex-col items-center text-center">
            {/* Ikon Sukses dengan efek Glow */}
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-emerald-400 blur-xl opacity-30 rounded-full animate-pulse" />
              <div className="relative h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center border-4 border-white shadow-sm">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" strokeWidth={2.5} />
              </div>
            </div>
            <DialogHeader className="space-y-1.5 flex flex-col items-center w-full">
              <DialogTitle className="font-poppins text-2xl text-slate-900">
                Pembayaran Berhasil!
              </DialogTitle>
              <DialogDescription className="text-slate-500 text-sm max-w-[260px] mx-auto">
                Terima kasih, iuran bulanan Anda telah berhasil dibayarkan dan tercatat di sistem.
              </DialogDescription>
            </DialogHeader>
            <div className="w-full border-t border-dashed border-slate-200 my-6" />
            <div className="w-full bg-slate-50 rounded-xl p-3.5 mb-6 flex items-start gap-3 border border-slate-100 text-left">
              <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-100 shrink-0">
                <ReceiptText className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mt-0.5">
                Bukti transaksi ini dapat Anda lihat kapan saja melalui menu{" "}
                <span className="font-semibold text-slate-800">Riwayat Pembayaran</span> di bawah.
              </p>
            </div>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              onClick={() => setShowSuccessPopup(false)}
            >
              Selesai
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-poppins text-slate-900">Pembayaran</h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">
            Kelola iuran dan lihat riwayat pembayaran Anda.
          </p>
        </div>
      </div>

      {/* === INVOICE / TAGIHAN SECTION === */}
      {loading ? (
        <Skeleton className="h-52 w-full rounded-xl" />
      ) : (bill === null || bill.baseMonthlyAmount === 0) ? (
        <Card className="relative overflow-hidden border-0 ring-1 ring-blue-200/60 bg-white shadow-sm rounded-xl">
          <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-blue-400"></div>
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-500">
                <AlertCircle className="h-6 w-6" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-base font-semibold text-slate-900 font-poppins">
                  Aturan Pembayaran Belum Ditentukan
                </p>
                <p className="text-sm text-slate-500 mt-0.5">
                  Pengurus belum mengatur aturan iuran untuk kelompok Anda. Status tagihan tidak tersedia saat ini.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : isFullYearPaid ? (
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50">
          <CardContent className="py-6 px-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-base font-semibold text-emerald-800 font-poppins">Semua Iuran Lunas Untuk Tahun Ini!</p>
                <p className="text-sm text-emerald-600 mt-0.5">
                  Seluruh iuran tahun {currentYear} telah dibayar. Tagihan berikutnya akan mulai pada{" "}
                  <span className="font-semibold">
                    {MONTH_NAMES_ID[(bill?.nextBillMonth ?? 1) - 1]} {bill?.nextBillYear}
                  </span>.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (hasUnpaidBill || isCurrentMonthPaidAhead) ? (
        <Card className="rounded-xl shadow-sm bg-slate-100 ">
          <div className="bg-slate-100 p-6 sm:p-8">
            {/* Info Banner: this month is paid but can pay ahead */}
            {isCurrentMonthPaidAhead && (
              <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-800 font-poppins">
                    Iuran Bulan Ini Sudah Lunas
                  </p>
                  <p className="text-xs text-emerald-700 mt-0.5 leading-relaxed">
                    Tidak ada tunggakan saat ini. Anda tetap bisa melunasi iuran bulan-bulan berikutnya di tahun {currentYear} lebih awal.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 mb-4">
              <p className="text-sm sm:text-base font-semibold text-slate-700 uppercase tracking-wide">
                {isCurrentMonthPaidAhead ? "Bayar Iuran di Muka" : "Nota Tagihan Iuran"}
              </p>
            </div>

            {/* Invoice Detail — per-month base amounts */}
            <div className="bg-slate-200 rounded-lg p-4 sm:p-5 border border-slate-100 mb-4">
              <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-3">Rincian iuran / bulan</p>
              <div className="space-y-3">
                {(bill?.baseBreakdown ?? bill?.breakdown ?? []).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm sm:text-base font-medium text-slate-700">Iuran {item.type}</p>
                      <p className="text-xs sm:text-sm text-slate-400">{item.groupName}</p>
                    </div>
                    <p className="text-base sm:text-lg font-semibold text-slate-900 font-poppins">{formatRupiah(item.amount)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Month Selector — only when no pending transaction */}
            {!hasPendingPayment && (
              <div className="bg-slate-200 border border-slate-100 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-center mb-7 mt-7">
                  <p className="text-[10px] sm:text-sm text-center font-semibold text-slate-700 uppercase tracking-widest">
                    Pilih bulan yang ingin dibayar
                  </p>
                </div>

                {/* Horizontal progress blocks */}
                <div className="overflow-x-auto pb-1">
                  <div className="flex items-stretch gap-0 min-w-max justify-center">
                    {monthGrid.months.map((m, idx) => {
                      const isLast = idx === 11;
                      return (
                        <div key={m.month} className="flex items-center">
                          <button
                            type="button"
                            disabled={m.state === "paid" || m.state === "locked"}
                            onClick={() => handleMonthToggle(m.month)}
                            aria-pressed={m.isChecked}
                            aria-label={`${m.state === "paid" ? "Lunas" :
                              m.state === "locked" ? "Wajib" : m.isChecked ? "Dipilih" : "Pilih"
                              } ${m.label}`}
                            className={`flex flex-col items-center gap-1 px-3 py-2 sm:px-2.5 rounded-lg
                              transition-all duration-150 select-none min-w-[56px] sm:min-w-[52px]
                              ${m.state === "paid"
                                ? "cursor-default text-slate-600"
                                : m.state === "locked"
                                  ? "cursor-default text-black"
                                  : m.isChecked
                                    ? "cursor-pointer text-black hover:bg-emerald-500/10"
                                    : "cursor-pointer text-slate-400 hover:text-black"
                              }`}
                          >
                            {/* Checkbox ring */}
                            <span className={`h-6 w-6 sm:h-7 sm:w-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-all
                              ${m.state === "paid"
                                ? "border-slate-600 bg-slate-700/50"
                                : m.state === "locked"
                                  ? "border-amber-400 bg-amber-400"
                                  : m.isChecked
                                    ? "border-emerald-500 bg-emerald-500"
                                    : "border-slate-500 bg-transparent"
                              }`}
                            >
                              {(m.state === "paid" || m.state === "locked" || m.isChecked) && (
                                <Check className="h-3 w-3 sm:h-2.5 sm:w-2.5 text-white" strokeWidth={3} />
                              )}
                            </span>

                            {/* Short month name */}
                            <span className="text-xs sm:text-[12px] font-medium leading-none">{m.short}</span>

                            {/* Badge */}
                            {m.state === "locked" && (
                              <span className="text-[10px] text-amber-400 leading-none">wajib</span>
                            )}
                            {m.state === "paid" && (
                              <span className="text-[8px] text-slate-600 leading-none">lunas</span>
                            )}
                          </button>

                          {/* Connector line between months */}
                          {!isLast && (
                            <div className={`h-0.5 w-3 shrink-0 rounded-full transition-colors
                              ${m.isChecked && monthGrid.months[idx + 1].isChecked
                                ? "bg-emerald-500"
                                : m.state === "paid" && (monthGrid.months[idx + 1].state === "paid" || monthGrid.months[idx + 1].state === "locked")
                                  ? "bg-slate-700"
                                  : "bg-white/10"
                              }`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Dynamic total + year hint */}
                <div className="border-t border-slate-100 mt-3 pt-3 flex items-center justify-between">
                  <div>
                    <span className="text-xs sm:text-sm text-slate-700 font-medium">
                      {selectedMonthCount} bulan dipilih
                    </span>
                    {monthGrid.maxSelectable === selectedMonthCount && (
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Sudah maks untuk tahun {monthGrid.year}. Sisa bulan dapat dibayar tahun depan.
                      </p>
                    )}
                    {selectedMonthCount > 1 && monthGrid.maxSelectable > selectedMonthCount && (
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {MONTH_NAMES_ID[(monthGrid.startMonth) - 1]}–{MONTH_NAMES_ID[(monthGrid.startMonth) + selectedMonthCount - 2]}
                      </p>
                    )}
                  </div>
                  <p className="text-xl sm:text-2xl font-bold text-black font-poppins">
                    <AnimatedNumber
                      // 👇 GUNAKAN baseMonthlyAmount DI SINI 👇
                      value={(bill?.baseMonthlyAmount || 0) * selectedMonthCount}
                      formatter={formatRupiah}
                    />
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-slate-600 mb-4">
              <ShieldCheck className="h-3.5 w-3.5 text-slate-600" />
              <span className="text-slate-600">{bill?.dueDateDescription} &middot; Pembayaran aman via Midtrans</span>
            </div>

            {/* Pending Payment Warning */}
            {hasPendingPayment && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 shadow-sm">

                <div className="flex items-start sm:items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100">
                    <AlertTriangle className="h-4 w-4 text-amber-600" strokeWidth={2.5} />
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-amber-900 font-poppins">
                      Ada pembayaran yang belum selesai
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                      Sudah bayar tapi status masih pending? Klik tombol untuk memperbarui.
                    </p>
                    {/* Polling countdown indicator */}
                    {pollCountdown > 0 && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                        </span>
                        <p className="text-[11px] text-amber-600 font-medium">
                          Pengecekan otomatis dalam{" "}
                          <span className="font-bold tabular-nums">{pollCountdown}s</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto shrink-0 bg-white border-amber-300 text-amber-700 hover:bg-amber-100 hover:text-amber-900 transition-colors shadow-sm"
                  onClick={handleSyncPending}
                  disabled={syncing}
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-2 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Mengecek..." : "Cek Status"}
                </Button>

              </div>
            )}

            {/* Payment Method Info */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-lg p-3 mb-5">
              <QrCode className="h-4 w-4 text-emerald-500 shrink-0" />
              <p className="text-xs text-slate-700">
                Metode pembayaran utama: <span className="font-semibold text-slate-900">QRIS</span> — Bisa scan dari aplikasi e-wallet manapun (GoPay, OVO, Dana, ShopeePay, dll)
              </p>
            </div>

            <Button
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-base h-12 shadow-lg shadow-emerald-500/20"
              disabled={paying}
              onClick={() => setShowConfirmDialog(true)}
            >
              {paying ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Memproses...
                </>
              ) : hasPendingPayment ? (
                <>
                  <CreditCard className="h-5 w-5 mr-2" />
                  Lanjutkan Pembayaran
                </>
              ) : (
                <>
                  <CreditCard className="h-5 w-5 mr-2" />
                  Bayar {selectedMonthCount > 1 ? `${selectedMonthCount} Bulan` : "Sekarang"} &mdash;
                  {/* 👇 GUNAKAN baseMonthlyAmount DI SINI 👇 */}
                  {formatRupiah((bill?.baseMonthlyAmount || 0) * selectedMonthCount)}
                </>
              )}
            </Button>
          </div>
        </Card>
      ) : null}

      {/* === SUMMARY CARDS === */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Transaksi</p>
              <p className="text-lg font-bold text-slate-900">{loadingPayments ? "..." : payments.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Berhasil Dibayar</p>
              <p className="text-lg font-bold text-slate-900">{loadingPayments ? "..." : paidCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Dibayarkan</p>
              <p className="text-lg font-bold text-slate-900">{loadingPayments ? "..." : formatRupiah(totalPaid)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* === PAYMENT HISTORY === */}
      <div>
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-5">
          <div className="shrink-0">
            <h2 className="text-lg font-semibold text-slate-900 font-poppins">Riwayat Pembayaran</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {filterTab === "today"
                ? "Menampilkan transaksi yang dilakukan hari ini."
                : "Menampilkan seluruh riwayat transaksi Anda."}
            </p>
          </div>

          {/* Baris Filter (Responsif stack di mobile, sejajar di layar besar) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            {/* Tabs Pilihan */}
            <div className="flex bg-slate-100 p-1 rounded-lg w-full sm:w-auto shrink-0">
              <button
                onClick={() => {
                  setFilterTab("today");
                  setDateRange(undefined);
                }}
                className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filterTab === "today" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
              >
                Hari Ini
              </button>
              <button
                onClick={() => setFilterTab("all")}
                className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filterTab === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
              >
                Semua
              </button>
            </div>

            {/* Filter Tanggal Khusus */}
            {filterTab === "all" && (
              <div className="w-full sm:w-auto">
                <DateRangeFilter
                  value={dateRange}
                  onChange={setDateRange}
                  placeholder="Filter tanggal"
                />
              </div>
            )}

            {/* Input Pencarian */}
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Cari Order ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 w-full"
              />
            </div>
          </div>
        </div>

        {loadingPayments ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : filteredPayments.length === 0 ? (
          <Card className="border-dashed shadow-none bg-slate-50/50">
            <CardContent className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <FileText className="h-6 w-6 text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-600">
                {search || dateRange
                  ? "Pembayaran tidak ditemukan"
                  : filterTab === "today"
                    ? "Belum ada transaksi hari ini"
                    : "Belum ada riwayat transaksi"}
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-[250px]">
                {search || dateRange
                  ? "Coba gunakan kata kunci atau rentang tanggal yang berbeda."
                  : "Riwayat pembayaran iuran Anda akan muncul di sini."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredPayments.map((payment) => {
              const status = getStatusConfig(payment.status);
              const StatusIcon = status.icon;
              const isNew = prevPaymentSeenAtRef.current != null &&
                new Date(payment.createdAt).getTime() > prevPaymentSeenAtRef.current;

              return (
                <Card
                  key={payment.id}
                  className="cursor-pointer shadow-sm hover:shadow-md transition-all hover:border-primary/30 group overflow-hidden"
                  onClick={() => navigate(`/dashboard/transaksi/${payment.id}`)}
                >
                  <CardContent className="p-0">
                    <div className="flex items-stretch">
                      {/* Status Color Accent Line */}
                      <div className={`w-1.5 shrink-0 ${payment.status === 'PAID' ? 'bg-emerald-500' :
                          payment.status === 'PENDING' ? 'bg-amber-400' :
                            payment.status === 'FAILED' ? 'bg-red-500' : 'bg-slate-300'
                        }`}></div>

                      {/* Flex Container Utama Card */}
                      <div className="flex-1 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">

                        {/* Kiri/Atas: Icon dan Info Order */}
                        <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                          {/* Icon Status */}
                          <div className="relative shrink-0 mt-0.5 sm:mt-0">
                            <div className={`h-10 w-10 sm:h-11 sm:w-11 rounded-xl ${status.bg} flex items-center justify-center`}>
                              <StatusIcon className={`h-5 w-5 sm:h-6 sm:w-6 ${status.color}`} />
                            </div>
                            {isNew && (
                              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500 ring-2 ring-white"></span>
                              </span>
                            )}
                          </div>

                          {/* Info Teks */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-slate-900 truncate group-hover:text-primary transition-colors">
                                {payment.orderId}
                              </p>
                              {isNew && (
                                <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-600 border border-sky-200 uppercase tracking-wide">
                                  Baru
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                              <p className="text-xs text-slate-500">
                                {formatDateTime(payment.createdAt)}
                              </p>
                              {payment.methodCategory && (
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-300 hidden sm:inline">&bull;</span>
                                  <span className="text-[10px] sm:text-xs font-medium text-slate-600 bg-slate-100 sm:bg-transparent px-1.5 py-0.5 sm:p-0 rounded-md">
                                    {getMethodLabel(payment.methodCategory)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Kanan/Bawah: Nominal dan Status Badge */}
                        <div className="flex items-center justify-between sm:flex-col sm:items-end sm:justify-center gap-2 pt-3 sm:pt-0 border-t border-slate-100 sm:border-0 shrink-0">
                          <p className="text-sm sm:text-base font-bold text-slate-900 font-poppins tracking-tight">
                            {formatRupiah(Number(payment.amount))}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge variant={status.variant} className={`text-[10px] px-2 py-0 ${(status as { badgeClassName?: string }).badgeClassName ?? ""}`}>
                              {status.label}
                            </Badge>
                            <ArrowRight className="h-4 w-4 text-slate-300 shrink-0 hidden sm:block group-hover:text-primary group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>

                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* === CONFIRM PAYMENT DIALOG === */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-poppins text-xl">
              {hasPendingPayment
                ? "Lanjutkan Pembayaran"
                : selectedMonthCount > 1
                  ? `Bayar ${selectedMonthCount} Bulan`
                  : "Konfirmasi Pembayaran"}
            </AlertDialogTitle>

            {/* Deskripsi hanya untuk teks singkat */}
            <AlertDialogDescription>
              {hasPendingPayment
                ? "Selesaikan transaksi Anda sebelumnya sebelum membuat yang baru."
                : "Mohon periksa kembali rincian tagihan iuran Anda di bawah ini."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* === KONTEN UTAMA (Di luar Description agar HTML valid) === */}
          <div className="py-2 space-y-4">
            {hasPendingPayment ? (
              <div className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 leading-relaxed">
                  Anda memiliki jendela pembayaran yang belum diselesaikan. Klik lanjutkan untuk membuka kembali halaman pembayaran.
                </p>
              </div>
            ) : (
              <>
                {/* Box Daftar Bulan */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
                    Iuran Bulan
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {monthGrid.months
                      .filter((m) => m.isChecked)
                      .map((m) => (
                        <div key={m.month} className="flex items-center gap-2">
                          <div className="h-4 w-4 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                            <Check className="h-2.5 w-2.5 text-emerald-600" />
                          </div>
                          <span className="text-sm font-medium text-slate-700">
                            {m.label} {m.year}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Rincian Tagihan (Breakdown) */}
                <div className="px-1 space-y-2.5">
                  {(bill?.baseBreakdown ?? bill?.breakdown ?? []).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Iuran {item.type} × {selectedMonthCount}</span>
                      <span className="font-semibold text-slate-700">
                        {formatRupiah(item.amount * selectedMonthCount)}
                      </span>
                    </div>
                  ))}

                  {/* Total */}
                  <div className="flex items-center justify-between pt-3 border-t border-dashed border-slate-200 mt-2">
                    <span className="text-sm font-bold text-slate-900">Total Tagihan</span>
                    <span className="text-lg font-bold text-primary">
                      {formatRupiah((bill?.baseMonthlyAmount || 0) * (hasPendingPayment ? 1 : selectedMonthCount))}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Banner Info Pembayaran */}
            <div className="flex items-center gap-3 p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
              <div className="p-2 bg-white rounded-lg shadow-sm border border-blue-50 shrink-0">
                <QrCode className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800">Mendukung QRIS & E-Wallet</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Diarahkan ke sistem Midtrans yang aman.</p>
              </div>
            </div>
          </div>

          {/* === FOOTER === */}
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel className="border-slate-200 text-slate-600 hover:bg-slate-50">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePayDues}
              className="bg-primary hover:bg-primary/90 text-white shadow-sm"
            >
              {hasPendingPayment ? (
                <>
                  <WalletCards className="h-4 w-4 mr-2" />
                  Lanjutkan Pembayaran
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Bayar Sekarang
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
