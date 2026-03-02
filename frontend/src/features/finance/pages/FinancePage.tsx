import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import {
  Wallet,
  Search,
  Clock,
  Loader2,
  Banknote,
  TrendingUp,
  Settings,
  Plus,
  Users,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { financeService } from "@/features/finance/services/financeService";
import { fundRequestService } from "@/features/finance/services/fundRequestService";
import { eventService } from "@/features/event/services/eventService";
import type {
  WalletDetail,
  Transaction,
  FundRequest,
  ChildWalletInfo,
  EventItem,
} from "@/shared/types";
import { TransactionTable, FundRequestTable, ChildrenWalletsSection } from "@/features/finance/components";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { DateRangeFilter } from "@/shared/components/DateRangeFilter";
import type { DateRange } from "@/shared/components/DateRangeFilter";
import { markAsSeen } from "@/shared/helpers/seenPagesStore";
import { invalidateBadgeCache } from "@/shared/hooks/useBadgeNotifications";
import { emitSidebarUpdate } from "@/shared/helpers/sidebarEvents";

// === HELPERS ===

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

export default function FinancePage() {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState<WalletDetail | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [fundRequests, setFundRequests] = useState<FundRequest[]>([]);
  const [childrenWallets, setChildrenWallets] = useState<ChildWalletInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [searchTx, setSearchTx] = useState("");
  const [filterTabTx, setFilterTabTx] = useState<"today" | "all">("today");
  const [dateRangeTx, setDateRangeTx] = useState<DateRange | undefined>(undefined);
  const [searchFR, setSearchFR] = useState("");

  // Check role from localStorage
  const userRole = (() => {
    try {
      const stored = localStorage.getItem("user");
      if (stored) return JSON.parse(stored).role;
    } catch { /* ignore */ }
    return null;
  })();

  // Only Leader and RW-level Treasurer can see all RT wallets
  // Admin and RT-level Treasurer should NOT see children wallets
  const isRwLevel = userRole === "LEADER";
  const canCreateTransaction = userRole === "TREASURER" || userRole === "LEADER";
  const canCreateFundRequest = userRole === "TREASURER" || userRole === "ADMIN";

  // Reject Dialog
  const [selectedFR, setSelectedFR] = useState<FundRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectDecision, setRejectDecision] = useState("CONTINUE_WITH_ORIGINAL");
  const [submitting, setSubmitting] = useState(false);
  const [pendingApproveFR, setPendingApproveFR] = useState<FundRequest | null>(null);

  // Manual Transaction Dialog
  const [showTxDialog, setShowTxDialog] = useState(false);
  const [txType, setTxType] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [txAmount, setTxAmount] = useState("");
  const [txDescription, setTxDescription] = useState("");
  const [txSubmitting, setTxSubmitting] = useState(false);

  // Fund Request Dialog
  const [showFRDialog, setShowFRDialog] = useState(false);
  const [frAmount, setFrAmount] = useState("");
  const [frDescription, setFrDescription] = useState("");
  const [frEventId, setFrEventId] = useState("");
  const [frSubmitting, setFrSubmitting] = useState(false);
  const [events, setEvents] = useState<EventItem[]>([]);

  // Dues rule badge – check if config missing
  const [duesNotConfigured, setDuesNotConfigured] = useState(false);

  // Role-aware paths
  // Role-aware paths
  const showDuesConfig = userRole !== "TREASURER";
  const duesConfigPath = userRole === "ADMIN" ? "/dashboard/pengaturan-iuran" : "/dashboard/pengaturan-iuran";

  // Track "new since last visit" — set on mount before fetching
  const prevFinanceSeenAtRef = useRef<number | null>(null);

  // Transaction detail path (single shared route for all roles)
  const txDetailPrefix = "transaksi";

  // === UBAH BAGIAN INI ===
  // Sekarang Treasurer, Admin, dan Leader akan sama-sama diarahkan ke /dashboard/keuangan-rt
  const childrenBasePath = "/dashboard/keuangan-rt"; 
  
  const isChildTreasurer = userRole === "TREASURER" && wallet?.communityGroup?.type === "RT";
  const isRwTreasurer = userRole === "TREASURER" && wallet?.communityGroup?.type === "RW";
  const showChildrenWallets = isRwLevel || isRwTreasurer;

  useEffect(() => {
    // Mark this page as seen so badge clears immediately
    prevFinanceSeenAtRef.current = markAsSeen("finance");
    invalidateBadgeCache();
    emitSidebarUpdate();

    fetchData();
    if (canCreateFundRequest) fetchEvents();
    if (showDuesConfig) {
      financeService.getDuesConfig()
        .then((cfg) => {
          // Only badge for OWN duesRule — user can only configure their own level
          setDuesNotConfigured(!cfg.duesRule);
        })
        .catch(() => { /* non-critical */ });
    }
  }, []);

  // Fetch children wallets after wallet is loaded (so we know if RW-level)
  useEffect(() => {
    if (wallet && (isRwLevel || (userRole === "TREASURER" && wallet.communityGroup?.type === "RW"))) {
      fetchChildrenWallets();
    }
  }, [wallet]);

  const fetchEvents = async () => {
    try {
      const data = await eventService.getAll();
      setEvents(data);
    } catch { /* non-critical */ }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [walletRes, txRes, frRes] = await Promise.allSettled([
        financeService.getWalletDetails(),
        financeService.getTransactions(),
        fundRequestService.getAll(),
      ]);

      if (walletRes.status === "fulfilled") setWallet(walletRes.value);
      if (txRes.status === "fulfilled") setTransactions(txRes.value);
      if (frRes.status === "fulfilled") setFundRequests(frRes.value);

      const failures = [walletRes, txRes, frRes].filter((r) => r.status === "rejected");
      if (failures.length > 0) toast.error("Sebagian data keuangan gagal dimuat.");
    } catch {
      toast.error("Gagal memuat data keuangan.");
    } finally {
      setLoading(false);
    }
  };

  const fetchChildrenWallets = async () => {
    setLoadingChildren(true);
    try {
      const data = await financeService.getChildrenWallets();
      setChildrenWallets(data.children);
    } catch {
      // Non-critical: children wallets may not be available for all roles
    } finally {
      setLoadingChildren(false);
    }
  };

  const pendingFR = fundRequests.filter((f) => f.status === "PENDING");

  const filteredTx = transactions.filter((t) => {
    const matchSearch = t.description.toLowerCase().includes(searchTx.toLowerCase());
    if (!matchSearch) return false;
    const txDate = new Date(t.createdAt);
    if (filterTabTx === "today") {
      const today = new Date();
      if (
        txDate.getDate() !== today.getDate() ||
        txDate.getMonth() !== today.getMonth() ||
        txDate.getFullYear() !== today.getFullYear()
      ) return false;
    }
    if (dateRangeTx?.from) {
      const d = new Date(txDate);
      d.setHours(0, 0, 0, 0);
      const from = new Date(dateRangeTx.from);
      from.setHours(0, 0, 0, 0);
      if (d < from) return false;
      if (dateRangeTx.to) {
        const to = new Date(dateRangeTx.to);
        to.setHours(23, 59, 59, 999);
        if (d > to) return false;
      }
    }
    return true;
  });

  const filteredFR = fundRequests.filter(
    (f) =>
      f.description.toLowerCase().includes(searchFR.toLowerCase()) ||
      (f.communityGroup?.name || "").toLowerCase().includes(searchFR.toLowerCase())
  );

  // === Handle Approve Fund Request ===
  const handleApproveFR = (fr: FundRequest) => {
    setPendingApproveFR(fr);
  };

  const executeApproveFR = async () => {
    if (!pendingApproveFR) return;
    const fr = pendingApproveFR;
    setPendingApproveFR(null);
    try {
      await fundRequestService.approve(fr.id);
      toast.success("Pengajuan dana berhasil disetujui!");
      fetchData();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || "Gagal menyetujui pengajuan dana.");
    }
  };

  // === Handle Reject Fund Request ===
  const handleRejectFR = async () => {
    if (!selectedFR) return;
    if (!rejectReason.trim()) {
      toast.error("Alasan penolakan wajib diisi.");
      return;
    }
    setSubmitting(true);
    try {
      await fundRequestService.reject(selectedFR.id, {
        reason: rejectReason,
        rwDecision: rejectDecision,
      });
      toast.success("Pengajuan dana berhasil ditolak.");
      setSelectedFR(null);
      setRejectReason("");
      fetchData();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || "Gagal menolak pengajuan dana.");
    } finally {
      setSubmitting(false);
    }
  };

  // === Handle Create Manual Transaction ===
  const handleCreateTransaction = async () => {
    const amount = Number(txAmount);
    if (!amount || amount < 1000) {
      toast.error("Jumlah minimal Rp 1.000.");
      return;
    }
    if (!txDescription.trim()) {
      toast.error("Deskripsi wajib diisi.");
      return;
    }
    setTxSubmitting(true);
    try {
      await financeService.createTransaction({
        type: txType,
        amount,
        description: txDescription,
      });
      toast.success("Transaksi berhasil dicatat!");
      setShowTxDialog(false);
      setTxAmount("");
      setTxDescription("");
      fetchData();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || "Gagal mencatat transaksi.");
    } finally {
      setTxSubmitting(false);
    }
  };

  // === Handle Create Fund Request ===
  const handleCreateFR = async () => {
    const amount = Number(frAmount);
    if (!amount || amount < 1) {
      toast.error("Jumlah harus lebih dari 0.");
      return;
    }
    if (!frDescription.trim()) {
      toast.error("Deskripsi wajib diisi.");
      return;
    }
    setFrSubmitting(true);
    try {
      await fundRequestService.create({
        amount,
        description: frDescription,
        eventId: frEventId || undefined,
      });
      toast.success("Pengajuan dana berhasil dibuat!");
      setShowFRDialog(false);
      setFrAmount("");
      setFrDescription("");
      setFrEventId("");
      fetchData();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || "Gagal mengajukan dana.");
    } finally {
      setFrSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-poppins text-slate-900">
            Kas & Keuangan
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">
            Kelola kas, transaksi, dan pengajuan dana.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {canCreateTransaction && (
            <Button
              variant="outline"
              onClick={() => setShowTxDialog(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Catat Transaksi</span>
            </Button>
          )}
          {showDuesConfig && (
            <Button
              onClick={() => navigate(duesConfigPath)}
              className="gap-2 relative"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Atur Pembayaran</span>
              {duesNotConfigured && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-lg ring-2 ring-white">!</span>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Wallet Card */}
      <Card className="bg-gradient-to-br from-primary to-primary/80 text-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-white/80 font-poppins">
            Saldo Kas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-10 w-40 bg-white/20" />
          ) : (
            <>
              <div className="text-3xl sm:text-4xl font-bold">
                {wallet ? formatRupiah(wallet.balance) : "Rp 0"}
              </div>
              <p className="text-sm text-white/70 mt-1">
                {wallet?.communityGroup?.name || "—"} · Diperbarui{" "}
                {wallet ? formatDate(wallet.updatedAt) : "—"}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-slate-600 font-poppins">
              Transaksi
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-12" /> : (
              <div className="text-2xl font-bold text-slate-900">{transactions.length}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-slate-600 font-poppins">
              Pengajuan Dana
            </CardTitle>
            <Banknote className="h-4 w-4 text-brand-green" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-12" /> : (
              <div className="text-2xl font-bold text-slate-900">{fundRequests.length}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-slate-600 font-poppins">
              Menunggu
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-12" /> : (
              <div className="text-2xl font-bold text-amber-600">{pendingFR.length}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dues Progress Quick Access — Child TREASURER only */}
      {isChildTreasurer && wallet && (
        <Card
          className="cursor-pointer border-primary/20 hover:border-primary/50 hover:shadow-md transition-all"
          onClick={() => navigate(`/dashboard/progres-iuran-bendahara/${wallet.communityGroup.id}`)}
        >
          <CardContent className="flex items-center gap-4 py-5">
            <div className="rounded-xl bg-primary/10 p-3">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 font-poppins">Progres Iuran Warga</p>
              <p className="text-sm text-slate-500">Lihat progres pembayaran kas {wallet.communityGroup.name}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400" />
          </CardContent>
        </Card>
      )}

      {/* Children Wallets — visible for LEADER / ADMIN / TREASURER */}
      {showChildrenWallets && (
        <ChildrenWalletsSection
          wallets={childrenWallets}
          loading={loadingChildren}
          basePath={childrenBasePath}
        />
      )}

      {/* Tabs: Transaksi / Pengajuan Dana */}
      <Tabs defaultValue="transaksi" className="space-y-4">
        <div className="overflow-x-auto -mx-1 px-1 pb-0.5">
          <TabsList className="w-max">
            <TabsTrigger value="transaksi">Riwayat Transaksi</TabsTrigger>
            {userRole !== "LEADER" && (
              <TabsTrigger value="pengajuan">
                Pengajuan Dana {pendingFR.length > 0 && `(${pendingFR.length})`}
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* === TAB: Transaksi === */}
        <TabsContent value="transaksi" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
            <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
              <button
                onClick={() => { setFilterTabTx("today"); setDateRangeTx(undefined); }}
                className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  filterTabTx === "today" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Hari Ini
              </button>
              <button
                onClick={() => setFilterTabTx("all")}
                className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  filterTabTx === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Semua
              </button>
            </div>
            {filterTabTx === "all" && (
              <DateRangeFilter
                value={dateRangeTx}
                onChange={setDateRangeTx}
                placeholder="Filter tanggal"
              />
            )}
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Cari transaksi..."
                value={searchTx}
                onChange={(e) => setSearchTx(e.target.value)}
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
                  {searchTx ? "Transaksi tidak ditemukan." : filterTabTx === "today" ? "Belum ada transaksi hari ini." : "Belum ada transaksi."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <TransactionTable
                transactions={filteredTx}
                onRowClick={(tx) => navigate(`/dashboard/${txDetailPrefix}/${tx.id}`)}
                newSinceMs={prevFinanceSeenAtRef.current}
              />
            </Card>
          )}
        </TabsContent>

        {/* === TAB: Pengajuan Dana === */}
        <TabsContent value="pengajuan" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Cari pengajuan..."
                value={searchFR}
                onChange={(e) => setSearchFR(e.target.value)}
                className="pl-9"
              />
            </div>
            {canCreateFundRequest && (
              <Button onClick={() => setShowFRDialog(true)} className="gap-2 shrink-0">
                <Plus className="h-4 w-4" /> Ajukan Dana
              </Button>
            )}
          </div>

          {loading ? (
            <Card>
              <CardContent className="py-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </CardContent>
            </Card>
          ) : filteredFR.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                <Banknote className="h-10 w-10 text-slate-300 mb-3" />
                <p className="text-sm text-slate-500 font-medium">
                  {searchFR ? "Pengajuan tidak ditemukan." : "Belum ada pengajuan dana."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <FundRequestTable
                fundRequests={filteredFR}
                canApprove={isRwTreasurer}
                onApprove={handleApproveFR}
                onReject={(fr) => {
                  setSelectedFR(fr);
                  setRejectReason("");
                }}
                onRowClick={(fr) => navigate(`/dashboard/pengajuan-dana/${fr.id}`)}
              />
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* === Reject Fund Request Dialog === */}
      <Dialog
        open={!!selectedFR}
        onOpenChange={(open) => {
          if (!open) setSelectedFR(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-poppins">Tolak Pengajuan Dana</DialogTitle>
            <DialogDescription>
              Anda akan menolak pengajuan dana sebesar{" "}
              {selectedFR ? formatRupiah(selectedFR.amount) : "—"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {selectedFR && (
              <div className="rounded-lg bg-slate-50 p-3 space-y-1">
                <p className="text-sm font-medium text-slate-900">
                  {selectedFR.description}
                </p>
                <p className="text-xs text-slate-500">
                  Dari: {selectedFR.communityGroup?.name || "—"}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="reject-reason">Alasan Penolakan *</Label>
              <Textarea
                id="reject-reason"
                placeholder="Jelaskan alasan penolakan..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Keputusan RW</Label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="rwDecision"
                    value="CONTINUE_WITH_ORIGINAL"
                    checked={rejectDecision === "CONTINUE_WITH_ORIGINAL"}
                    onChange={(e) => setRejectDecision(e.target.value)}
                    className="accent-primary"
                  />
                  <span className="text-sm">Lanjutkan Acara</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="rwDecision"
                    value="CANCEL_EVENT"
                    checked={rejectDecision === "CANCEL_EVENT"}
                    onChange={(e) => setRejectDecision(e.target.value)}
                    className="accent-primary"
                  />
                  <span className="text-sm">Batalkan Acara</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedFR(null)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectFR}
              disabled={submitting}
            >
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Tolak Pengajuan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Manual Transaction Dialog === */}
      <Dialog open={showTxDialog} onOpenChange={setShowTxDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-poppins">Catat Transaksi Manual</DialogTitle>
            <DialogDescription>
              Tambahkan pencatatan pemasukan atau pengeluaran kas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Tipe Transaksi *</Label>
              <Select value={txType} onValueChange={(v) => setTxType(v as "CREDIT" | "DEBIT")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CREDIT">Pemasukan (CREDIT)</SelectItem>
                  <SelectItem value="DEBIT">Pengeluaran (DEBIT)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tx-amount">Jumlah (min Rp 1.000) *</Label>
              <Input
                id="tx-amount"
                type="number"
                placeholder="Contoh: 50000"
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
                min={1000}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tx-desc">Deskripsi *</Label>
              <Textarea
                id="tx-desc"
                placeholder="Jelaskan transaksi ini..."
                value={txDescription}
                onChange={(e) => setTxDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTxDialog(false)}>
              Batal
            </Button>
            <Button onClick={handleCreateTransaction} disabled={txSubmitting}>
              {txSubmitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Simpan Transaksi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Create Fund Request Dialog === */}
      <Dialog open={showFRDialog} onOpenChange={setShowFRDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-poppins">Ajukan Dana</DialogTitle>
            <DialogDescription>
              Buat pengajuan dana dari RT ke RW.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="fr-amount">Jumlah (Rp) *</Label>
              <Input
                id="fr-amount"
                type="number"
                placeholder="Contoh: 500000"
                value={frAmount}
                onChange={(e) => setFrAmount(e.target.value)}
                min={1}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fr-desc">Deskripsi *</Label>
              <Textarea
                id="fr-desc"
                placeholder="Jelaskan keperluan pengajuan dana..."
                value={frDescription}
                onChange={(e) => setFrDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Kegiatan Terkait (opsional)</Label>
              <Select value={frEventId} onValueChange={setFrEventId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kegiatan (opsional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tidak Ada</SelectItem>
                  {events
                    .filter((e) => e.status === "FUNDED" || e.status === "ONGOING")
                    .map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFRDialog(false)}>
              Batal
            </Button>
            <Button onClick={handleCreateFR} disabled={frSubmitting}>
              {frSubmitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Ajukan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pendingApproveFR}
        onOpenChange={(v) => { if (!v) setPendingApproveFR(null); }}
        title="Setujui Pengajuan Dana"
        description={`Yakin ingin menyetujui pengajuan dana sebesar ${pendingApproveFR ? formatRupiah(pendingApproveFR.amount) : ""}? Tindakan ini akan langsung memproses transfer dana.`}
        confirmLabel="Ya, Setujui"
        variant="default"
        onConfirm={executeApproveFR}
      />
    </div>
  );
}
