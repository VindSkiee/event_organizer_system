import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
} from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { Button } from "@/shared/ui/button";
import { Separator } from "@/shared/ui/separator";
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock,
  XCircle,
  Copy,
  ExternalLink,
  CreditCard,
  Calendar,
  CalendarDays,
  Hash,
  Wallet,
  User,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { financeService } from "@/features/finance/services/financeService";
import { paymentService } from "@/features/payment/services/paymentService";
import type { TransactionDetail } from "@/shared/types";

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
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusConfig(status: string) {
  switch (status) {
    case "PAID":
      return {
        label: "Pembayaran Berhasil",
        variant: "default" as const,
        icon: CheckCircle2,
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        border: "border-emerald-200",
        gradient: "from-emerald-500 to-teal-600",
        description: "Transaksi telah berhasil dan dana sudah diterima.",
      };
    case "PENDING":
      return {
        label: "Menunggu Pembayaran",
        variant: "outline" as const,
        icon: Clock,
        color: "text-amber-600",
        bg: "bg-amber-50",
        border: "border-amber-200",
        gradient: "from-amber-500 to-orange-500",
        description: "Silakan selesaikan pembayaran Anda sebelum batas waktu.",
        badgeClassName: "bg-yellow-50 text-yellow-700 border-yellow-200",
      };
    case "FAILED":
      return {
        label: "Pembayaran Gagal",
        variant: "destructive" as const,
        icon: XCircle,
        color: "text-red-600",
        bg: "bg-red-50",
        border: "border-red-200",
        gradient: "from-red-500 to-rose-600",
        description: "Transaksi gagal diproses. Silakan coba lagi.",
      };
    case "EXPIRED":
      return {
        label: "Kedaluwarsa",
        variant: "outline" as const,
        icon: Clock,
        color: "text-slate-500",
        bg: "bg-slate-50",
        border: "border-slate-200",
        gradient: "from-slate-400 to-slate-500",
        description: "Batas waktu pembayaran telah habis.",
      };
    case "CANCELLED":
      return {
        label: "Dibatalkan",
        variant: "outline" as const,
        icon: XCircle,
        color: "text-slate-500",
        bg: "bg-slate-50",
        border: "border-slate-200",
        gradient: "from-slate-400 to-slate-500",
        description: "Transaksi ini telah dibatalkan.",
      };
    default:
      return {
        label: status,
        variant: "outline" as const,
        icon: Clock,
        color: "text-slate-500",
        bg: "bg-slate-50",
        border: "border-slate-200",
        gradient: "from-slate-400 to-slate-500",
        description: "",
      };
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

function getProviderLabel(provider?: string): string {
  const labels: Record<string, string> = {
    bca: "BCA",
    bni: "BNI",
    bri: "BRI",
    mandiri: "Mandiri",
    permata: "Permata",
    gopay: "GoPay",
    shopeepay: "ShopeePay",
    qris: "QRIS",
    credit_card: "Kartu Kredit",
    cstore: "Minimarket",
  };
  return labels[provider || ""] || provider || "-";
}

const MONTH_NAMES_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function getMonthRangeLabel(
  startMonth: number,
  startYear: number,
  monthCount: number,
): { rangeLabel: string; isFullYear: boolean } {
  let endMonth = startMonth + monthCount - 1;
  let endYear = startYear;
  while (endMonth > 12) { endMonth -= 12; endYear += 1; }

  const isFullYear = monthCount === 12;
  const startLabel = `${MONTH_NAMES_ID[startMonth - 1]} ${startYear}`;
  const endLabel = `${MONTH_NAMES_ID[endMonth - 1]} ${endYear}`;
  // Same year: omit year from start label for brevity
  const rangeLabel = monthCount === 1
    ? startLabel
    : endYear === startYear
      ? `${MONTH_NAMES_ID[startMonth - 1]} – ${endLabel}`
      : `${startLabel} – ${endLabel}`;
  return { rangeLabel, isFullYear };
}

function isIncome(type: string) {
  return type === "INCOME" || type === "CREDIT";
}

// === MAIN COMPONENT ===

export default function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await financeService.getTransactionDetail(id);
      setDetail(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal memuat detail transaksi";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleSyncStatus = async () => {
    if (!detail?.paymentGatewayTx?.orderId) return;
    setSyncing(true);
    try {
      const result = await paymentService.syncPayment(detail.paymentGatewayTx.orderId);
      if (result.updated) {
        toast.success(`Status diperbarui: ${result.status}`);
        await fetchDetail();
      } else {
        toast.info(result.message || "Pembayaran masih pending di Midtrans.");
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err instanceof Error ? err.message : "Gagal mengecek status");
      toast.error(msg);
    } finally {
      setSyncing(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${label} berhasil disalin`);
    });
  };

  const goBack = () => {
    navigate(-1);
  };

  // === LOADING STATE ===
  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  // === ERROR / NOT FOUND STATE ===
  if (error || !detail) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <ArrowLeft className="h-4 w-4 mr-1" onClick={goBack} />
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <XCircle className="h-12 w-12 text-slate-300 mb-4" />
            <p className="text-lg font-semibold text-slate-600 font-poppins">
              Transaksi Tidak Ditemukan
            </p>
            <p className="text-sm text-slate-400 mt-1 max-w-sm">
              {error || "Data transaksi yang Anda cari tidak tersedia atau Anda tidak memiliki akses."}
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={goBack}>
              Kembali
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pgTx = detail.paymentGatewayTx;
  const hasPaymentGateway = !!pgTx;
  const income = isIncome(detail.type);

  // The transaction's own amount (may be a split portion of the full resident payment)
  const txAmount = Math.abs(detail.amount);
  // Total paid by resident via gateway (may differ from txAmount for split dues transactions)
  const gatewayAmount = pgTx?.amount ?? txAmount;

  // Detect if this is a split-dues transaction (RT + RW distribution)
  const isSplitDues = hasPaymentGateway && Math.round(gatewayAmount) !== Math.round(txAmount);

  // If the current logged-in user IS the payer (RESIDENT viewing their own payment),
  // always show the full gateway amount — they want to see what they paid, not the internal split.
  const currentUserId = (() => {
    try { return (JSON.parse(localStorage.getItem("user") || "{}") as { id?: string }).id ?? null; }
    catch { return null; }
  })();
  const isOwnPayment = !!pgTx?.user?.id && currentUserId === pgTx.user.id;

  // Primary display amount: full payment for payer/PENDING, wallet portion for staff
  const displayAmount = (isOwnPayment || !isSplitDues) ? gatewayAmount : txAmount;

  // For gateway transactions, use payment status; for manual, no gradient banner
  const status = pgTx ? getStatusConfig(pgTx.status) : null;
  const StatusIcon = status?.icon || CheckCircle2;

  // Determine the payer info — prefer paymentGatewayTx.user, fallback to contribution.user, then createdBy
  const payer = pgTx?.user || detail.contribution?.user || detail.createdBy;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">

        <ArrowLeft className="h-4 w-4 mr-1" onClick={goBack} />

        <h1 className="text-xl sm:text-2xl font-bold font-poppins text-slate-900">
          Detail Transaksi
        </h1>
      </div>

      {/* Status Banner */}
      {hasPaymentGateway && status ? (
        <Card className={`bg-gradient-to-r overflow-hidden ${status.gradient}`}>
          <div className="p-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <StatusIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold font-poppins">{status.label}</h2>
                <p className="text-sm text-white/80">{status.description}</p>
              </div>
            </div>
            <div className="mt-4 text-center">
              <p className="text-sm text-white/70 uppercase tracking-wide">
                {(isSplitDues && !isOwnPayment) ? "Dana Masuk ke Kas" : "Jumlah Pembayaran"}
              </p>
              <p className="text-3xl sm:text-4xl font-bold font-poppins mt-1">
                {formatRupiah(displayAmount)}
              </p>
              {(isSplitDues && !isOwnPayment) && (
                <p className="text-sm text-white/70 mt-1">
                  Total dibayar warga: {formatRupiah(gatewayAmount)}
                </p>
              )}
            </div>
          </div>
        </Card>
      ) : (
        /* Manual / Non-gateway Transaction — income/expense banner */
        <Card
          className={`border-l-4 ${
            income ? "border-l-emerald-500" : "border-l-red-500"
          }`}
        >
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <div
                className={`h-14 w-14 rounded-xl flex items-center justify-center ${
                  income ? "bg-emerald-100" : "bg-red-100"
                }`}
              >
                {income ? (
                  <ArrowDownLeft className="h-7 w-7 text-emerald-600" />
                ) : (
                  <ArrowUpRight className="h-7 w-7 text-red-600" />
                )}
              </div>
              <div>
                <p className="text-sm text-slate-500">
                  {income ? "Pemasukan" : "Pengeluaran"}
                </p>
                <p
                  className={`text-3xl sm:text-4xl font-bold ${
                    income ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {income ? "+" : "-"}
                  {formatRupiah(Math.abs(detail.amount))}
                </p>
                <p className="text-sm text-slate-500 mt-1">{detail.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction Details */}
      <Card>
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
              Informasi Transaksi
            </h3>
          </div>

          <Separator />

          {/* User Info */}
          {payer && (
            <>
              <div className="flex items-center gap-2.5">
                <User className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Pembayar</p>
                  <p className="text-sm font-medium text-slate-900">{payer.fullName}</p>
                  <p className="text-xs text-slate-400">{payer.email}</p>
                </div>
              </div>
            </>
          )}

          {/* Status */}
          {hasPaymentGateway && status ? (
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 text-slate-400 shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Status</p>
                <Badge variant={status.variant} className={`mt-0.5 ${(status as { badgeClassName?: string }).badgeClassName ?? ""}`}>
                  {status.label}
                </Badge>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 text-slate-400 shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Tipe</p>
                <Badge variant={income ? "default" : "destructive"} className="mt-0.5">
                  {income ? "Pemasukan" : "Pengeluaran"}
                </Badge>
              </div>
            </div>
          )}

          {/* Amount */}
          <div className="flex items-center gap-2.5">
            <Wallet className="h-4 w-4 text-slate-400 shrink-0" />
            <div>
              <p className="text-xs text-slate-500">
                {(isSplitDues && !isOwnPayment) ? "Dana Masuk ke Kas" : "Jumlah"}
              </p>
              <p className="text-sm font-semibold text-slate-900">{formatRupiah(displayAmount)}</p>
              {(isSplitDues && !isOwnPayment) && (
                <p className="text-xs text-slate-500 mt-0.5">
                  Total dibayar warga: <span className="font-medium text-slate-700">{formatRupiah(gatewayAmount)}</span>
                </p>
              )}
              {pgTx && pgTx.grossAmount && Math.round(pgTx.grossAmount) !== Math.round(gatewayAmount) && (
                <p className="text-xs text-slate-400">
                  Gross: {formatRupiah(pgTx.grossAmount)}
                </p>
              )}
            </div>
          </div>

          {/* Destination group for split dues */}
          {(isSplitDues && !isOwnPayment) && detail.group && (
            <div className="flex items-center gap-2.5">
              <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Destinasi Kas</p>
                <p className="text-sm font-medium text-slate-900">{detail.group.name}</p>
                <p className="text-xs text-slate-400">{detail.description}</p>
              </div>
            </div>
          )}

          {/* Periode Iuran — for DUES payments */}
          {pgTx && pgTx.orderId.startsWith("DUES-") && (() => {
            const mc = pgTx.monthCount ?? 1;

            // PAID: contribution is set (first month linked to this pgTx)
            if (pgTx.contribution) {
              const { rangeLabel, isFullYear } = getMonthRangeLabel(
                pgTx.contribution.month,
                pgTx.contribution.year,
                mc,
              );
              return (
                <div className="flex items-start gap-2.5">
                  <CalendarDays className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500">Periode Iuran</p>
                    <p className="text-sm font-semibold text-slate-900">{rangeLabel}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-slate-500">{mc} bulan</p>
                      {isFullYear && (
                        <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
                          Setahun Penuh 🎉
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            // PENDING: no contribution yet — show month count only
            return (
              <div className="flex items-start gap-2.5">
                <CalendarDays className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500">Periode Iuran</p>
                  <p className="text-sm font-semibold text-slate-900">{mc} bulan</p>
                  <p className="text-xs text-slate-400 mt-0.5">Periode dikonfirmasi setelah pembayaran selesai.</p>
                </div>
              </div>
            );
          })()}

          {/* Contribution period for non-gateway transactions */}
          {!pgTx && detail.contribution && (() => {
            const { rangeLabel } = getMonthRangeLabel(
              detail.contribution.month,
              detail.contribution.year,
              1,
            );
            return (
              <div className="flex items-start gap-2.5">
                <CalendarDays className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500">Periode Iuran</p>
                  <p className="text-sm font-semibold text-slate-900">{rangeLabel}</p>
                </div>
              </div>
            );
          })()}

          <Separator />

          {/* Payment Method */}
          {pgTx?.methodCategory && (
            <div className="flex items-center gap-2.5">
              <CreditCard className="h-4 w-4 text-slate-400 shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Metode Pembayaran</p>
                <p className="text-sm font-medium text-slate-900">
                  {getMethodLabel(pgTx.methodCategory)}
                  {pgTx.providerCode && (
                    <span className="text-slate-500"> — {getProviderLabel(pgTx.providerCode)}</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* VA Number */}
          {pgTx?.vaNumber && (
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <CreditCard className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Nomor Virtual Account</p>
                  <p className="text-sm font-mono font-medium text-slate-900 break-all">{pgTx.vaNumber}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => copyToClipboard(pgTx.vaNumber!, "No. VA")}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* Midtrans Transaction ID */}
          {pgTx?.midtransId && (
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <ExternalLink className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Midtrans Transaction ID</p>
                  <p className="text-sm font-medium text-black break-all">{pgTx.midtransId}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => copyToClipboard(pgTx.midtransId!, "Transaction ID")}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* Order ID */}
          {pgTx && (
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <Hash className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Order ID</p>
                  <p className="text-sm font-medium text-slate-900 break-all">{pgTx.orderId}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => copyToClipboard(pgTx.orderId, "Order ID")}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          <Separator />

          {/* Dates */}
          <div className="flex items-center gap-2.5">
            <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
            <div>
              <p className="text-xs text-slate-500">Tanggal Transaksi</p>
              <p className="text-sm font-medium text-slate-900">{formatDateTime(detail.createdAt)}</p>
            </div>
          </div>

          {pgTx?.paidAt && (
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Tanggal Pembayaran</p>
                <p className="text-sm font-medium text-emerald-700">{formatDateTime(pgTx.paidAt)}</p>
              </div>
            </div>
          )}

        </CardContent>
      </Card>

      {/* Action Button — Resume payment if PENDING */}
      {pgTx && pgTx.status === "PENDING" && status && (
        <Card className={`${status.border} ${status.bg}`}>
          <CardContent className="py-4 px-5 space-y-3">
            <div className="flex items-start gap-2.5">
              <Clock className={`h-5 w-5 ${status.color} mt-0.5 shrink-0`} />
              <div>
                <p className="text-sm font-semibold text-slate-800">Selesaikan Pembayaran</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sudah bayar tapi status masih pending? Klik "Cek Status" untuk memperbarui.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              {/* Sync / Cek Status button — polls Midtrans directly */}
              <Button
                variant="outline"
                size="sm"
                className="border-amber-400 text-amber-700 hover:bg-amber-50"
                onClick={handleSyncStatus}
                disabled={syncing}
              >
                <RefreshCw className={`h-4 w-4 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Mengecek..." : "Cek Status Pembayaran"}
              </Button>
              {/* Resume payment button */}
              {pgTx.redirectUrl && (
                <Button
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => window.open(pgTx.redirectUrl!, "_blank")}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Lanjutkan Bayar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer Note */}
      {hasPaymentGateway && (
        <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pb-4">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Pembayaran diproses secara aman melalui Midtrans</span>
        </div>
      )}
    </div>
  );
}
