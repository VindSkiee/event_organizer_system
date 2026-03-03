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
import { Textarea } from "@/shared/ui/textarea";
import { Label } from "@/shared/ui/label";
import { FileCheck2, Upload, X, ImageIcon } from "lucide-react";

interface SettleEventDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (description: string, photoFiles: File[]) => Promise<void>;
}

export function SettleEventDialog({
  open,
  onClose,
  onSubmit,
}: SettleEventDialogProps) {
  const [description, setDescription] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      setPhotoFiles((prev) => [...prev, ...newFiles]);
      setPhotoPreviews((prev) => [...prev, ...newPreviews]);
    } finally {
      setCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeFile = (idx: number) => {
    URL.revokeObjectURL(photoPreviews[idx]);
    setPhotoFiles((prev) => prev.filter((_, i) => i !== idx));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (description.trim().length < 10) return;
    setSubmitting(true);
    try {
      await onSubmit(description.trim(), photoFiles);
      setDescription("");
      setPhotoFiles([]);
      photoPreviews.forEach((url) => URL.revokeObjectURL(url));
      setPhotoPreviews([]);
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = description.trim().length >= 10;

  // Cleanup object URLs saat dialog ditutup tanpa submit
  const handleClose = () => {
    photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    setDescription("");
    setPhotoFiles([]);
    setPhotoPreviews([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck2 className="h-5 w-5 text-green-600" />
            Selesaikan & Buat Laporan
          </DialogTitle>
          <DialogDescription>
            Tulis laporan hasil kegiatan dan lampirkan foto dokumentasi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="settle-description">Laporan Hasil Kegiatan *</Label>
            <Textarea
              id="settle-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Jelaskan ringkasan pelaksanaan kegiatan, pencapaian, dan hasil yang diperoleh... (min. 10 karakter)"
              rows={5}
            />
            <p className="text-xs text-slate-400">
              {description.length}/10 karakter minimum
            </p>
          </div>

          {/* Photo Upload */}
          <div className="space-y-2">
            <Label>Foto Dokumentasi</Label>
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
                  Upload Foto Hasil Kegiatan
                </>
              )}
            </Button>

            {photoPreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {photoPreviews.map((url, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={url}
                      alt={`Foto ${idx + 1}`}
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
            {photoPreviews.length === 0 && (
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
          <Button
            onClick={handleSubmit}
            disabled={!isValid || submitting || compressing}
            className="bg-green-600 hover:bg-green-700"
          >
            {submitting ? "Memproses..." : "Selesaikan Kegiatan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
