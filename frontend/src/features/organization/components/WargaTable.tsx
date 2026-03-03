import { useNavigate } from "react-router-dom";
import { Users, Pencil, Trash2 } from "lucide-react";
import { Skeleton } from "@/shared/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { DataTable, type ColumnDef } from "@/shared/components/DataTable";
import { Badge } from "@/shared/ui/badge"; // Pastikan Badge di-import
import type { UserItem } from "@/shared/types";
import { getRoleLabel } from "@/shared/helpers/roleLabel";
import { getAvatarUrl } from "@/shared/helpers/avatarUrl";

function sortMembers(members: UserItem[], currentUserId?: string): UserItem[] {
  const getPriority = (u: UserItem): number => {
    if (currentUserId && u.id === currentUserId) return 0;
    const r = u.roleType || u.role?.type || "RESIDENT";
    if (r === "LEADER" || r === "ADMIN") return 1;
    if (r === "TREASURER") return 2;
    return 3;
  };
  return [...members].sort((a, b) => getPriority(a) - getPriority(b));
}

function getRoleBadgeClass(roleType: string) {
  if (roleType === "LEADER") return "bg-indigo-100 text-indigo-700";
  if (roleType === "ADMIN") return "bg-blue-100 text-blue-700";
  if (roleType === "TREASURER") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

interface WargaTableProps {
  users: UserItem[];
  loading: boolean;
  searchQuery: string;
  currentUserId?: string;
  onUserClick: (userId: string) => void;
  onEdit: (user: UserItem) => void;
  onDelete: (userId: string, userName: string) => void;
}

export function WargaTable({
  users,
  loading,
  searchQuery,
  currentUserId,
  onUserClick,
  onEdit,
  onDelete,
}: WargaTableProps) {
  const navigate = useNavigate(); // Gunakan hook navigasi

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    if (searchQuery) {
      return (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/30">
        <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <Users className="h-6 w-6 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-600">Belum ada data warga</p>
        <p className="text-xs text-slate-400 mt-1">Mulai dengan menambahkan warga baru</p>
      </div>
    );
  }

  const sorted = sortMembers(users, currentUserId);

  const columns: ColumnDef<UserItem>[] = [
    {
      key: "name",
      header: "Nama",
      render: (user) => {
        const isSelf = !!(currentUserId && user.id === currentUserId);
        return (
          <div className="flex items-center gap-3">
            <Avatar className={`h-8 w-8 shrink-0 ${isSelf ? "ring-2 ring-emerald-500/30 ring-offset-1" : ""}`}>
              {getAvatarUrl(user.profileImage) && (
                <AvatarImage src={getAvatarUrl(user.profileImage)!} alt={user.fullName} className="object-cover" />
              )}
              <AvatarFallback
                className={`text-xs font-medium ${
                  isSelf
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600"
                }`}
              >
                {user.fullName?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <p
                  className={`transition-colors ${
                    isSelf
                      ? "font-bold text-emerald-700"
                      : "font-medium text-slate-700 group-hover:text-slate-900"
                  }`}
                >
                  {user.fullName}
                </p>
                {/* === BADGE "SAYA" SERAGAM DENGAN COMPONENT EVENT === */}
                {isSelf && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-medium bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0">
                    Saya
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-400 sm:hidden mt-0.5">{user.email}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: "email",
      header: "Email",
      hideBelow: "sm",
      cellClassName: "text-slate-500",
      render: (user) => user.email,
    },
    {
      key: "role",
      header: "Role",
      render: (user) => {
        const roleType = user.roleType || user.role?.type || "RESIDENT";
        return (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeClass(roleType)}`}
          >
            {getRoleLabel(roleType)}
          </span>
        );
      },
    },
    {
      key: "group",
      header: "Grup",
      hideBelow: "md",
      cellClassName: "text-slate-500",
      render: (user) => (
        <span className="text-sm">{user.communityGroup?.name || "—"}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (user) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            user.isActive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full mr-1.5 ${
              user.isActive ? "bg-emerald-500" : "bg-rose-500"
            }`}
          />
          {user.isActive ? "Aktif" : "Nonaktif"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Aksi",
      render: (user) => (
        <div
          className="flex items-center justify-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onEdit(user)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-blue-500 transition-all duration-200"
            title="Edit Warga"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(user.id, user.fullName)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-rose-500 transition-all duration-200"
            title="Hapus Warga"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
      <DataTable
        columns={columns}
        data={sorted}
        keyExtractor={(u) => u.id}
        // === LOGIKA NAVIGASI JIKA KLIK DIRI SENDIRI ===
        onRowClick={(u) => {
          if (currentUserId && u.id === currentUserId) {
            navigate("/dashboard/profile"); // Sesuaikan route-nya jika path profile Anda berbeda
          } else {
            onUserClick(u.id);
          }
        }}
        showRowNumber
        rowNumberPadded
        footerText={`Menampilkan ${users.length} warga`}
      />
    </div>
  );
}