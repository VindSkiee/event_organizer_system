import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { financeService } from "@/features/finance/services/financeService";
import { fundRequestService } from "@/features/finance/services/fundRequestService";
import { eventService } from "@/features/event/services/eventService";
import { groupService } from "@/features/organization/services/groupService";
import { userService } from "@/shared/services/userService";
import type {
  WalletDetail,
  EventItem,
  GroupItem,
  FundRequest,
} from "@/shared/types";
import {
  StatsCards,
  ActionRequired,
  RecentEventsCard,
  RecentFundRequests,
  QuickLinks,
} from "@/features/dashboard/components";
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { AlertCircle, Settings } from "lucide-react";

export default function LeaderDashboard() {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState<WalletDetail | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [usersCount, setUsersCount] = useState(0);
  const [fundRequests, setFundRequests] = useState<FundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [duesRuleNotSet, setDuesRuleNotSet] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [walletRes, eventsRes, groupsRes, fundRequestsRes] =
          await Promise.allSettled([
            financeService.getWalletDetails(),
            eventService.getAll(),
            groupService.getAll(),
            fundRequestService.getAll(),
          ]);

        if (walletRes.status === "fulfilled") setWallet(walletRes.value);
        if (eventsRes.status === "fulfilled") setEvents(eventsRes.value);
        if (fundRequestsRes.status === "fulfilled") setFundRequests(fundRequestsRes.value);

        if (groupsRes.status === "fulfilled") {
          setGroups(groupsRes.value);
          const rtGroups = groupsRes.value.filter((g) => g.type === "RT");
          let total = 0;
          for (const rt of rtGroups) {
            const count = await userService.getCountByGroup(rt.id).catch(() => 0);
            total += count;
          }
          setUsersCount(total);
        }

        const failures = [walletRes, eventsRes, groupsRes, fundRequestsRes].filter(
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

  // Derived data
  const activeEvents = events.filter(
    (e) => e.status === "APPROVED" || e.status === "ONGOING"
  );
  const rtGroups = groups.filter((g) => g.type === "RT");

  // ActionRequired — leader perlu approve event SUBMITTED dan fund requests PENDING
  const eventsNeedingReview = events.filter((e) => e.status === "SUBMITTED");
  const pendingFundRequests = fundRequests.filter((f) => f.status === "PENDING");

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold font-poppins text-slate-900 tracking-tight">
          Dashboard{" "}
          <span className="text-brand-green">
            {wallet?.communityGroup?.name || "—"}
          </span>
        </h1>
        <p className="text-sm sm:text-base text-slate-500 mt-1">
          Ringkasan data dan statistik seluruh warga.
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
                    Anda belum mengatur biaya iuran untuk kelompok Anda. Warga belum bisa melihat tagihan.
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

      <StatsCards
        usersCount={usersCount}
        rtCount={rtGroups.length}
        wallet={wallet}
        activeEventsCount={activeEvents.length}
        loading={loading}
      />

      <ActionRequired
        eventsNeedingReview={eventsNeedingReview}
        eventsFunded={[]}
        eventsUnderReview={[]}
        pendingFundRequests={pendingFundRequests}
        loading={loading}
      />

      <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
        <RecentEventsCard
          events={events}
          loading={loading}
          viewAllLink="/dashboard/kegiatan"
        />
        <RecentFundRequests fundRequests={fundRequests} loading={loading} />
      </div>

      <QuickLinks />
    </div>
  );
}