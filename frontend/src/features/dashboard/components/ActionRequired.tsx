import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Banknote,
  CheckCircle2,
  Sparkles,
  Receipt,
} from "lucide-react";
import type { EventItem, FundRequest } from "@/shared/types";

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

interface ActionRequiredProps {
  // Events needing approval signature from current user
  eventsNeedingReview: EventItem[];
  // Events that are funded and need expense report input
  eventsFunded: EventItem[];
  // Events under review with pending fund requests targeting current user's group
  eventsUnderReview: EventItem[];
  // Pending fund requests (general)
  pendingFundRequests: FundRequest[];
  loading: boolean;
  /** Base URL segment for event detail links, e.g. "events" or "events-bendahara" */
  eventBasePath?: string;
  /** Path for the fund requests / kas page */
  fundRequestsPath?: string;
}

export function ActionRequired({
  eventsNeedingReview,
  eventsFunded,
  eventsUnderReview,
  pendingFundRequests,
  loading,
  eventBasePath = "events",
  fundRequestsPath = "/dashboard/kas",
}: ActionRequiredProps) {
  const totalActionRequired =
    eventsNeedingReview.length +
    eventsFunded.length +
    eventsUnderReview.length +
    pendingFundRequests.length;

  if (loading) return null;

  if (totalActionRequired === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 shadow-sm">
        <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-emerald-200/40 blur-xl" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 shadow-inner">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-900">Semua aman!</p>
            <p className="text-xs text-emerald-700/80">
              Tidak ada pengajuan yang menunggu persetujuan.
            </p>
          </div>
          <Sparkles className="ml-auto h-4 w-4 text-emerald-400" />
        </div>
      </div>
    );
  }

  const alertSections: {
    key: string;
    show: boolean;
    icon: React.ReactNode;
    iconGradient: string;
    title: string;
    subtitle: string;
    items: EventItem[];
    itemLink: (ev: EventItem) => string;
    itemSub?: (ev: EventItem) => string | undefined;
    buttonColor: string;
    buttonShadow: string;
    to?: string;
  }[] = [
    {
      key: "review",
      show: eventsNeedingReview.length > 0,
      icon: <CalendarDays className="h-4 w-4 text-white" />,
      iconGradient: "linear-gradient(135deg, #f59e0b, #d97706)",
      title: `${eventsNeedingReview.length} acara menunggu persetujuan Anda`,
      subtitle: "Segera review dan setujui/tolak pengajuan acara berikut.",
      items: eventsNeedingReview,
      itemLink: (ev) => `/dashboard/${eventBasePath}/${ev.id}`,
      itemSub: (ev) => formatRupiah(Number(ev.budgetEstimated)),
      buttonColor: "linear-gradient(135deg, #f59e0b, #d97706)",
      buttonShadow: "0 2px 8px rgba(245,158,11,0.4)",
    },
    {
      key: "funded",
      show: eventsFunded.length > 0,
      icon: <Receipt className="h-4 w-4 text-white" />,
      iconGradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
      title: `${eventsFunded.length} acara perlu laporan pengeluaran`,
      subtitle: "Dana sudah dicairkan. Input daftar belanja dan bukti nota.",
      items: eventsFunded,
      itemLink: (ev) => `/dashboard/${eventBasePath}/${ev.id}`,
      itemSub: (ev) => formatRupiah(Number(ev.budgetEstimated)),
      buttonColor: "linear-gradient(135deg, #3b82f6, #2563eb)",
      buttonShadow: "0 2px 8px rgba(59,130,246,0.4)",
    },
    {
      key: "underReview",
      show: eventsUnderReview.length > 0,
      icon: <Banknote className="h-4 w-4 text-white" />,
      iconGradient: "linear-gradient(135deg, #6366f1, #4f46e5)",
      title: `${eventsUnderReview.length} pengajuan dana tambahan menunggu review`,
      subtitle: "RT mengajukan dana tambahan untuk acara. Segera tinjau dan proses.",
      items: eventsUnderReview,
      itemLink: (ev) => `/dashboard/${eventBasePath}/${ev.id}`,
      itemSub: (ev) => {
        const pending = ev.fundRequests?.find((fr) => fr.status === "PENDING");
        return pending ? formatRupiah(Number(pending.amount)) : undefined;
      },
      buttonColor: "linear-gradient(135deg, #6366f1, #4f46e5)",
      buttonShadow: "0 2px 8px rgba(99,102,241,0.4)",
    },
  ];

  return (
    <div
      className="relative overflow-hidden rounded-2xl shadow-lg"
      style={{
        background: "linear-gradient(135deg, #fef08a 0%, #fde047 40%, #facc15 100%)",
        border: "1.5px solid #fbbf24",
      }}
    >
      {/* Decorative blobs */}
      <div
        className="absolute -right-8 -top-8 h-40 w-40 rounded-full opacity-30"
        style={{ background: "radial-gradient(circle, #fbbf24, transparent)" }}
      />
      <div
        className="absolute -bottom-6 -left-6 h-28 w-28 rounded-full opacity-20"
        style={{ background: "radial-gradient(circle, #f59e0b, transparent)" }}
      />
      {/* Dot pattern */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: "radial-gradient(circle, #92400e 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      {/* Header */}
      <div className="relative flex items-start justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl shadow-md"
            style={{
              background: "rgba(180, 83, 9, 0.15)",
              backdropFilter: "blur(4px)",
              border: "1px solid rgba(180,83,9,0.2)",
            }}
          >
            <AlertTriangle className="h-5 w-5" style={{ color: "#92400e" }} />
          </div>
          <div>
            <h3
              className="text-base font-bold tracking-tight"
              style={{ color: "#78350f", fontFamily: "'Poppins', sans-serif" }}
            >
              Perlu Tindakan
            </h3>
            <p className="text-xs font-medium" style={{ color: "#92400e99" }}>
              Ada pengajuan menunggu persetujuan Anda
            </p>
          </div>
        </div>
        <div
          className="flex h-8 min-w-[2rem] items-center justify-center rounded-full px-2.5 text-sm font-bold shadow-inner"
          style={{ background: "#92400e", color: "#fef3c7" }}
        >
          {totalActionRequired}
        </div>
      </div>

      {/* Alert Sections */}
      <div className="relative space-y-2.5 px-5 pb-5">
        {alertSections
          .filter((s) => s.show)
          .map((section) => (
            <div
              key={section.key}
              className="rounded-xl overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.78)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.9)",
                boxShadow: "0 2px 8px rgba(161,98,7,0.1)",
              }}
            >
              {/* Section header */}
              <div className="flex items-center gap-3 px-3.5 pt-3.5 pb-2">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm"
                  style={{ background: section.iconGradient }}
                >
                  {section.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 leading-tight">
                    {section.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{section.subtitle}</p>
                </div>
              </div>

              {/* Event list */}
              <div className="px-3.5 pb-3.5 space-y-1.5">
                {section.items.map((ev) => {
                  const subLabel = section.itemSub?.(ev);
                  return (
                    <Link key={ev.id} to={section.itemLink(ev)}>
                      <div className="group flex items-center justify-between rounded-lg border border-slate-100 bg-white/70 px-3 py-2 transition-all duration-150 hover:border-slate-200 hover:bg-white hover:shadow-sm">
                        <div className="min-w-0">
                          <span className="text-xs font-medium text-slate-800 group-hover:text-slate-900 transition-colors">
                            {ev.title}
                          </span>
                          {subLabel && (
                            <span className="ml-2 text-xs text-slate-400 hidden sm:inline">
                              {subLabel}
                            </span>
                          )}
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-slate-600 ml-2" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

        {/* Pending Fund Requests (no event list, just a link card) */}
        {pendingFundRequests.length > 0 && (
          <div
            className="flex items-center justify-between rounded-xl p-3.5 transition-all duration-200 hover:shadow-md"
            style={{
              background: "rgba(255,255,255,0.75)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.9)",
              boxShadow: "0 2px 8px rgba(161,98,7,0.1)",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl shadow-sm"
                style={{ background: "linear-gradient(135deg, #10b98120, #05966820)" }}
              >
                <Banknote className="h-4.5 w-4.5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {pendingFundRequests.length} Pengajuan Dana Menunggu
                </p>
                <p className="text-xs text-slate-500">
                  Permintaan dana dari RT perlu di-review
                </p>
              </div>
            </div>
            <Link
              to={fundRequestsPath}
              className="group flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 hover:gap-2"
              style={{
                background: "linear-gradient(135deg, #10b981, #059669)",
                color: "white",
                boxShadow: "0 2px 8px rgba(16,185,129,0.35)",
              }}
            >
              Lihat
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}