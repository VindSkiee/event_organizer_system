import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/ui/popover";
import { Calendar } from "@/shared/ui/calendar";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { EventItem } from "@/shared/types";

function formatRupiah(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num || 0);
}

interface EditEventDialogProps {
  event: EventItem | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description: string;
    budgetEstimated: number;
    startDate?: string;
    endDate?: string;
  }) => void;
}

export function EditEventDialog({
  event,
  submitting,
  onClose,
  onSubmit,
}: EditEventDialogProps) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    budgetEstimated: "",
  });
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    if (event) {
      setForm({
        title: event.title,
        description: event.description,
        budgetEstimated: new Intl.NumberFormat("id-ID").format(
          parseFloat(event.budgetEstimated)
        ),
      });
      setStartDate(event.startDate ? new Date(event.startDate) : undefined);
      setEndDate(event.endDate ? new Date(event.endDate) : undefined);
    }
  }, [event]);

  const handleSubmit = () => {
    const raw = form.budgetEstimated.replace(/\D/g, "");
    const budget = raw ? parseFloat(raw) : 0;
    if (!isFinite(budget) || budget <= 0) return; // Guard NaN
    if (!form.title.trim() || !form.description.trim()) return;
    onSubmit({
      title: form.title.trim(),
      description: form.description.trim(),
      budgetEstimated: budget,
      startDate: startDate?.toISOString(),
      endDate: endDate?.toISOString(),
    });
  };

  return (
    <Dialog open={!!event} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-poppins">Edit Kegiatan</DialogTitle>
          <DialogDescription>
            Perbarui detail kegiatan. Hanya dapat diedit jika status masih DRAFT.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="edit-event-title">Judul Kegiatan *</Label>
            <Input
              id="edit-event-title"
              placeholder="Contoh: Kerja Bakti Lingkungan"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-event-desc">Deskripsi *</Label>
            <Textarea
              id="edit-event-desc"
              placeholder="Jelaskan detail kegiatan..."
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-event-budget">Estimasi Anggaran (IDR) *</Label>
            <Input
              id="edit-event-budget"
              placeholder="500000"
              value={form.budgetEstimated}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, "");
                setForm((f) => ({
                  ...f,
                  budgetEstimated: raw
                    ? new Intl.NumberFormat("id-ID").format(Number(raw))
                    : "",
                }));
              }}
            />
            {form.budgetEstimated && (
              <p className="text-xs text-slate-500">
                {formatRupiah(Number(form.budgetEstimated.replace(/\D/g, "")))}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tanggal Mulai</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate
                      ? format(startDate, "dd MMM yyyy", { locale: idLocale })
                      : "Pilih tanggal"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Tanggal Selesai</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate
                      ? format(endDate, "dd MMM yyyy", { locale: idLocale })
                      : "Pilih tanggal"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(date) => (startDate ? date < startDate : false)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Simpan Perubahan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
