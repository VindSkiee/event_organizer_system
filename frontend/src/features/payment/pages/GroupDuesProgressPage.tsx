import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { Badge } from "@/shared/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import {
  ArrowLeft,
  Users,
  Calendar,
  CheckCircle2,
  XCircle,
  Info,
  Smartphone,
  CalendarClock,
  Building,
  Wallet
} from "lucide-react";
import { toast } from "sonner";
import { financeService } from "@/features/finance/services/financeService";
import type { DuesProgressData, DuesProgressMember } from "@/shared/types";

// === HELPERS ===

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTH_FULL = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Check if a member has paid for a specific month safely */
function isPaidForMonth(member: DuesProgressMember, month: number, year: number): boolean {
  const safeContributions = member.contributions || [];
  const hasContribution = safeContributions.some(
    (c) => c.month === month && c.year === year
  );
  if (hasContribution) return true;

  if (member.lastPaidPeriod) {
    const lp = new Date(member.lastPaidPeriod);
    const lpYear = lp.getFullYear();
    const lpMonth = lp.getMonth() + 1; // 1-based

    if (year < lpYear) return true;
    if (year === lpYear && month <= lpMonth) return true;
  }

  return false;
}

/** Check if member existed in a given month cleanly via strict Year/Month */
function memberExistedInMonth(member: DuesProgressMember, month: number, year: number): boolean {
  if (!member.createdAt) return true;

  const created = new Date(member.createdAt);
  const cYear = created.getFullYear();
  const cMonth = created.getMonth() + 1;

  if (year > cYear) return true;
  if (year === cYear && month >= cMonth) return true;

  return false;
}

// Logic warna diekstrak agar bisa dipakai ulang di Table (Desktop) dan Card (Mobile)
function getChildMonthStatus(member: DuesProgressMember, month: number, year: number, currentMonth: number, currentYear: number) {
  const existed = memberExistedInMonth(member, month, year);
  const paid = existed && isPaidForMonth(member, month, year);
  const isCurrent = year === currentYear && month === currentMonth;
  const isStrictlyFuture = year > currentYear || (year === currentYear && month > currentMonth);
  const contribution = (member.contributions || []).find((c: any) => c.month === month && c.year === year);

  let bgColor = "bg-slate-200 border border-slate-300/50";
  let tooltipText = `${MONTH_FULL[month - 1]} — Belum terdaftar`;

  if (existed) {
    if (paid) {
      bgColor = "bg-emerald-500 shadow-sm ring-1 ring-emerald-600/20";
      tooltipText = `${MONTH_FULL[month - 1]} — Lunas`;
      if (contribution) tooltipText += ` (${new Date(contribution.paidAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })})`;
    } else if (isStrictlyFuture) {
      bgColor = "bg-slate-100";
      tooltipText = `${MONTH_FULL[month - 1]} — Belum jatuh tempo`;
    } else {
      bgColor = "bg-red-400 shadow-sm ring-1 ring-red-500/20";
      tooltipText = `${MONTH_FULL[month - 1]} — Menunggak`;
    }
  }

  return { bgColor, tooltipText, isCurrent };
}


type FilterMode = "all" | "lunas" | "belum";

