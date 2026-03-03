import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { Megaphone, CalendarDays } from "lucide-react";
import type { EventItem } from "@/shared/types";

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return "Segera";
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMinutes < 1) return "Baru saja";
  if (diffMinutes < 60) return `${diffMinutes} menit lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  if (diffDays < 7) return `${diffDays} hari lalu`;
  if (diffWeeks < 5) return `${diffWeeks} minggu lalu`;
  return `${diffMonths} bulan lalu`;
}

function getEventStatusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "APPROVED":
    case "FUNDED":
    case "COMPLETED":
    case "SETTLED":
      return "default";
    case "SUBMITTED":
    case "UNDER_REVIEW":
    case "ONGOING":
      return "secondary";
    case "REJECTED":
    case "CANCELLED":
      return "destructive";
    default:
      return "outline";
  }
}

function getEventStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    DRAFT: "Draf",
    SUBMITTED: "Diajukan",
    UNDER_REVIEW: "Ditinjau",
    REJECTED: "Ditolak",
    APPROVED: "Disetujui",
    CANCELLED: "Dibatalkan",
    FUNDED: "Didanai",
    ONGOING: "Berlangsung",
    COMPLETED: "Selesai",
    SETTLED: "Tuntas",
  };
  return labels[status] || status;
}

interface AnnouncementSectionProps {
  events: EventItem[];
  loading: boolean;
}

export function AnnouncementSection({ events, loading }: AnnouncementSectionProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Megaphone className="h-5 w-5 text-amber-500" />
        <h2 className="text-lg sm:text-xl font-semibold font-poppins text-slate-900">
          Pengumuman & Kegiatan
        </h2>
      </div>

      {loading ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-1" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : events.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <CalendarDays className="h-10 w-10 text-slate-300 mb-3" />
            <p className="text-sm text-slate-500 font-medium">
              Belum ada pengumuman atau kegiatan saat ini.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Kegiatan dan pengumuman dari lingkungan Anda akan tampil di sini.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Link key={event.id} to={`/dashboard/events/${event.id}`} className="block">
              <Card className="h-full transition-all hover:shadow-md hover:border-primary/30 cursor-pointer group">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm sm:text-base font-semibold text-slate-900 line-clamp-2 group-hover:text-primary transition-colors">
                      {event.title}
                    </CardTitle>
                    <Badge
                      variant={getEventStatusVariant(event.status)}
                      className="shrink-0 text-[10px] sm:text-xs"
                    >
                      {getEventStatusLabel(event.status)}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-slate-400 mt-1">
                    {timeAgo(event.createdAt)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs sm:text-sm text-slate-600 line-clamp-3">
                    {event.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
