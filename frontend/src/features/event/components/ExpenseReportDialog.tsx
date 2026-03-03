import { useState, useRef } from "react";
import imageCompression from "browser-image-compression";
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
import { Receipt, Plus, X, Upload, ImageIcon } from "lucide-react";

interface ExpenseItem {
  title: string;
  amount: string;
}

interface ExpenseReportDialogProps {
  open: boolean;
  onClose: () => void;
  budgetEstimated: number;
  onSubmit: (
    items: { title: string; amount: number }[],
    remainingAmount: number,
    receiptFiles: File[],
  ) => Promise<void>;
}

export function ExpenseReportDialog({
  open,
  onClose,
  budgetEstimated,
  onSubmit,
}: ExpenseReportDialogProps) {
  const [items, setItems] = useState<ExpenseItem[]>([{ title: "", amount: "" }]);
  const [remainingAmount, setRemainingAmount] = useState("");
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
  const [receiptPreviews, setReceiptPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addItem = () => {
    setItems((prev) => [...prev, { title: "", amount: "" }]);
  };

  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof ExpenseItem, value: string) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  };

  const totalExpenses = items.reduce((sum, item) => {
    const amount = parseFloat(item.amount);
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);

  const parsedRemaining = parseFloat(remainingAmount) || 0;
  const calculatedTotal = totalExpenses + parsedRemaining;
  const isBalanced = Math.abs(calculatedTotal - budgetEstimated) < 1;

  const allItemsValid = items.every(
    (item) => item.title.trim().length > 0 && parseFloat(item.amount) > 0
  );

  const isValid = allItemsValid && items.length > 0 && parsedRemaining >= 0 && isBalanced;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setCompressing(true);
    try {
      const newFiles: File[] = [];
      const newPreviews: string[] = [];

      for (const file of Array.from(files)) {
        const compressed = await imageCompression(file, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1200,
          fileType: "image/webp",
          useWebWorker: true,
        });
        newFiles.push(compressed);
        newPreviews.push(URL.createObjectURL(compressed));
      }

      setReceiptFiles((prev) => [...prev, ...newFiles]);
      setReceiptPreviews((prev) => [...prev, ...newPreviews]);
    } finally {
      setCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeFile = (idx: number) => {
    URL.revokeObjectURL(receiptPreviews[idx]);
    setReceiptFiles((prev) => prev.filter((_, i) => i !== idx));
    setReceiptPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    try {
      const parsedItems = items.map((item) => ({
        title: item.title.trim(),
        amount: parseFloat(item.amount),
      }));
      await onSubmit(parsedItems, parsedRemaining, receiptFiles);
      // Reset
      setItems([{ title: "", amount: "" }]);
      setRemainingAmount("");
      setReceiptFiles([]);
      receiptPreviews.forEach((url) => URL.revokeObjectURL(url));
      setReceiptPreviews([]);
    } finally {
      setSubmitting(false);
    }
  };

  const formatRp = (n: number) =>
    `Rp${n.toLocaleString("id-ID")}`;

  // Cleanup object URLs saat dialog ditutup tanpa submit
  const handleClose = () => {
    receiptPreviews.forEach((url) => URL.revokeObjectURL(url));
    setItems([{ title: "", amount: "" }]);
    setRemainingAmount("");
    setReceiptFiles([]);
    setReceiptPreviews([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Laporan Pengeluaran
          </DialogTitle>
          <DialogDescription>
            Input daftar belanja, upload bukti nota, dan sisa uang. Dana dicairkan:{" "}
            <strong>{formatRp(budgetEstimated)}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Expense Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Daftar Belanja *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Tambah Item
              </Button>
            </div>

            {items.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-start">
                <div className="flex-1 space-y-1">
                  <Input
                    value={item.title}
                    onChange={(e) => updateItem(idx, "title", e.target.value)}
                    placeholder="Nama belanja (misal: Konsumsi)"
                    className="text-sm"
                  />
                </div>
                <div className="w-40 space-y-1">
                  <Input
                    type="number"
                    min={0}
                    value={item.amount}
                    onChange={(e) => updateItem(idx, "amount", e.target.value)}
                    placeholder="Jumlah (Rp)"
                    className="text-sm"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(idx)}
                  disabled={items.length <= 1}
                  className="shrink-0 mt-0.5"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {/* Total Expenses row */}
            <div className="flex justify-between items-center pt-2 border-t text-sm">
              <span className="font-medium text-slate-600">Total Belanja:</span>
              <span className="font-semibold">{formatRp(totalExpenses)}</span>
            </div>
          </div>

          {/* Remaining Amount */}
          <div className="space-y-2">
            <Label htmlFor="remaining-amount">Sisa Uang (Rp) *</Label>
            <Input
              id="remaining-amount"
              type="number"
              min={0}
              value={remainingAmount}
              onChange={(e) => setRemainingAmount(e.target.value)}
              placeholder="0"
            />
            {/* Balance check */}
            <div className="text-xs space-y-1">
              <div className="flex justify-between text-slate-500">
                <span>Total Belanja + Sisa:</span>
                <span className={isBalanced ? "text-green-600" : "text-red-500"}>
                  {formatRp(calculatedTotal)}
                </span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Dana Dicairkan:</span>
                <span>{formatRp(budgetEstimated)}</span>
              </div>
              {!isBalanced && calculatedTotal > 0 && (
                <p className="text-red-500 font-medium">
                  ⚠ Selisih {formatRp(Math.abs(calculatedTotal - budgetEstimated))} — pastikan total
                  belanja + sisa uang = dana yang dicairkan.
                </p>
              )}
              {isBalanced && calculatedTotal > 0 && (
                <p className="text-green-600 font-medium">✓ Sesuai</p>
              )}
            </div>
          </div>

          {/* Receipt Image Upload */}
          <div className="space-y-2">
            <Label>Bukti Nota / Struk</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={compressing}
              className="w-full"
            >
              {compressing ? (
                "Mengompresi gambar..."
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Foto Nota
                </>
              )}
            </Button>

            {receiptPreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {receiptPreviews.map((url, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={url}
                      alt={`Nota ${idx + 1}`}
                      className="w-full h-24 object-cover rounded-lg border"
                    />
                    <button
                      onClick={() => removeFile(idx)}
                      className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {receiptPreviews.length === 0 && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <ImageIcon className="h-3.5 w-3.5" />
                <span>Foto akan dikompres otomatis sebelum diupload</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || submitting || compressing}>
            {submitting ? "Mengirim..." : "Submit Laporan & Mulai Acara"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
