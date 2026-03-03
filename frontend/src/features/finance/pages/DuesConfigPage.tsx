import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { financeService } from "@/features/finance/services/financeService";
import type { DuesConfig } from "@/features/finance/types";
import {
  DuesRuleCard,
  DuesConfigForm,
  ChildrenDuesTable,
} from "@/features/finance/components";

export default function DuesConfigPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<DuesConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // Get user role from localStorage
  const userRole = (() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored).role : null;
    } catch {
      return null;
    }
  })();

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const data = await financeService.getDuesConfig();
      setConfig(data);
    } catch {
      toast.error("Gagal memuat konfigurasi iuran.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-poppins text-slate-900">
            Pengaturan Biaya Iuran
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">
            Atur nominal dan tanggal jatuh tempo iuran untuk{" "}
            {config?.group.name || "grup Anda"}.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-60 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : config ? (
        <div className="space-y-6">
          {/* Current DuesRule Card */}
          <DuesRuleCard
            info={{
              group: config.group,
              duesRule: config.duesRule,
            }}
            highlight
          />

          {/* Configuration Form */}
          <DuesConfigForm
            currentRule={config.duesRule}
            groupName={config.group.name}
            onSuccess={fetchConfig}
            userRole={userRole}
          />

          {/* Children DuesRules Table (for RW/LEADER) */}
          {config.children.length > 0 && (
            <ChildrenDuesTable children={config.children} />
          )}
        </div>
      ) : (
        <div className="text-center py-10 text-slate-500">
          <p>Tidak dapat memuat data konfigurasi iuran.</p>
        </div>
      )}
    </div>
  );
}
