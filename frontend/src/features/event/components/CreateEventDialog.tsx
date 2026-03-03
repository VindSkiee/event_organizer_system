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
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Checkbox } from "@/shared/ui/checkbox";
import { ScrollArea } from "@/shared/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/ui/popover";
import { Calendar } from "@/shared/ui/calendar";
import { CalendarIcon, Loader2, Info } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { UserItem } from "@/shared/types";

function formatRupiah(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num || 0);
}

interface CreateEventDialogProps {
  open: boolean;
  allUsers: UserItem[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description: string;
    budgetEstimated: number;
    startDate?: string;
    endDate?: string;
    committeeUserIds?: string[];
  }) => void;
}

export function CreateEventDialog({
  open,
  allUsers,
  submitting,
  onClose,
  onSubmit,
}: CreateEventDialogProps) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    budgetEstimated: "",
  });
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [committeeUserIds, setCommitteeUserIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");

  // === 1. DAPATKAN INFO USER LOGIN DAN BENDAHARA GRUP ===
  const currentUser = useMemo(() => {
    try {
      const u = localStorage.getItem("user");
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  }, []);

  const groupTreasurer = useMemo(() => {
    if (!allUsers || !currentUser) return null;
    return allUsers.find((u) => {
      const role = u?.roleType || u?.role?.type;
      return role === "TREASURER" && u.communityGroupId === currentUser.communityGroupId;
    });
  }, [allUsers, currentUser]);

  const resetForm = () => {
    setForm({ title: "", description: "", budgetEstimated: "" });
    setStartDate(undefined);
    setEndDate(undefined);
    setCommitteeUserIds([]);
    setUserSearch("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = () => {
    const raw = form.budgetEstimated.replace(/\D/g, "");
    const budget = raw ? parseFloat(raw) : 0;
    if (!isFinite(budget) || budget <= 0) return; // Guard NaN dan nilai invalid
    
    // Validasi field wajib
    if (!form.title.trim() || !form.description.trim()) return;
    
    // === 2. GABUNGKAN ID PANITIA DENGAN ID BENDAHARA SECARA OTOMATIS ===
    let finalCommitteeIds = [...committeeUserIds];
    if (groupTreasurer && !finalCommitteeIds.includes(groupTreasurer.id)) {
      finalCommitteeIds.push(groupTreasurer.id);
    }

    onSubmit({
      title: form.title.trim(),
      description: form.description.trim(),
      budgetEstimated: budget,
      startDate: startDate?.toISOString(),
      endDate: endDate?.toISOString(),
      committeeUserIds: finalCommitteeIds.length > 0 ? finalCommitteeIds : undefined,
    });
    resetForm();
  };

  const toggleCommitteeMember = (userId: string) => {
    setCommitteeUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const filteredUsers = (allUsers || []).filter((u) => {
    const role = u?.roleType || u?.role?.type || "RESIDENT";
    
    if (["LEADER", "ADMIN", "TREASURER"].includes(role)) {
      return false;
    }

    const name = u?.fullName?.toLowerCase() || "";
    const email = u?.email?.toLowerCase() || "";
    const search = userSearch.toLowerCase();
    
    return name.includes(search) || email.includes(search);
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-poppins">Buat Acara Baru</DialogTitle>
          <DialogDescription>
            Isi detail kegiatan yang ingin diajukan.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="event-title">Judul Kegiatan *</Label>
            <Input
              id="event-title"
              placeholder="Contoh: Kerja Bakti Lingkungan"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-desc">Deskripsi *</Label>
            <Textarea
              id="event-desc"
              placeholder="Jelaskan detail kegiatan..."
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-budget">Estimasi Anggaran (IDR) *</Label>
            <Input
              id="event-budget"
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

          <div className="space-y-2">
            <Label>Panitia / Anggota Komite</Label>
            <Input
              placeholder="Cari anggota..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="mb-2"
            />
            <ScrollArea className="h-40 rounded-md border p-2">
              {filteredUsers.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  Tidak ada pengguna ditemukan.
                </p>
              ) : (
                filteredUsers.map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-slate-50 cursor-pointer"
                  >
                    <Checkbox
                      checked={committeeUserIds.includes(u.id)}
                      onCheckedChange={() => toggleCommitteeMember(u.id)}
                    />
                    <span className="text-sm text-slate-800">{u.fullName}</span>
                    <span className="text-xs text-slate-400 ml-auto">{u.email}</span>
                  </label>
                ))
              )}
            </ScrollArea>
            
            <div className="flex flex-col gap-2 mt-2">
              {committeeUserIds.length > 0 && (
                <p className="text-xs text-slate-500 font-medium">
                  {committeeUserIds.length} anggota dipilih
                </p>
              )}
              
              {/* === 3. TAMPILKAN INFO JIKA BENDAHARA DITEMUKAN === */}
              {groupTreasurer && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-50 border border-blue-100 text-blue-700">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-tight">
                    Bendahara grup Anda <strong>({groupTreasurer.fullName})</strong> akan otomatis ditambahkan sebagai panitia untuk mengelola alur kas kegiatan.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Buat Kegiatan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}