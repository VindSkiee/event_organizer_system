import { Card, CardContent } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Separator } from "@/shared/ui/separator";
import { Calendar, DollarSign, User, Users } from "lucide-react";
import type { EventItem } from "@/shared/types";

function formatRupiah(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (!isFinite(num)) return "—";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num || 0);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Tidak ditentukan";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "Tidak ditentukan";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

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

interface EventHeaderProps {
  event: EventItem;
  currentUserId?: string;
}

export function EventHeader({ event, currentUserId }: EventHeaderProps) {
  const isCreatorSelf = !!(currentUserId && event.createdById === currentUserId);

  return (
    <Card className="border-0 ring-1 ring-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] rounded-2xl overflow-hidden">
      <CardContent className="p-6 sm:p-8">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="space-y-2">
            {/* Judul dan Badge */}
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-poppins tracking-tight">
                {event.title}
              </h1>
              <Badge
                variant="outline"
                className={`px-3 py-1 text-xs font-medium shadow-none ${eventStatusClassName(event.status)}`}
              >
                {eventStatusLabel(event.status)}
              </Badge>
            </div>

            {/* Informasi Pembuat */}
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <div className="flex items-center gap-1.5">
                <User className="h-4 w-4 text-slate-400" />
                <span className="font-medium">Dibuat oleh:</span>
                <span className="text-slate-800">{event.createdBy?.fullName || "Tidak diketahui"}</span>
              </div>
              {isCreatorSelf && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border-emerald-200 font-medium"
                >
                  Saya
                </Badge>
              )}
            </div>

            {/* Opsional: Tampilkan komunitas jika ada */}
            {event.communityGroup?.name && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Users className="h-3.5 w-3.5" />
                <span>{event.communityGroup.name}</span>
              </div>
            )}
          </div>

          {/* Info Ringkas (misal total hari, atau info lain) bisa ditambahkan di sini jika diperlukan */}
        </div>

        <Separator className="my-6" />

        {/* Info Grid - Anggaran dan Tanggal */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Estimasi Anggaran */}
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-emerald-50/80 ring-1 ring-emerald-100/50">
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Estimasi</p>
              <p className="text-base font-semibold text-slate-900 mt-0.5">
                {formatRupiah(event.budgetEstimated)}
              </p>
            </div>
          </div>

          {/* Anggaran Aktual */}
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-blue-50/80 ring-1 ring-blue-100/50">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Aktual</p>
              <p className="text-base font-semibold text-slate-900 mt-0.5">
                {event.budgetActual ? formatRupiah(event.budgetActual) : "—"}
              </p>
            </div>
          </div>

          {/* Tanggal Mulai */}
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-purple-50/80 ring-1 ring-purple-100/50">
              <Calendar className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Mulai</p>
              <p className="text-base font-semibold text-slate-900 mt-0.5">
                {formatDate(event.startDate)}
              </p>
            </div>
          </div>

          {/* Tanggal Selesai */}
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-orange-50/80 ring-1 ring-orange-100/50">
              <Calendar className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Selesai</p>
              <p className="text-base font-semibold text-slate-900 mt-0.5">
                {formatDate(event.endDate)}
              </p>
            </div>
          </div>
        </div>

        {/* Garis pemisah opsional jika ingin tambahan info di bawah */}
      </CardContent>
    </Card>
  );
}