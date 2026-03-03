import { useEffect, useState, useCallback } from "react";
import { Save, RotateCcw, Tags, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { Badge } from "@/shared/ui/badge";
import { Separator } from "@/shared/ui/separator";
import { settingsService, type RoleLabelItem } from "@/shared/services/settingsService";
import { refreshRoleLabels } from "@/shared/helpers/roleLabel";
import { emitSidebarUpdate } from "@/shared/helpers/sidebarEvents";

// Default labels per role
const ROLE_DEFAULTS: { roleType: string; default: string; description: string }[] = [
  { roleType: "LEADER", default: "LEADER", description: "Peran tertinggi di tingkat RW" },
  { roleType: "ADMIN", default: "ADMIN", description: "Peran pengelola di tingkat RT" },
  { roleType: "TREASURER", default: "TREASURER", description: "Peran pengelola keuangan" },
  { roleType: "RESIDENT", default: "RESIDENT", description: "Peran umum warga biasa" },
];

interface LabelForm {
  roleType: string;
  label: string;
  isCustom: boolean;
  saving: boolean;
  resetting: boolean;
}

export default function RoleLabelSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState<LabelForm[]>([]);

  const fetchLabels = useCallback(async () => {
    setLoading(true);
    try {
      const items = await settingsService.getRoleLabels();
      const customMap = new Map<string, RoleLabelItem>();
      items.forEach((item) => customMap.set(item.roleType, item));

      setForms(
        ROLE_DEFAULTS.map((rd) => ({
          roleType: rd.roleType,
          label: customMap.get(rd.roleType)?.label || "",
          isCustom: customMap.has(rd.roleType),
          saving: false,
          resetting: false,
        }))
      );
    } catch {
      toast.error("Gagal memuat data label peran.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLabels();
  }, [fetchLabels]);

  const updateForm = (roleType: string, patch: Partial<LabelForm>) => {
    setForms((prev) =>
      prev.map((f) => (f.roleType === roleType ? { ...f, ...patch } : f))
    );
  };

  const handleSave = async (roleType: string) => {
    const form = forms.find((f) => f.roleType === roleType);
    if (!form) return;

    const trimmed = form.label.trim();
    if (!trimmed) {
      toast.error("Label tidak boleh kosong.");
      return;
    }
    if (trimmed.length > 50) {
      toast.error("Label maksimal 50 karakter.");
      return;
    }

    updateForm(roleType, { saving: true });
    try {
      await settingsService.upsertRoleLabel({ roleType, label: trimmed });
      await refreshRoleLabels();
      emitSidebarUpdate();
      updateForm(roleType, { saving: false, isCustom: true, label: trimmed });
      toast.success(`Label "${roleType}" berhasil disimpan.`);
    } catch {
      updateForm(roleType, { saving: false });
      toast.error("Gagal menyimpan label.");
    }
  };

  const handleReset = async (roleType: string) => {
    updateForm(roleType, { resetting: true });
    try {
      await settingsService.deleteRoleLabel(roleType);
      await refreshRoleLabels();
      emitSidebarUpdate();
      updateForm(roleType, { resetting: false, isCustom: false, label: "" });
      const def = ROLE_DEFAULTS.find((r) => r.roleType === roleType);
      toast.success(`Label "${roleType}" dikembalikan ke default: "${def?.default}".`);
    } catch {
      updateForm(roleType, { resetting: false });
      toast.error("Gagal mengembalikan label.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-poppins text-slate-900">
            Pengaturan Label Peran
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">
            Sesuaikan nama tampilan untuk setiap peran di organisasi Anda.
          </p>
        </div>
      </div>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="flex items-start gap-3 pt-5 pb-5">
          <Tags className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800 leading-relaxed">
            Label kustom akan ditampilkan di seluruh aplikasi sebagai pengganti nama peran default.
            Misalnya, "Ketua RW" bisa diganti menjadi "RW 05" sesuai kebutuhan.
            Klik <strong>Reset</strong> untuk mengembalikan ke label default.
          </p>
        </CardContent>
      </Card>

      {/* Role Label Forms */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4">
          {forms.map((form) => {
            const meta = ROLE_DEFAULTS.find((r) => r.roleType === form.roleType)!;
            return (
              <Card key={form.roleType} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-poppins flex items-center gap-2">
                        {form.roleType}
                        {form.isCustom ? (
                          <Badge variant="default" className="text-[10px] px-2 py-0 bg-brand-green">
                            Kustom
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] px-2 py-0">
                            Default
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>{meta.description}</CardDescription>
                    </div>
                    
                  </div>
                </CardHeader>

                <Separator />

                <CardContent className="pt-4">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor={`label-${form.roleType}`} className="text-sm font-medium">
                        Label Tampilan
                      </Label>
                      <Input
                        id={`label-${form.roleType}`}
                        placeholder={meta.default}
                        value={form.label}
                        onChange={(e) =>
                          updateForm(form.roleType, { label: e.target.value })
                        }
                        maxLength={50}
                        className="max-w-md"
                      />
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <Button
                        onClick={() => handleSave(form.roleType)}
                        disabled={form.saving || form.resetting || !form.label.trim()}
                        size="sm"
                        className="bg-brand-green hover:bg-brand-green/90"
                      >
                        {form.saving ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Save className="h-4 w-4 mr-1" />
                        )}
                        Simpan
                      </Button>

                      {form.isCustom && (
                        <Button
                          variant="outline"
                          onClick={() => handleReset(form.roleType)}
                          disabled={form.saving || form.resetting}
                          size="sm"
                        >
                          {form.resetting ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <RotateCcw className="h-4 w-4 mr-1" />
                          )}
                          Reset
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
