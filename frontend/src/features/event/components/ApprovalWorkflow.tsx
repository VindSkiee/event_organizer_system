import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { CheckCircle2 } from "lucide-react";
import type { EventItem } from "@/shared/types";

const approvalStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    PENDING: "Menunggu",
    APPROVED: "Disetujui",
    REJECTED: "Ditolak",
  };
  return labels[status] || status;
};

const approvalStatusVariant = (
  status: string
): "default" | "secondary" | "destructive" | "outline" => {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    PENDING: "outline",
    APPROVED: "default",
    REJECTED: "destructive",
  };
  return variants[status] || "outline";
};

const approvalStatusClassName = (status: string): string => {
  if (status === "PENDING") return "bg-yellow-50 text-yellow-700 border-yellow-200";
  return "";
};

interface ApprovalWorkflowProps {
  event: EventItem;
}

export function ApprovalWorkflow({ event }: ApprovalWorkflowProps) {
  if (!event.approvals || event.approvals.length === 0) {
    return null;
  }

  // Sort once with a copy to avoid mutating the prop array
  const sortedApprovals = useMemo(
    () => [...event.approvals!].sort((a, b) => a.stepOrder - b.stepOrder),
    [event.approvals]
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          Alur Persetujuan
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-slate-100 rounded-lg border overflow-hidden">
          {sortedApprovals
            .map((approval) => (
              <div key={approval.id} className="px-4 py-3.5 space-y-2.5 bg-white">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Langkah</span>
                  <span className="text-sm font-semibold text-slate-700">#{approval.stepOrder}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Peran</span>
                  <span className="text-sm text-slate-700">{approval.roleSnapshot}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Status</span>
                  <Badge variant={approvalStatusVariant(approval.status)}>
                    {approvalStatusLabel(approval.status)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Penyetuju</span>
                  <span className="text-sm text-slate-700">{approval.approver?.fullName || "-"}</span>
                </div>
                {approval.notes && (
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 shrink-0 pt-0.5">Catatan</span>
                    <span className="text-sm text-slate-600 text-right">{approval.notes}</span>
                  </div>
                )}
              </div>
            ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center">Langkah</TableHead>
                <TableHead className="text-center">Peran</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Penyetuju</TableHead>
                <TableHead className="text-center">Catatan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedApprovals
                .map((approval) => (
                  <TableRow key={approval.id}>
                    <TableCell className="font-medium text-center">{approval.stepOrder}</TableCell>
                    <TableCell className="text-center">{approval.roleSnapshot}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={approvalStatusVariant(approval.status)} className={approvalStatusClassName(approval.status)}>
                        {approvalStatusLabel(approval.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{approval.approver?.fullName || "-"}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {approval.notes || "-"}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
