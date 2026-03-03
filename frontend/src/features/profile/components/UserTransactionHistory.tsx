import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { DataTable, type ColumnDef } from "@/shared/components/DataTable";
import { Shield, Filter } from "lucide-react";
import { formatRupiah, formatDate } from "@/shared/helpers/formatters";
import type { Transaction } from "@/shared/types";

const columns: ColumnDef<Transaction>[] = [
  {
    key: "description",
    header: "Deskripsi",
    cellClassName: "text-sm text-slate-800 max-w-[180px] sm:max-w-md truncate",
    render: (tx) => tx.description || "-",
  },
  {
    key: "type",
    header: "Tipe",
    render: (tx) => (
      <Badge
        variant={tx.type === "CREDIT" ? "default" : "destructive"}
        className={`text-[10px] ${
          tx.type === "CREDIT"
            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none"
            : "bg-red-100 text-red-700 hover:bg-red-200 border-none"
        }`}
      >
        {tx.type === "CREDIT" ? "Pemasukan" : "Pengeluaran"}
      </Badge>
    ),
  },
  {
    key: "amount",
    header: "Jumlah",
    render: (tx) => (
      <span
        className={`font-medium whitespace-nowrap ${
          tx.type === "CREDIT" ? "text-emerald-600" : "text-red-600"
        }`}
      >
        {tx.type === "CREDIT" ? "+" : "-"}
        {formatRupiah(Number(tx.amount || 0))}
      </span>
    ),
  },
  {
    key: "date",
    header: "Tanggal",
    render: (tx) => (
      <span className="text-sm text-slate-500 whitespace-nowrap">
        {formatDate(tx.createdAt)}
      </span>
    ),
  },
];

interface UserTransactionHistoryProps {
  transactions?: Transaction[]; // Opsional agar tidak crash jika belum di-load
}

export function UserTransactionHistory({ transactions = [] }: UserTransactionHistoryProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "CREDIT" | "DEBIT">("ALL");

  // Filter logika berjalan di sisi client
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // 1. Filter Pencarian Teks (Deskripsi)
      const matchesSearch = (tx.description || "")
        .toLowerCase()
        .includes(search.toLowerCase());

      // 2. Filter Tipe Transaksi
      const matchesType = typeFilter === "ALL" || tx.type === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [transactions, search, typeFilter]);

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
        <CardTitle className="text-base sm:text-lg font-poppins">
          Riwayat Transaksi
        </CardTitle>

        {/* --- Kontrol Filter & Search --- */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
          {/* Input Pencarian */}
          <div className="relative w-full sm:w-64 shrink-0 group">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg className="h-4 w-4 text-slate-500 group-focus-within:text-primary transition-colors duration-200" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="8" />
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Cari deskripsi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 pl-10 pr-4 rounded-xl text-sm bg-white text-slate-800 placeholder:text-slate-400 border border-slate-300 shadow-sm outline-none transition-all duration-200 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/10 focus:shadow-md hover:border-slate-400"
            />
          </div>

          {/* Select Filter Tipe */}
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
            <SelectTrigger className="h-9 w-full sm:w-[150px] text-sm shrink-0">
              <Filter className="h-4 w-4 mr-2 text-slate-400" />
              <SelectValue placeholder="Semua Tipe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Tipe</SelectItem>
              <SelectItem value="CREDIT">Pemasukan (+)</SelectItem>
              <SelectItem value="DEBIT">Pengeluaran (-)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        <DataTable
          columns={columns}
          data={filteredTransactions}
          keyExtractor={(tx) => tx.id}
          showRowNumber
          rowNumberPadded
          emptyIcon={Shield}
          emptyTitle={
            search || typeFilter !== "ALL"
              ? "Tidak ada transaksi yang cocok dengan filter."
              : "Belum ada transaksi untuk warga ini."
          }
        />
      </CardContent>
    </Card>
  );
}