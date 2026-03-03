import { Card, CardContent } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { Users, Wallet, Building2, Smartphone, AlertCircle } from "lucide-react";
import type { DuesProgressMember } from "@/shared/types";
import { useNavigate } from "react-router-dom";

// === TYPES ===
export interface GroupProgressSummary {
  id: number;
  name: string;
  adminName: string;
  treasurerName: string;
  balance: number;
  hasDuesRule: boolean;
  monthlyStatus: Array<"PAID" | "PARTIAL" | "UNPAID" | "FUTURE" | "NOT_REGISTERED">;
  isFullyPaid: boolean;
}

interface DuesProgressTableProps {
  isParentLevel: boolean;
  loading: boolean;
  selectedYear: number;
  currentMonth: number;
  currentYear: number;
  parentData: GroupProgressSummary[];
  childData: DuesProgressMember[];
  isFullyPaidChild: (member: DuesProgressMember) => boolean;
}

// === CONSTANTS & HELPERS ===
export const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export const MONTH_FULL = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function isPaidForMonth(member: DuesProgressMember, month: number, year: number): boolean {
  const safeContributions = member.contributions || [];
  const hasContribution = safeContributions.some((c) => c.month === month && c.year === year);
  if (hasContribution) return true;

  if (member.lastPaidPeriod) {
    const lp = new Date(member.lastPaidPeriod);
    const lpYear = lp.getFullYear();
    const lpMonth = lp.getMonth() + 1;
    if (year < lpYear) return true;
    if (year === lpYear && month <= lpMonth) return true;
  }
  return false;
}

export function memberExistedInMonth(member: DuesProgressMember, month: number, year: number): boolean {
  if (!member.createdAt) return true;
  const created = new Date(member.createdAt);
  const cYear = created.getFullYear();
  const cMonth = created.getMonth() + 1;
  if (year > cYear) return true;
  if (year === cYear && month >= cMonth) return true;
  return false;
}

