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
import { Textarea } from "@/shared/ui/textarea";
import { Loader2 } from "lucide-react";
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

interface ApprovalDialogProps {
  event: EventItem | null;
  action: "approve" | "reject" | null;
  notes: string;
  submitting: boolean;
  onNotesChange: (notes: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function ApprovalDialog({
  event,
  action,
  notes,
  submitting,
  onNotesChange,
  onSubmit,
  onClose,
}: ApprovalDialogProps) {
  return (
    <Dialog open={!!event && !!action} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-poppins">
            {action === "approve" ? "Setujui Kegiatan" : "Tolak Kegiatan"}
          </DialogTitle>
          <DialogDescription>
            {action === "approve"
              ? `Anda akan menyetujui kegiatan "${event?.title}".`
              : `Anda akan menolak kegiatan "${event?.title}".`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {event && (
            <div className="rounded-lg bg-slate-50 p-3 space-y-1.5">
              <p className="text-sm font-medium text-slate-900">{event.title}</p>
              <p className="text-xs text-slate-500">{event.description}</p>
              <p className="text-xs text-slate-500">
                Anggaran: {formatRupiah(event.budgetEstimated)}
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="approval-notes">
              Catatan {action === "reject" ? "*" : "(opsional)"}
            </Label>
            <Textarea
              id="approval-notes"
              placeholder={
                action === "approve"
                  ? "Catatan tambahan (opsional)..."
                  : "Alasan penolakan..."
              }
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            onClick={onSubmit}
            disabled={submitting || (action === "reject" && !notes.trim())}
            variant={action === "approve" ? "default" : "destructive"}
          >
            {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {action === "approve" ? "Setujui" : "Tolak"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
