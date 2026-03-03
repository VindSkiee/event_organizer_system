import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Calendar } from "@/shared/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/ui/popover";
import { CalendarIcon, Loader2, Download } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { toast } from "sonner";
import { downloadFinanceReport } from "@/features/finance/services/reportService";
import type { ChildWalletInfo } from "@/shared/types";
import type { DateRange } from "react-day-picker";

// ============================================================
// TIPE & KONSTANTA
// ============================================================

type ReportType = "summary" | "detail";
type TimePreset = "this_month" | "last_month" | "this_year" | "custom";

interface DownloadReportDialogProps {
  open: boolean;
  onClose: () => void;
  /** Daftar RT children – hanya relevan untuk LEADER (RW) */
  childGroups?: ChildWalletInfo[];
}

const TIME_PRESETS: { value: TimePreset; label: string }[] = [
  { value: "this_month", label: "Bulan Ini" },
  { value: "last_month", label: "Bulan Lalu" },
  { value: "this_year", label: "Tahun Ini" },
  { value: "custom", label: "Pilih Rentang Tanggal" },
];

// ============================================================
// KOMPONEN UTAMA
// ============================================================

export function DownloadReportDialog({
  open,
  onClose,
  childGroups = [],
}: DownloadReportDialogProps) {
  // ---- Data user dari localStorage ----
  const user = useMemo(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  const role: string = user?.role ?? "";
  const communityGroupId: number | undefined = user?.communityGroupId;

  const isLeader = role === "LEADER";
  // ADMIN otomatis download untuk groupnya sendiri

  // ---- State form ----
  const [reportType, setReportType] = useState<ReportType>("summary");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [timePreset, setTimePreset] = useState<TimePreset>("this_month");
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const [downloading, setDownloading] = useState(false);

  // ---- Derived dates ----
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    switch (timePreset) {
      case "this_month":
        return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
      case "last_month": {
        const prev = subMonths(now, 1);
        return { startDate: startOfMonth(prev), endDate: endOfMonth(prev) };
      }
      case "this_year":
        return { startDate: startOfYear(now), endDate: now };
      case "custom":
        return {
          startDate: customRange?.from ?? startOfMonth(now),
          endDate: customRange?.to ?? now,
        };
      default:
        return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
    }
  }, [timePreset, customRange]);

  // ---- Reset saat dialog dibuka/ditutup ----
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setReportType("summary");
      setSelectedGroupId("");
      setTimePreset("this_month");
      setCustomRange(undefined);
      onClose();
    }
  };

  // ---- Handler download ----
  const handleDownload = async () => {
    // Tentukan groupId berdasarkan role & pilihan
    let groupId: number | undefined;

    if (isLeader) {
      if (reportType === "detail" && selectedGroupId) {
        groupId = Number(selectedGroupId);
      }
      // summary → tidak perlu groupId (backend generate seluruh RW+RT)
    } else {
      // ADMIN → otomatis communityGroupId sendiri
      groupId = communityGroupId;
    }

    setDownloading(true);
    try {
      await downloadFinanceReport({
        reportType: isLeader ? reportType : "detail",
        groupId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      toast.success("Laporan berhasil diunduh!");
      handleOpenChange(false);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message;
      toast.error(message || "Gagal mengunduh laporan. Silakan coba lagi.");
    } finally {
      setDownloading(false);
    }
  };

  // ---- Validasi tombol ----
  const canSubmit = useMemo(() => {
    if (timePreset === "custom" && !customRange?.from) return false;
    if (isLeader && reportType === "detail" && !selectedGroupId) return false;
    return true;
  }, [timePreset, customRange, isLeader, reportType, selectedGroupId]);

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-poppins flex items-center gap-2">
            <Download className="h-5 w-5" />
            Unduh Laporan Keuangan
          </DialogTitle>
          <DialogDescription>
            {isLeader
              ? "Pilih tipe laporan dan rentang waktu untuk menghasilkan file PDF."
              : "Laporan keuangan akan dihasilkan sesuai lingkup lingkungan Anda."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* === TIPE LAPORAN (hanya LEADER) === */}
          {isLeader && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Tipe Laporan</Label>
              <Select
                value={reportType}
                onValueChange={(v) => {
                  setReportType(v as ReportType);
                  setSelectedGroupId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih tipe laporan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="summary">
                    Ringkasan Eksekutif (Seluruh RW & RT)
                  </SelectItem>
                  <SelectItem value="detail">
                    Detail Per Lingkungan
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* === PILIH LINGKUNGAN (hanya LEADER + reportType detail) === */}
          {isLeader && reportType === "detail" && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Pilih Lingkungan</Label>
              <Select
                value={selectedGroupId}
                onValueChange={setSelectedGroupId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih RT / Kas RW" />
                </SelectTrigger>
                <SelectContent>
                  {/* Opsi Kas RW sendiri */}
                  {communityGroupId && (
                    <SelectItem value={String(communityGroupId)}>
                      Kas RW (Pusat)
                    </SelectItem>
                  )}
                  {/* Opsi setiap RT */}
                  {childGroups.map((child) => (
                    <SelectItem
                      key={child.group.id}
                      value={String(child.group.id)}
                    >
                      {child.group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* === FILTER WAKTU === */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Rentang Waktu</Label>
            <Select
              value={timePreset}
              onValueChange={(v) => setTimePreset(v as TimePreset)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* === DATE RANGE PICKER (hanya untuk "custom") === */}
          {timePreset === "custom" && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Pilih Tanggal</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customRange?.from ? (
                      customRange.to ? (
                        <>
                          {format(customRange.from, "d MMM yyyy", {
                            locale: idLocale,
                          })}{" "}
                          –{" "}
                          {format(customRange.to, "d MMM yyyy", {
                            locale: idLocale,
                          })}
                        </>
                      ) : (
                        format(customRange.from, "d MMM yyyy", {
                          locale: idLocale,
                        })
                      )
                    ) : (
                      <span className="text-muted-foreground">
                        Pilih rentang tanggal
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={customRange}
                    onSelect={setCustomRange}
                    numberOfMonths={2}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* === PREVIEW RENTANG === */}
          <div className="rounded-lg border bg-slate-50 p-3 text-sm text-slate-600">
            <span className="font-medium">Periode:</span>{" "}
            {format(startDate, "d MMMM yyyy", { locale: idLocale })} –{" "}
            {format(endDate, "d MMMM yyyy", { locale: idLocale })}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={downloading}
          >
            Batal
          </Button>
          <Button
            onClick={handleDownload}
            disabled={!canSubmit || downloading}
            className="gap-2"
          >
            {downloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Mengunduh...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Unduh PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
