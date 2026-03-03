import { DataTable, type ColumnDef } from "@/shared/components/DataTable";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";
import { formatRupiah, formatDate } from "@/shared/helpers/formatters";
import { getFundRequestStatusInfo } from "@/shared/helpers/statusConfig";
import type { FundRequest } from "@/shared/types";

interface FundRequestTableProps {
  fundRequests: FundRequest[];
  onApprove?: (fundRequest: FundRequest) => void;
  onReject?: (fundRequest: FundRequest) => void;
  onRowClick?: (fundRequest: FundRequest) => void;
  canApprove?: boolean;
}

export function FundRequestTable({
  fundRequests,
  onApprove,
  onReject,
  onRowClick,
  canApprove = false,
}: FundRequestTableProps) {
  const columns: ColumnDef<FundRequest>[] = [
    {
      key: "description",
      header: "Deskripsi",
      render: (fr) => (
        <>
          <p className="text-sm font-medium text-slate-900 truncate max-w-[180px]">
            {fr.description}
          </p>
          <p className="text-xs text-slate-500">{formatDate(fr.createdAt)}</p>
        </>
      ),
    },
    {
      key: "from",
      header: "Dari",
      render: (fr) => (
        <span className="text-sm text-slate-600">
          {fr.requesterGroup?.name || fr.communityGroup?.name || fr.createdBy?.fullName || fr.requestedBy?.fullName || "—"}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Jumlah",
      render: (fr) => (
        <span className="font-medium text-slate-900">
          {formatRupiah(fr.amount)}
        </span>
      ),
    },
    {
      key: "event",
      header: "Kegiatan",
      render: (fr) => (
        <span className="text-sm text-slate-500">{fr.event?.title || "—"}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (fr) => {
        const s = getFundRequestStatusInfo(fr.status);
        return (
          <Badge variant={s.variant} className={`text-[10px] ${s.className}`}>
            {s.label}
          </Badge>
        );
      },
    },
    ...(canApprove
      ? [
          {
            key: "actions",
            header: "Aksi",
            align: "right" as const,
            render: (fr: FundRequest) =>
              fr.status === "PENDING" ? (
                <div
                  className="flex items-center justify-end gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                    title="Setujui"
                    onClick={() => onApprove?.(fr)}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                    title="Tolak"
                    onClick={() => onReject?.(fr)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              ) : null,
          },
        ]
      : []),
  ];

  return (
    <DataTable
      columns={columns}
      data={fundRequests}
      keyExtractor={(fr) => fr.id}
      onRowClick={onRowClick}
      showRowNumber
      rowNumberPadded
    />
  );
}