export default function GroupDuesProgressPage() {
  const { groupId: paramGroupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<DuesProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const currentMonth = new Date().getMonth() + 1; // 1-based
  const currentYear = new Date().getFullYear();

  // Resolve effective group ID
  const resolvedGroupId = (() => {
    const fromParam = Number(paramGroupId);
    if (!isNaN(fromParam) && fromParam > 0) return fromParam;
    try {
      const stored = localStorage.getItem("user");
      if (stored) {
        const user = JSON.parse(stored);
        if (user.communityGroupId) return Number(user.communityGroupId);
      }
    } catch { /* ignore */ }
    return null;
  })();

  useEffect(() => {
    if (resolvedGroupId) fetchData();
  }, [resolvedGroupId, selectedYear]);

  const fetchData = async () => {
    if (!resolvedGroupId) return;
    setLoading(true);
    try {
      const res = await financeService.getDuesProgress(resolvedGroupId, selectedYear);
      setData(res);
    } catch {
      toast.error("Gagal memuat data progres iuran.");
    } finally {
      setLoading(false);
    }
  };

  /** Is the member fully paid for all applicable months up to current */
  const isFullyPaid = useCallback((member: DuesProgressMember): boolean => {
    const maxMonth = selectedYear >= currentYear ? currentMonth : 12;

    for (let m = 1; m <= maxMonth; m++) {
      if (memberExistedInMonth(member, m, selectedYear)) {
        if (!isPaidForMonth(member, m, selectedYear)) {
          return false;
        }
      }
    }
    return true;
  }, [selectedYear, currentYear, currentMonth]);

  const filteredMembers = useMemo(() => {
    if (!data?.members) return [];
    let members = data.members;

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      members = members.filter(
        (m) =>
          m.fullName.toLowerCase().includes(q) ||
          (m.phone || "").toLowerCase().includes(q)
      );
    }

    // Status filter
    if (filter === "lunas") {
      members = members.filter((m) => isFullyPaid(m));
    } else if (filter === "belum") {
      members = members.filter((m) => !isFullyPaid(m));
    }

    return members;
  }, [data, search, filter, isFullyPaid]);

  // Statistics
  const totalMembers = data?.members?.length || 0;
  const paidCount = data?.members?.filter((m) => isFullyPaid(m)).length || 0;
  const unpaidCount = totalMembers - paidCount;

  // Year options dynamically from group creation or fallback to last 3 years
  const yearOptions = useMemo(() => {
    const groupCreatedAt = (data?.group as any)?.createdAt;
    const startYear = groupCreatedAt ? new Date(groupCreatedAt).getFullYear() : currentYear - 2;
    const length = Math.max(1, currentYear - startYear + 1);
    return Array.from({ length }, (_, i) => currentYear - i);
  }, [data, currentYear]);

  return (
    <TooltipProvider>
      <div className="space-y-6 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0 mt-0.5">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold font-poppins text-slate-900 truncate">
              Progres Iuran {data?.group.name || ""}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Pantau progres pembayaran iuran bulanan warga.
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-600 font-poppins">Total Warga</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-8 w-12" /> : (
                <div className="text-2xl font-bold text-slate-900">{totalMembers}</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-600 font-poppins">Lunas</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-8 w-12" /> : (
                <div className="text-2xl font-bold text-emerald-600">{paidCount}</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-600 font-poppins">Belum Lunas</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-8 w-12" /> : (
                <div className="text-2xl font-bold text-red-600">{unpaidCount}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Dues Rule Info */}
        {data?.duesRule && (
          <Card className="bg-slate-50 border-slate-200/60 shadow-none rounded-xl overflow-hidden">
            <CardContent className="p-3.5 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-0">

              {/* Info 1: Iuran Utama (RT) */}
              <div className="flex items-center gap-2.5 sm:pr-5">
                <div className="p-1.5 bg-white rounded-lg shadow-sm border border-slate-100 shrink-0">
                  <Wallet className="h-4 w-4 text-emerald-600" />
                </div>
                <p className="text-sm text-slate-500">
                  Iuran RT: <span className="font-semibold text-slate-900">{formatRupiah(Number(data.duesRule.amount))}</span><span className="text-xs">/bln</span>
                </p>
              </div>

              {/* Info 2: Iuran Parent (RW) */}
              {data.parentDuesRule && (
                <div className="flex items-center gap-2.5 sm:px-5 sm:border-l border-slate-200">
                  <div className="p-1.5 bg-white rounded-lg shadow-sm border border-slate-100 shrink-0">
                    <Building className="h-4 w-4 text-blue-600" />
                  </div>
                  <p className="text-sm text-slate-500">
                    Iuran RW: <span className="font-semibold text-slate-900">{formatRupiah(Number(data.parentDuesRule.amount))}</span><span className="text-xs">/bln</span>
                  </p>
                </div>
              )}

              {/* Info 3: Jatuh Tempo */}
              {data.duesRule.dueDay && (
                <div className="flex items-center gap-2.5 sm:px-5 sm:border-l border-slate-200 mt-1 sm:mt-0">
                  <div className="p-1.5 bg-white rounded-lg shadow-sm border border-slate-100 shrink-0">
                    <CalendarClock className="h-4 w-4 text-amber-600" />
                  </div>
                  <p className="text-sm text-slate-500">
                    Jatuh Tempo: <span className="font-semibold text-slate-900">Tgl {data.duesRule.dueDay}</span>
                  </p>
                </div>
              )}

            </CardContent>
          </Card>
        )}

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm group">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg className="h-4 w-4 text-slate-500 group-focus-within:text-primary transition-colors duration-200" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="8" />
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Cari nama atau telepon..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 pl-10 pr-4 rounded-xl text-sm bg-white text-slate-800 placeholder:text-slate-400 border border-slate-300 shadow-sm outline-none transition-all duration-200 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/10 focus:shadow-md hover:border-slate-400"
            />
          </div>
          <div className="flex gap-2">
            <Select value={filter} onValueChange={(v) => setFilter(v as FilterMode)}>
              <SelectTrigger className="w-[140px] h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="lunas">Lunas</SelectItem>
                <SelectItem value="belum">Belum Lunas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-[120px] h-10">
                <Calendar className="h-4 w-4 mr-1.5 text-slate-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Progress Display */}
        {loading ? (
          <Card>
            <CardContent className="py-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-20 lg:h-12 w-full rounded-xl" />
              ))}
            </CardContent>
          </Card>
        ) : filteredMembers.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <Users className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm text-slate-500 font-medium">
                {search || filter !== "all" ? "Tidak ada warga yang cocok." : "Belum ada data warga."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden bg-slate-50/50 lg:bg-white border-0 ring-1 ring-slate-200">

            {/* --- DESKTOP VIEW (TABLE) --- */}
            <div className="overflow-x-auto hidden lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-white">
                    <th className="text-center py-3 px-4 font-semibold text-slate-600 w-10">No</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-600 min-w-[140px]">Nama</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-600 hidden sm:table-cell min-w-[120px]">No. HP</th>
                    <th className="text-center py-3 px-2 font-semibold text-slate-600" colSpan={12}>
                      Progres Bulanan {selectedYear}
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-600 w-20">Status</th>
                  </tr>
                  {/* Month headers */}
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th colSpan={3} className="hidden sm:table-cell" />
                    {MONTH_NAMES.map((name, idx) => {
                      const monthNum = idx + 1;
                      const isCurrent = selectedYear === currentYear && monthNum === currentMonth;
                      return (
                        <th
                          key={name}
                          className={`text-center py-1.5 px-0.5 text-[10px] sm:text-xs font-medium ${isCurrent ? "text-primary font-bold" : "text-slate-500"
                            }`}
                        >
                          {name}
                          {isCurrent && (
                            <div className="h-0.5 w-full bg-primary rounded-full mt-0.5" />
                          )}
                        </th>
                      );
                    })}
                    <th />
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filteredMembers.map((member, idx) => (
                    <MemberRow
                      key={member.id}
                      member={member}
                      index={idx + 1}
                      year={selectedYear}
                      currentMonth={currentMonth}
                      currentYear={currentYear}
                      isFullyPaid={isFullyPaid(member)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* --- MOBILE VIEW (CARDS) --- */}
            <div className="grid grid-cols-1 gap-3 p-3 lg:hidden">
              {filteredMembers.map((member) => (
                <ChildMobileCard
                  key={member.id}
                  member={member}
                  year={selectedYear}
                  currentMonth={currentMonth}
                  currentYear={currentYear}
                  isFullyPaid={isFullyPaid(member)}
                />
              ))}
            </div>

          </Card>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-100">
          <span className="text-slate-700 mr-2"><Info className="h-4 w-4 inline mr-1" /> Keterangan:</span>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-emerald-500 shadow-inner" />
            <span>Lunas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-red-400 shadow-inner" />
            <span>Belum Bayar</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-slate-200 shadow-inner" />
            <span>Belum Terdaftar</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto sm:ml-4">
            <div className="w-4 h-1 rounded-full bg-primary" />
            <span>Bulan Ini</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

// === DESKTOP ROW COMPONENT ===

function MemberRow({
  member,
  index,
  year,
  currentMonth,
  currentYear,
  isFullyPaid: fullyPaid,
}: {
  member: DuesProgressMember;
  index: number;
  year: number;
  currentMonth: number;
  currentYear: number;
  isFullyPaid: boolean;
}) {
  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
      <td className="text-center py-4 px-4 text-slate-400 text-xs">{index}</td>
      <td className="py-4 px-4 flex items-center justify-center">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 text-sm truncate">{member.fullName}</p>
        </div>
      </td>
      <td className="text-center py-4 px-4 text-slate-500 text-xs hidden sm:table-cell">
        {member.phone || "—"}
      </td>

      {/* 12 Month blocks */}
      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
        const { bgColor, tooltipText, isCurrent } = getChildMonthStatus(member, month, year, currentMonth, currentYear);

        return (
          <td key={month} className="py-4 px-0.5 text-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={`
                    w-5 h-5 sm:w-6 sm:h-6 rounded mx-auto cursor-default transition-transform hover:scale-110
                    ${bgColor}
                    ${isCurrent ? "ring-2 ring-primary ring-offset-1" : ""}
                  `}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {tooltipText}
              </TooltipContent>
            </Tooltip>
          </td>
        );
      })}

      {/* Status badge */}
      <td className="py-4 px-4 text-center">
        <Badge
          variant={fullyPaid ? "default" : "destructive"}
          className={`text-[10px] sm:text-xs ${fullyPaid ? "bg-emerald-500 hover:bg-emerald-600" : ""}`}
        >
          {fullyPaid ? "Lunas" : "Belum"}
        </Badge>
      </td>
    </tr>
  );
}

// === MOBILE CARD COMPONENT ===

function ChildMobileCard({ member, year, currentMonth, currentYear, isFullyPaid }: any) {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
      <div className="flex justify-between items-start gap-2">
        <div>
          <h4 className="font-bold text-slate-900 text-sm">{member.fullName}</h4>
          <span className="flex items-center gap-1 mt-1 text-xs text-slate-500">
            <Smartphone className="h-3 w-3" /> {member.phone || "Tidak ada No. HP"}
          </span>
        </div>
        <Badge variant={isFullyPaid ? "default" : "destructive"} className={`text-[10px] shrink-0 ${isFullyPaid ? "bg-emerald-500" : ""}`}>
          {isFullyPaid ? "Lunas" : "Tunggakan"}
        </Badge>
      </div>

      <div className="pt-3 border-t border-slate-100">
        <p className="text-[10px] font-semibold text-slate-400 mb-2 uppercase tracking-wider">Status Iuran {year}</p>
        <div className="grid grid-cols-6 gap-y-3 gap-x-1">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
            const { bgColor, isCurrent } = getChildMonthStatus(member, month, year, currentMonth, currentYear);
            return (
              <div key={month} className="flex flex-col items-center gap-1.5">
                <span className={`text-[9px] font-medium ${isCurrent ? "text-primary font-bold" : "text-slate-500"}`}>
                  {MONTH_NAMES[month - 1]}
                </span>
                <div className={`w-full max-w-[20px] h-5 rounded ${bgColor} ${isCurrent ? "ring-2 ring-primary ring-offset-1" : ""}`} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}