// === MAIN COMPONENT ===
export function DuesProgressTable({
  isParentLevel,
  loading,
  selectedYear,
  currentMonth,
  currentYear,
  parentData,
  childData,
  isFullyPaidChild,
}: DuesProgressTableProps) {
  
  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 lg:h-16 w-full rounded-xl" />)}
        </CardContent>
      </Card>
    );
  }

  // ==========================================
  // PARENT LEVEL (RW / LIST RT)
  // ==========================================
  if (isParentLevel) {
    if (parentData.length === 0) return <EmptyState message="Tidak ada lingkungan (RT) yang cocok dengan filter." icon={Building2} />;
    
    return (
      <Card className="overflow-hidden border-0 ring-1 ring-slate-200 shadow-sm bg-slate-50/50 lg:bg-white">
        
        {/* --- DESKTOP VIEW (TABLE) --- */}
        <div className="overflow-x-auto hidden lg:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-white">
                <th className="text-center py-4 px-4 font-semibold text-slate-700 w-10">No</th>
                <th className="text-center py-4 px-4 font-semibold text-slate-700 min-w-[200px]">Lingkungan</th>
                <th className="text-center py-4 px-2 font-semibold text-slate-700" colSpan={12}>Progres Kolektif {selectedYear}</th>
                <th className="text-center py-4 px-4 font-semibold text-slate-700 w-24">Status</th>
              </tr>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th colSpan={2} />
                {MONTH_NAMES.map((name, idx) => (
                  <th key={name} className={`text-center py-2 px-1 text-[10px] sm:text-xs font-medium ${selectedYear === currentYear && (idx + 1) === currentMonth ? "text-primary font-bold" : "text-slate-500"}`}>
                    {name}
                    {selectedYear === currentYear && (idx + 1) === currentMonth && <div className="h-0.5 w-full bg-primary rounded-full mt-1" />}
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {parentData.map((group, idx) => (
                <ParentRow key={group.id} group={group} index={idx + 1} />
              ))}
            </tbody>
          </table>
        </div>

        {/* --- MOBILE VIEW (CARDS) --- */}
        <div className="grid grid-cols-1 gap-3 p-3 lg:hidden">
          {parentData.map((group) => (
            <ParentMobileCard key={group.id} group={group} />
          ))}
        </div>

      </Card>
    );
  }

  // ==========================================
  // CHILD LEVEL (RT / LIST WARGA)
  // ==========================================
  if (childData.length === 0) return <EmptyState message="Tidak ada warga yang cocok dengan filter." icon={Users} />;

  return (
    <Card className="overflow-hidden border-0 ring-1 ring-slate-200 shadow-sm bg-slate-50/50 lg:bg-white">
      
      {/* --- DESKTOP VIEW (TABLE) --- */}
      <div className="overflow-x-auto hidden lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-center py-4 px-4 font-semibold text-slate-700 w-10">No</th>
              <th className="text-center py-4 px-4 font-semibold text-slate-700 min-w-[160px]">Nama Warga</th>
              <th className="text-center py-4 px-4 font-semibold text-slate-700 min-w-[120px]">No. HP</th>
              <th className="text-center py-4 px-2 font-semibold text-slate-700" colSpan={12}>Progres Bulanan {selectedYear}</th>
              <th className="text-center py-4 px-4 font-semibold text-slate-700 w-24">Status</th>
            </tr>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              <th colSpan={3} />
              {MONTH_NAMES.map((name, idx) => (
                <th key={name} className={`text-center py-2 px-1 text-[10px] sm:text-xs font-medium ${selectedYear === currentYear && (idx + 1) === currentMonth ? "text-primary font-bold" : "text-slate-500"}`}>
                  {name}
                  {selectedYear === currentYear && (idx + 1) === currentMonth && <div className="h-0.5 w-full bg-primary rounded-full mt-1" />}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {childData.map((member, idx) => (
              <ChildRow 
                key={member.id} 
                member={member} 
                index={idx + 1} 
                year={selectedYear} 
                currentMonth={currentMonth} 
                currentYear={currentYear} 
                isFullyPaid={isFullyPaidChild(member)} 
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* --- MOBILE VIEW (CARDS) --- */}
      <div className="grid grid-cols-1 gap-3 p-3 lg:hidden">
        {childData.map((member) => (
          <ChildMobileCard 
            key={member.id} 
            member={member} 
            year={selectedYear} 
            currentMonth={currentMonth} 
            currentYear={currentYear} 
            isFullyPaid={isFullyPaidChild(member)} 
          />
        ))}
      </div>

    </Card>
  );
}

// ==========================================
// DESKTOP ROW COMPONENTS
// ==========================================

function ParentRow({ group, index }: { group: GroupProgressSummary; index: number }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role: string = user.role || "";
  const targetPath = role === "TREASURER" ? `/dashboard/progres-iuran-bendahara/${group.id}` : `/dashboard/progres-iuran/${group.id}`;

  if (!group.hasDuesRule) {
    return (
      <tr className="bg-slate-50/80 opacity-75">
        <td className="text-center py-4 px-4 text-slate-400 text-sm">{index}</td>
        <td className="py-4 px-4">
          <div className="min-w-0">
            <p className="font-bold text-slate-500 text-sm">{group.name}</p>
            <div className="flex flex-col gap-0.5 mt-1 text-[11px] text-slate-400">
              <span className="flex items-center gap-1"><Users className="h-3 w-3" /> Admin: {group.adminName}</span>
              <span className="flex items-center gap-1"><Wallet className="h-3 w-3" /> Kas: <span className="font-semibold text-slate-400">{formatRupiah(group.balance)}</span></span>
            </div>
          </div>
        </td>
        <td colSpan={12} className="py-4 px-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <AlertCircle className="h-4 w-4 text-blue-400 shrink-0" />
            <span className="text-xs text-slate-500">Biaya iuran belum diatur untuk RT ini</span>
          </div>
        </td>
        <td className="py-4 px-4 text-center">
          <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-300 cursor-default">
            Belum Diatur
          </Badge>
        </td>
      </tr>
    );
  }

  return (
    <tr onClick={() => navigate(targetPath)} className="hover:bg-slate-50 transition-colors group cursor-pointer">
      <td className="text-center py-4 px-4 text-slate-400 text-sm">{index}</td>
      <td className="py-4 px-4">
        <div className="min-w-0">
          <p className="font-bold text-slate-900 text-sm group-hover:text-primary transition-colors">{group.name}</p>
          <div className="flex flex-col gap-0.5 mt-1 text-[11px] text-slate-500">
            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> Admin: {group.adminName}</span>
            <span className="flex items-center gap-1"><Wallet className="h-3 w-3 text-emerald-600" /> Kas: <span className="font-semibold text-slate-700">{formatRupiah(group.balance)}</span></span>
          </div>
        </div>
      </td>
      {group.monthlyStatus.map((status, idx) => {
        let bgColor = "bg-slate-100";
        let tooltipText = `${MONTH_FULL[idx]} — Belum Jatuh Tempo`;
        if (status === "PAID") { bgColor = "bg-emerald-500"; tooltipText = `${MONTH_FULL[idx]} — 100% Terkumpul`; }
        else if (status === "PARTIAL") { bgColor = "bg-amber-400"; tooltipText = `${MONTH_FULL[idx]} — Terkumpul Sebagian`; }
        else if (status === "UNPAID") { bgColor = "bg-red-400"; tooltipText = `${MONTH_FULL[idx]} — Nihil / Kosong`; }

        return (
          <td key={idx} className="py-4 px-1 text-center">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={`w-5 h-5 rounded mx-auto cursor-default transition-transform hover:scale-110 shadow-sm ${bgColor}`} />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">{tooltipText}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </td>
        );
      })}
      <td className="py-4 px-4 text-center">
        <Badge variant={group.isFullyPaid ? "default" : "secondary"} className={`text-[10px] ${group.isFullyPaid ? "bg-emerald-500" : "bg-amber-100 text-amber-700"}`}>
          {group.isFullyPaid ? "Lunas" : "Ada Tunggakan"}
        </Badge>
      </td>
    </tr>
  );
}

function ChildRow({ member, index, year, currentMonth, currentYear, isFullyPaid }: any) {
  return (
    <tr className="hover:bg-slate-50/80 transition-colors group">
      <td className="text-center py-4 px-4 text-slate-400 text-sm">{index}</td>
      <td className="py-4 px-4">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 text-sm truncate">{member.fullName}</p>
        </div>
      </td>
      <td className="py-4 px-4 text-slate-500 text-xs">{member.phone || "—"}</td>
      
      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
        const { bgColor, tooltipText, isCurrent } = getChildMonthStatus(member, month, year, currentMonth, currentYear);
        return (
          <td key={month} className="py-4 px-1 text-center">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={`w-5 h-5 rounded mx-auto cursor-default transition-transform hover:scale-110 ${bgColor} ${isCurrent ? "ring-2 ring-primary ring-offset-2" : ""}`} />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs font-medium">{tooltipText}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </td>
        );
      })}
      <td className="py-4 px-4 text-center">
        <Badge variant={isFullyPaid ? "default" : "destructive"} className={`text-[10px] ${isFullyPaid ? "bg-emerald-500" : ""}`}>
          {isFullyPaid ? "Lunas" : "Tunggakan"}
        </Badge>
      </td>
    </tr>
  );
}

// ==========================================
// MOBILE CARD COMPONENTS (NEW)
// ==========================================

function ParentMobileCard({ group }: { group: GroupProgressSummary }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const targetPath = user.role === "TREASURER" ? `/dashboard/progres-iuran-bendahara/${group.id}` : `/dashboard/progres-iuran/${group.id}`;

  if (!group.hasDuesRule) {
    return (
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-3 opacity-75">
        <div className="flex justify-between items-start gap-2">
          <div>
            <h4 className="font-bold text-slate-500 text-sm">{group.name}</h4>
            <div className="flex flex-col gap-0.5 mt-1.5 text-xs text-slate-400">
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Admin: {group.adminName}</span>
              <span className="flex items-center gap-1"><Wallet className="h-3.5 w-3.5" /> Kas: <span className="font-semibold text-slate-400">{formatRupiah(group.balance)}</span></span>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] shrink-0 text-slate-500 border-slate-300">Belum Diatur</Badge>
        </div>
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 text-blue-500 shrink-0" />
          <span className="text-xs text-blue-700">Biaya iuran belum diatur untuk RT ini</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      onClick={() => navigate(targetPath)}
      className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3 active:scale-[0.98] transition-transform cursor-pointer"
    >
      <div className="flex justify-between items-start gap-2">
        <div>
          <h4 className="font-bold text-slate-900 text-sm">{group.name}</h4>
          <div className="flex flex-col gap-0.5 mt-1.5 text-xs text-slate-500">
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Admin: {group.adminName}</span>
            <span className="flex items-center gap-1"><Wallet className="h-3.5 w-3.5 text-emerald-600" /> Kas: <span className="font-semibold text-slate-700">{formatRupiah(group.balance)}</span></span>
          </div>
        </div>
        <Badge variant={group.isFullyPaid ? "default" : "secondary"} className={`text-[10px] shrink-0 ${group.isFullyPaid ? "bg-emerald-500" : "bg-amber-100 text-amber-700"}`}>
          {group.isFullyPaid ? "Lunas" : "Tunggakan"}
        </Badge>
      </div>

      <div className="pt-3 border-t border-slate-100">
        <p className="text-[10px] font-semibold text-slate-400 mb-2 uppercase tracking-wider">Progres Bulanan</p>
        <div className="grid grid-cols-6 gap-y-3 gap-x-1">
          {group.monthlyStatus.map((status, idx) => {
            let bgColor = "bg-slate-100";
            if (status === "PAID") bgColor = "bg-emerald-500";
            else if (status === "PARTIAL") bgColor = "bg-amber-400";
            else if (status === "UNPAID") bgColor = "bg-red-400";

            return (
              <div key={idx} className="flex flex-col items-center gap-1.5">
                <span className="text-[9px] text-slate-500 font-medium">{MONTH_NAMES[idx]}</span>
                <div className={`w-full max-w-[20px] h-5 rounded shadow-sm ${bgColor}`} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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

// === UTILS ===

function EmptyState({ message, icon: Icon }: { message: string, icon: any }) {
  return (
    <Card className="border-dashed shadow-none bg-slate-50/50">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-16 w-16 rounded-full bg-white flex items-center justify-center mb-4 ring-1 ring-slate-100 shadow-sm">
          <Icon className="h-8 w-8 text-slate-300" />
        </div>
        <p className="text-sm text-slate-500 font-medium">{message}</p>
      </CardContent>
    </Card>
  );
}

// Logic warna diekstrak agar bisa dipakai ulang di Table (Desktop) dan Card (Mobile)
function getChildMonthStatus(member: DuesProgressMember, month: number, year: number, currentMonth: number, currentYear: number) {
  const existed = memberExistedInMonth(member, month, year);
  const paid = existed && isPaidForMonth(member, month, year);
  const isCurrent = year === currentYear && month === currentMonth;
  const isStrictlyFuture = year > currentYear || (year === currentYear && month > currentMonth);
  const contribution = (member.contributions || []).find((c:any) => c.month === month && c.year === year);

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