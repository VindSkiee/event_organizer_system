import { type ReactNode } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/shared/ui/table";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { Inbox, type LucideIcon } from "lucide-react";

// ─── Column Definition ───────────────────────────────────────────────

export interface ColumnDef<T> {
    key: string;
    header: string;
    /** Alignment default akan condong ke 'left' jika tidak diset, kecuali dikontrol logika index. */
    align?: "left" | "center" | "right";
    hideBelow?: "sm" | "md" | "lg";
    headerClassName?: string;
    cellClassName?: string;
    render: (item: T, index: number) => ReactNode;
}

// ─── DataTable Props ─────────────────────────────────────────────────

export interface DataTableProps<T> {
    columns: ColumnDef<T>[];
    data: T[];
    keyExtractor: (item: T) => string | number;

    loading?: boolean;
    loadingRows?: number;

    emptyIcon?: LucideIcon;
    emptyTitle?: string;
    emptyDescription?: string;

    onRowClick?: (item: T) => void;
    rowClassName?: (item: T, index: number) => string;

    showRowNumber?: boolean;
    rowNumberPadded?: boolean;

    /** Override the default label:value card layout for mobile (<md) with a custom renderer. */
    renderMobileCard?: (item: T, index: number) => ReactNode;

    footerText?: string;
    className?: string;
}

// ─── Helper maps ─────────────────────────────────────────────────────

const HIDE_CLASS: Record<string, string> = {
    sm: "hidden sm:table-cell",
    md: "hidden md:table-cell",
    lg: "hidden lg:table-cell",
};

const ALIGN_CLASS: Record<string, string> = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
};

// ─── Component ───────────────────────────────────────────────────────

export function DataTable<T>({
    columns,
    data,
    keyExtractor,
    loading = false,
    loadingRows = 4,
    emptyIcon: EmptyIcon = Inbox,
    emptyTitle = "Tidak ada data",
    emptyDescription,
    onRowClick,
    rowClassName,
    showRowNumber = false,
    rowNumberPadded = false,
    renderMobileCard,
    footerText,
    className,
}: DataTableProps<T>) {
    // ── Loading State ────────────────────────────────────────────────
    if (loading) {
        return (
            <div className={cn("p-4 space-y-4", className)}>
                {Array.from({ length: loadingRows }, (_, i) => (
                    <div key={i} className="flex items-center gap-4 animate-pulse">
                        <Skeleton className="h-10 w-full rounded-xl bg-slate-100/80" />
                    </div>
                ))}
            </div>
        );
    }

    // ── Empty State ──────────────────────────────────────────────────
    if (data.length === 0) {
        return (
            <div className={cn("flex flex-col items-center justify-center py-16 px-6 text-center", className)}>
                <div className="h-14 w-14 rounded-full bg-slate-50/80 ring-1 ring-slate-100 flex items-center justify-center mb-4 shadow-sm">
                    <EmptyIcon className="h-6 w-6 text-slate-400" strokeWidth={1.5} />
                </div>
                <h3 className="text-sm font-semibold text-slate-800 font-poppins">{emptyTitle}</h3>
                {emptyDescription && (
                    <p className="text-sm text-slate-500 mt-1.5 max-w-[250px] leading-relaxed">
                        {emptyDescription}
                    </p>
                )}
            </div>
        );
    }

    // ── Table ────────────────────────────────────────────────────────
    return (
        <div className={cn("w-full overflow-hidden rounded-2xl border-0 ring-1 ring-slate-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] bg-white", className)}>

            {/* ── Mobile Card View (< md) ──────────────────────────── */}
            <div className="md:hidden divide-y divide-slate-100">
                {data.map((item, idx) => (
                    <div
                        key={keyExtractor(item)}
                        className={cn(
                            "px-4 py-3.5",
                            !renderMobileCard && "space-y-2.5",
                            onRowClick && "cursor-pointer hover:bg-slate-50/80 active:bg-slate-100 transition-colors",
                            rowClassName?.(item, idx),
                        )}
                        onClick={onRowClick ? () => onRowClick(item) : undefined}
                    >
                        {renderMobileCard ? (
                            renderMobileCard(item, idx)
                        ) : (
                            <>
                                {showRowNumber && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">No.</span>
                                        <div className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-slate-100/50 text-[11px] font-medium text-slate-500">
                                            {rowNumberPadded ? (idx + 1).toString().padStart(2, "0") : idx + 1}
                                        </div>
                                    </div>
                                )}
                                {columns.map((col) => {
                                    const alignment = col.align ?? "left";
                                    return (
                                        <div key={col.key} className="flex items-start justify-between gap-3">
                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 shrink-0 pt-0.5 min-w-[90px]">
                                                {col.header}
                                            </span>
                                            <div className={cn("text-sm flex-1", ALIGN_CLASS[alignment], col.cellClassName)}>
                                                {col.render(item, idx)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </>
                        )}
                    </div>
                ))}
            </div>

            {/* ── Desktop Table View (≥ md) ────────────────────────── */}
            <div className="hidden md:block overflow-x-auto">
                <Table className="w-full text-sm border-collapse">
                    <TableHeader>
                        <TableRow className="border-b border-slate-100 bg-slate-50/50 hover:bg-slate-50/50">
                            {showRowNumber && (
                                <TableHead className="w-14 px-4 py-3.5 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                    No
                                </TableHead>
                            )}
                            {columns.map((col) => {
                                return (
                                    <TableHead
                                        key={col.key}
                                        className={cn(
                                            "px-4 py-3.5 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap",
                                            col.hideBelow && HIDE_CLASS[col.hideBelow],
                                            col.headerClassName,
                                        )}
                                    >
                                        {col.header}
                                    </TableHead>
                                );
                            })}
                        </TableRow>
                    </TableHeader>

                    {/* Menambahkan custom divider pada TableBody */}
                    <TableBody className="divide-y divide-slate-50/80">
                        {data.map((item, idx) => (
                            <TableRow
                                key={keyExtractor(item)}
                                className={cn(
                                    "group transition-colors duration-200 border-b border-slate-100 last:border-b-0",
                                    onRowClick && "cursor-pointer hover:bg-slate-50/80",
                                    rowClassName?.(item, idx),
                                )}
                                onClick={onRowClick ? () => onRowClick(item) : undefined}
                            >
                                {showRowNumber && (
                                    <TableCell className="px-4 py-3.5 text-center align-middle whitespace-nowrap">
                                        <div className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-slate-100/50 text-[11px] font-medium text-slate-500">
                                            {rowNumberPadded ? (idx + 1).toString().padStart(2, "0") : idx + 1}
                                        </div>
                                    </TableCell>
                                )}
                                {columns.map((col, colIdx) => {
                                    const isSecondVisualCol = showRowNumber ? colIdx === 0 : colIdx === 1;
                                    const alignment = col.align ?? (isSecondVisualCol ? "left" : "center");

                                    return (
                                        <TableCell
                                            key={col.key}
                                            className={cn(
                                                "px-4 py-3.5 align-middle",
                                                ALIGN_CLASS[alignment],
                                                col.hideBelow && HIDE_CLASS[col.hideBelow],
                                                col.cellClassName,
                                            )}
                                        >
                                            {col.render(item, idx)}
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {footerText && (
                <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/30 text-xs font-medium text-slate-500 text-center">
                    {footerText}
                </div>
            )}
        </div>
    );
}