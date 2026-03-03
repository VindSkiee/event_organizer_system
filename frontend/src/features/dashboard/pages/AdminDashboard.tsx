import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import {
  Users,
  CalendarDays,
  Wallet,
  Banknote,
  ArrowRight,
  FileText,
  AlertCircle,
  Settings,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/shared/ui/button";
import { toast } from "sonner";
import { financeService } from "@/features/finance/services/financeService";
import { eventService } from "@/features/event/services/eventService";
import { userService } from "@/shared/services/userService";
import { fundRequestService } from "@/features/finance/services/fundRequestService";
import { RecentEventsCard } from "@/features/dashboard/components";
import type {
  WalletDetail,
  EventItem,
  UserItem,
  FundRequest,
} from "@/shared/types";

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState<WalletDetail | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [fundRequests, setFundRequests] = useState<FundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [duesRuleNotSet, setDuesRuleNotSet] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [walletRes, eventsRes, usersRes, frRes] =
          await Promise.allSettled([
            financeService.getWalletDetails(),
            eventService.getAll(),
            userService.getAll(),
            fundRequestService.getAll(),
          ]);

        if (walletRes.status === "fulfilled") setWallet(walletRes.value);
        if (eventsRes.status === "fulfilled") setEvents(eventsRes.value);
        if (usersRes.status === "fulfilled") setUsers(usersRes.value);
        if (frRes.status === "fulfilled") setFundRequests(frRes.value);

        const failures = [walletRes, eventsRes, usersRes, frRes].filter(
          (r) => r.status === "rejected"
        );
        if (failures.length > 0 && failures.length < 4) {
          toast.error("Sebagian data gagal dimuat.");
        } else if (failures.length === 4) {
          toast.error("Gagal memuat data dashboard.");
        }
      } catch {
        toast.error("Terjadi kesalahan saat memuat dashboard.");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();

    // Check dues rule config
    financeService.getDuesConfig()
      .then((cfg) => setDuesRuleNotSet(!cfg.duesRule))
      .catch(() => { /* non-critical */ });
  }, []);

  const activeEvents = events.filter(
    (e) => e.status === "APPROVED" || e.status === "ONGOING"
  );
  const pendingFR = fundRequests.filter((f) => f.status === "PENDING");

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold font-poppins text-slate-900 tracking-tight">
          Dashboard{" "}
          <span className="text-brand-green">
            {wallet?.communityGroup?.name || "RT"}
          </span>
        </h1>
        <p className="text-sm sm:text-base text-slate-500 mt-1">
          Kelola warga, kegiatan, dan keuangan RT Anda.
        </p>
      </div>

      {/* Dues Rule Alert */}
      {loading ? null : duesRuleNotSet && (
        <Card className="relative overflow-hidden border-0 ring-1 ring-amber-200/60 bg-white shadow-sm rounded-2xl">
          <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-amber-400"></div>
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-4 flex-1">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
                  <AlertCircle className="h-6 w-6" strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 font-poppins tracking-tight">
                    Biaya Pembayaran Belum Diatur
                  </h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Anda belum mengatur biaya iuran untuk RT Anda. Warga belum bisa melihat tagihan.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => navigate("/dashboard/pengaturan-iuran")}
                className="gap-2 shrink-0"
              >
                <Settings className="h-4 w-4" />
                Atur Sekarang
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          {
            title: "Warga",
            icon: <Users className="h-4 w-4" />,
            iconBg: "bg-primary/10 text-primary",
            value: String(users.length),
            sub: "Terdaftar dalam sistem",
          },
          {
            title: "Saldo Kas",
            icon: <Wallet className="h-4 w-4" />,
            iconBg: "bg-emerald-100 text-emerald-600",
            value: wallet ? formatRupiah(wallet.balance) : "Rp 0",
            valueColor: "text-slate-900",
          },
          {
            title: "Kegiatan Aktif",
            icon: <CalendarDays className="h-4 w-4" />,
            iconBg: "bg-blue-100 text-blue-600",
            value: String(activeEvents.length),
            sub: "Sedang berjalan",
          },
          {
            title: "Pengajuan Dana",
            icon: <FileText className="h-4 w-4" />,
            iconBg: "bg-amber-100 text-amber-600",
            value: String(pendingFR.length),
            valueColor: pendingFR.length > 0 ? "text-amber-600" : "text-slate-900",
            sub: pendingFR.length > 0 ? "Menunggu persetujuan" : undefined,
            subColor: "text-amber-600 font-medium",
          },
        ].map((card) => (
          <Card key={card.title} className="hover:shadow-sm transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-600 font-poppins">
                {card.title}
              </CardTitle>
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${card.iconBg}`}>
                {card.icon}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className={`text-xl sm:text-2xl font-bold ${card.valueColor ?? "text-slate-900"}`}>
                    {card.value}
                  </div>
                  {card.sub && (
                    <p className={`text-xs mt-1 ${card.subColor ?? "text-slate-500"}`}>
                      {card.sub}
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Events */}
      <RecentEventsCard
        events={events}
        loading={loading}
        viewAllLink="/dashboard/kegiatan-rt"
        eventDetailBasePath="/dashboard/events-rt"
      />

      {/* Quick Links */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            to: "/dashboard/organisasi-rt",
            icon: <Users className="h-5 w-5" />,
            iconBg: "bg-primary/10 text-primary",
            label: "Data Warga",
          },
          {
            to: "/dashboard/kegiatan-rt",
            icon: <CalendarDays className="h-5 w-5" />,
            iconBg: "bg-emerald-100 text-emerald-600",
            label: "Kegiatan",
          },
          {
            to: "/dashboard/kas-rt",
            icon: <Wallet className="h-5 w-5" />,
            iconBg: "bg-blue-100 text-blue-600",
            label: "Kas & Keuangan",
          },
          {
            to: "/dashboard/pengaturan-iuran",
            icon: <Banknote className="h-5 w-5" />,
            iconBg: "bg-amber-100 text-amber-600",
            label: "Pengaturan Iuran",
          },
        ].map((link) => (
          <Link key={link.to} to={link.to}>
            <Card className="group hover:border-primary/30 hover:shadow-md transition-all cursor-pointer">
              <CardContent className="flex items-center gap-3 py-4">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${link.iconBg}`}>
                  {link.icon}
                </div>
                <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">
                  {link.label}
                </span>
                <ArrowRight className="h-4 w-4 text-slate-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}