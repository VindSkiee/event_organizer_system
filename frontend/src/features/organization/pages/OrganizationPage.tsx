import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
} from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { Input } from "@/shared/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/ui/collapsible";
import {
  Building2,
  Search,
  Trash2,
  ChevronDown,
  Pencil,
  Users,
  Crown,
} from "lucide-react";
import { toast } from "sonner";
import { groupService } from "@/features/organization/services/groupService";
import { userService } from "@/shared/services/userService";
import { getRoleLabel } from "@/shared/helpers/roleLabel";
import { getAvatarUrl } from "@/shared/helpers/avatarUrl";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { DataTable, type ColumnDef } from "@/shared/components/DataTable";
import type { GroupItem, UserItem, HierarchyData } from "@/shared/types";
import {
  OrganizationSummaryCards,
  CreateRtDialog,
  CreateWargaDialog,
  EditRtDialog,
  EditWargaDialog,
  RtMemberTable,
  WargaTable,
  WargaSearchBar,
  WargaEmptySearchState,
} from "@/features/organization/components";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";


// === HELPERS ===

function getRoleFromStorage(): string | null {
  try {
    const stored = localStorage.getItem("user");
    if (stored) return JSON.parse(stored).role;
  } catch { /* ignore */ }
  return null;
}

function getGroupIdFromStorage(): number | null {
  try {
    const stored = localStorage.getItem("user");
    if (stored) return JSON.parse(stored).communityGroupId ?? null;
  } catch { /* ignore */ }
  return null;
}

function getUserIdFromStorage(): string | null {
  try {
    const stored = localStorage.getItem("user");
    if (stored) return JSON.parse(stored).id ?? null;
  } catch { /* ignore */ }
  return null;
}

// =============================================
// MAIN COMPONENT
// =============================================
export default function OrganizationPage() {
  const navigate = useNavigate();
  const userRole = getRoleFromStorage();
  const userGroupId = getGroupIdFromStorage();

  if (userRole === "LEADER") {
    return <LeaderView navigate={navigate} />;
  }
  if (userRole === "TREASURER") {
    return <TreasurerView userGroupId={userGroupId} />;
  }
  if (userRole === "ADMIN") {
    return <AdminView navigate={navigate} userGroupId={userGroupId} />;
  }
  return <ResidentView navigate={navigate} userGroupId={userGroupId} />;
}

// =============================================
// DEBOUNCE HOOK
// =============================================
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// =============================================
// LEADER VIEW (Full CRUD)
// =============================================
function LeaderView({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchRT, setSearchRT] = useState("");
  const [searchWarga, setSearchWarga] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupItem | null>(null);
  const [editGroupName, setEditGroupName] = useState("");
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editUserForm, setEditUserForm] = useState({
    fullName: "", email: "", phone: "", address: "", roleType: "RESIDENT",
    communityGroupId: undefined as number | undefined,
  });
  const [expandedRT, setExpandedRT] = useState<number | null>(null);
  const [rtMembers, setRtMembers] = useState<Record<number, UserItem[]>>({});
  const [rtMemberCounts, setRtMemberCounts] = useState<Record<number, number>>({});
  const [loadingMembers, setLoadingMembers] = useState<number | null>(null);
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState<{ id: number; name: string } | null>(null);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<{ id: string; name: string } | null>(null);

  const debouncedSearchWarga = useDebounce(searchWarga, 500);

  const refetchSearch = useCallback((query: string) => {
    if (!query) { setUsers([]); return; }
    setIsSearching(true);
    userService.getFiltered({ search: query, limit: 100 })
      .then((res) => setUsers(Array.isArray(res) ? res : (res?.data || [])))
      .catch(() => toast.error("Gagal mencari warga."))
      .finally(() => setIsSearching(false));
  }, []);

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    refetchSearch(debouncedSearchWarga);
  }, [debouncedSearchWarga, refetchSearch]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const groupsData = await groupService.getAll();
      setGroups(groupsData);
      const rtGroupsData = groupsData.filter((g) => g.type === "RT");
      const countPromises = rtGroupsData.map((rt) =>
        userService.getCountByGroup(rt.id).then((count) => ({ id: rt.id, count })).catch(() => ({ id: rt.id, count: 0 }))
      );
      const counts = await Promise.all(countPromises);
      setRtMemberCounts(counts.reduce((acc, { id, count }) => { acc[id] = count; return acc; }, {} as Record<number, number>));
    } catch { toast.error("Gagal memuat data."); }
    finally { setLoading(false); }
  };

  const rwGroups = groups.filter((g) => g.type === "RW");
  const rtGroups = groups.filter((g) => g.type === "RT");
  const filteredRT = rtGroups.filter((g) => g.name.toLowerCase().includes(searchRT.toLowerCase()));

  const fetchRTMembers = useCallback(async (groupId: number) => {
    if (rtMembers[groupId]) return;
    setLoadingMembers(groupId);
    try {
      const res = await userService.getFiltered({ communityGroupId: groupId, limit: 100 });
      const usersArray = Array.isArray(res) ? res : (res?.data || []);
      setRtMembers((prev) => ({ ...prev, [groupId]: usersArray }));
    } catch { toast.error("Gagal memuat anggota RT."); }
    finally { setLoadingMembers(null); }
  }, [rtMembers]);

  const toggleRT = (groupId: number) => {
    if (expandedRT === groupId) { setExpandedRT(null); } else { setExpandedRT(groupId); fetchRTMembers(groupId); }
  };

  const openEditGroup = (group: GroupItem) => { setEditingGroup(group); setEditGroupName(group.name); };

  const openEditUser = (user: UserItem) => {
    setEditingUser(user);
    const actualRole = user.roleType || user.role?.type || "RESIDENT";
    const actualGroupId = user.communityGroupId || user.communityGroup?.id;
    setEditUserForm({
      fullName: user.fullName, email: user.email, phone: user.phone || "", address: user.address || "",
      roleType: actualRole, communityGroupId: actualGroupId ?? undefined,
    });
  };

  const handleDeleteGroup = (id: number, name: string) => {
    setPendingDeleteGroup({ id, name });
  };

  const executeDeleteGroup = async () => {
    if (!pendingDeleteGroup) return;
    try { await groupService.delete(pendingDeleteGroup.id); toast.success(`${pendingDeleteGroup.name} berhasil dihapus.`); setPendingDeleteGroup(null); fetchData(); } catch { toast.error("Gagal menghapus grup."); }
  };

  const handleDeleteUser = (id: string, name: string) => {
    setPendingDeleteUser({ id, name });
  };

  const executeDeleteUser = async () => {
    if (!pendingDeleteUser) return;
    const deletedId = pendingDeleteUser.id;
    try {
      await userService.delete(deletedId);
      toast.success(`${pendingDeleteUser.name} berhasil dihapus.`);
      setPendingDeleteUser(null);
      setUsers((prev) => prev.filter((u) => u.id !== deletedId));
      fetchData();
    } catch { toast.error("Gagal menghapus warga."); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <OrgHeader />
      <OrganizationSummaryCards groups={groups} rwGroups={rwGroups} rtGroups={rtGroups} users={users} loading={loading} isLeader={true} totalWarga={Object.values(rtMemberCounts).reduce((sum, c) => sum + c, 0)} />
      <Tabs defaultValue="data-rt" className="space-y-4">
        <TabsList>
          <TabsTrigger value="data-rt">Data RT</TabsTrigger>
          <TabsTrigger value="data-warga">Data Warga</TabsTrigger>
        </TabsList>

        <TabsContent value="data-rt" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Cari RT..." value={searchRT} onChange={(e) => setSearchRT(e.target.value)} className="pl-9 h-10" />
            </div>
            <CreateRtDialog onSuccess={fetchData} />
          </div>

          {loading ? <LoadingSkeletons /> : filteredRT.length === 0 ? (
            <EmptyState text={searchRT ? "RT tidak ditemukan" : "Belum ada data RT"} subtext={searchRT ? "Coba kata kunci lain" : "Mulai dengan menambahkan RT baru"} />
          ) : (
            <div className="space-y-3">
              {filteredRT.map((group) => {
                const isExpanded = expandedRT === group.id;
                const members = rtMembers[group.id] || [];
                const isLoadingThisRT = loadingMembers === group.id;
                return (
                  <Collapsible key={group.id} open={isExpanded} onOpenChange={() => toggleRT(group.id)}>
                    <Card className="group overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50/80 transition-colors">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <ChevronDown className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-0" : "-rotate-90"}`} />
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 text-sm sm:text-base">{group.name}</p>
                              <p className="text-xs text-slate-500">{rtMemberCounts[group.id] !== undefined ? `${rtMemberCounts[group.id]} warga` : ""}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Badge variant="secondary" className="text-xs font-medium bg-slate-100 text-slate-600 border-0 mr-1 transition-colors group-hover:bg-primary group-hover:text-white">{group.type}</Badge>
                            <button onClick={(e) => { e.stopPropagation(); openEditGroup(group); }} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-blue-500 transition-all" title="Edit RT"><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id, group.name); }} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-rose-500 transition-all" title="Hapus RT"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                          <RtMemberTable members={members} loading={isLoadingThisRT} currentUserId={getUserIdFromStorage() || undefined} onMemberClick={(memberId) => navigate(`/dashboard/users/${memberId}`)} onEdit={openEditUser} onDelete={handleDeleteUser} />
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="data-warga" className="space-y-5">
          {/* Toolbar: Search + Create Button */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <WargaSearchBar
              value={searchWarga}
              onChange={setSearchWarga}
              isSearching={isSearching}
              resultCount={searchWarga.length >= 3 ? users.length : undefined}
            />
            <CreateWargaDialog
              groups={groups}
              onSuccess={() => { fetchData(); refetchSearch(searchWarga); }}
            />
          </div>

          {/* Divider + info label saat ada hasil */}
          {searchWarga.length >= 3 && !isSearching && users.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-100" />
              <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
                Menampilkan {users.length} warga untuk "{searchWarga}"
              </span>
              <div className="h-px flex-1 bg-slate-100" />
            </div>
          )}

          {/* Content */}
          {/* Jika input < 3 huruf, TAMPILKAN EMPTY STATE (Pesan Mulai Mencari) */}
          {searchWarga.length < 3 ? (
            <WargaEmptySearchState searchQuery={searchWarga} />
          ) : (
            /* Jika input >= 3 huruf, periksa apakah datanya kosong atau ada */
            users.length === 0 && !isSearching ? (
              <WargaEmptySearchState searchQuery={searchWarga} />
            ) : (
              <WargaTable
                users={users}
                loading={isSearching}
                searchQuery={searchWarga}
                currentUserId={getUserIdFromStorage() || undefined}
                onUserClick={(userId) => navigate(`/dashboard/users/${userId}`)}
                onEdit={openEditUser}
                onDelete={handleDeleteUser}
              />
            )
          )}
        </TabsContent>
      </Tabs>

      <EditRtDialog group={editingGroup} name={editGroupName} onNameChange={setEditGroupName} onClose={() => setEditingGroup(null)}
        onSuccess={() => { setEditingGroup(null); fetchData(); if (editingGroup) setRtMembers((prev) => { const copy = { ...prev }; delete copy[editingGroup.id]; return copy; }); }}
        submitting={submitting} setSubmitting={setSubmitting} />
      <EditWargaDialog user={editingUser} groups={groups} form={editUserForm} onFormChange={setEditUserForm} onClose={() => setEditingUser(null)}
        onSuccess={() => { setEditingUser(null); fetchData(); setRtMembers({}); refetchSearch(searchWarga); }}
        submitting={submitting} setSubmitting={setSubmitting} />

      <ConfirmDialog
        open={!!pendingDeleteGroup}
        onOpenChange={(v) => { if (!v) setPendingDeleteGroup(null); }}
        title="Hapus RT"
        description={`Yakin ingin menghapus ${pendingDeleteGroup?.name}? Semua data warga dan anggota terkait akan ikut terhapus.`}
        confirmLabel="Ya, Hapus"
        onConfirm={executeDeleteGroup}
      />

      <ConfirmDialog
        open={!!pendingDeleteUser}
        onOpenChange={(v) => { if (!v) setPendingDeleteUser(null); }}
        title="Hapus Warga"
        description={`Yakin ingin menghapus ${pendingDeleteUser?.name}? Aksi ini tidak dapat dibatalkan.`}
        confirmLabel="Ya, Hapus"
        onConfirm={executeDeleteUser}
      />
    </div>
  );
}

// =============================================
// TREASURER VIEW (Read-only)
// =============================================
function TreasurerView({ userGroupId }: { userGroupId: number | null }) {
  const navigate = useNavigate();
  const currentUserId = getUserIdFromStorage();
  const [hierarchy, setHierarchy] = useState<HierarchyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchRT, setSearchRT] = useState("");
  const [expandedRT, setExpandedRT] = useState<number | null>(null);
  const [rtMembers, setRtMembers] = useState<Record<number, UserItem[]>>({});
  const [loadingMembers, setLoadingMembers] = useState<number | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await groupService.getHierarchy();
      setHierarchy(data);
      if (userGroupId) setExpandedRT(userGroupId);
    }
    catch { toast.error("Gagal memuat data organisasi."); }
    finally { setLoading(false); }
  };

  // Auto-fetch own RT/RW members when hierarchy is loaded
  useEffect(() => {
    if (userGroupId && !rtMembers[userGroupId] && hierarchy) {
      fetchRTMembers(userGroupId);
    }
  }, [hierarchy, userGroupId]);

  const fetchRTMembers = useCallback(async (groupId: number) => {
    if (rtMembers[groupId]) return;
    setLoadingMembers(groupId);
    try {
      const res = await userService.getFiltered({ communityGroupId: groupId, limit: 100 });
      const usersArray = Array.isArray(res) ? res : (res?.data || []);
      setRtMembers((prev) => ({ ...prev, [groupId]: usersArray }));
    } catch { toast.error("Gagal memuat anggota RT."); }
    finally { setLoadingMembers(null); }
  }, [rtMembers]);

  const toggleRT = (groupId: number) => {
    if (expandedRT === groupId) { setExpandedRT(null); } else { setExpandedRT(groupId); fetchRTMembers(groupId); }
  };

  // 1. Tentukan apakah user yang login ini adalah pengurus Parent (RW) atau bukan.
  // Jika ID grupnya sama dengan ID RW di hierarki, berarti dia adalah Treasurer RW.
  const isParentRole = hierarchy?.rw && hierarchy.rw.id === userGroupId;

  const filteredRT = (hierarchy?.rtGroups || []).filter((g) => g.name.toLowerCase().includes(searchRT.toLowerCase()));

  // 2. Jika user BUKAN Parent (artinya dia Treasurer RT), urutkan agar RT-nya sendiri berada di paling atas
  const sortedRTs = isParentRole
    ? filteredRT
    : [...filteredRT].sort((a, b) => {
      if (a.id === userGroupId) return -1;
      if (b.id === userGroupId) return 1;
      return 0;
    });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <OrgHeader subtitle="Lihat struktur organisasi RT/RW." />
      {loading ? <Skeleton className="h-24 w-full rounded-xl" /> : hierarchy?.rw && (
        <RwInfoCard rw={hierarchy.rw} rtCount={hierarchy.rtGroups.length} navigate={navigate} clickableOfficers />
      )}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-800 font-poppins">Daftar RT</h2>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Cari RT..." value={searchRT} onChange={(e) => setSearchRT(e.target.value)} className="pl-9 h-10" />
          </div>
        </div>
        {loading ? <LoadingSkeletons /> : sortedRTs.length === 0 ? <EmptyState text="Belum ada RT" /> : (
          <div className="space-y-3">
            {sortedRTs.map((rt) => {
              // 3. Logika isOwn: Jika user BUKAN Parent, dan id grup sama dengan id RT yang sedang di-render
              const isOwn = !isParentRole && rt.id === userGroupId;
              const isExpanded = expandedRT === rt.id;
              const members = rtMembers[rt.id] || [];
              const isLoadingThisRT = loadingMembers === rt.id;
              const hasFetchedMembers = rtMembers[rt.id] !== undefined;
              const realMemberCount = hasFetchedMembers ? members.length : rt.memberCount;

              // 4. Treasurer RW bisa melihat SEMUA data (seakan-akan isOwn true untuk semua)
              const canViewMembers = isParentRole || isOwn;

              return (
                <Collapsible key={rt.id} open={isExpanded} onOpenChange={() => toggleRT(rt.id)}>
                  {/* Styling border berbeda jika itu adalah RT sendiri */}
                  <Card className={`group overflow-hidden transition-shadow ${isOwn ? "border-slate-100 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-400" : "border-slate-100 shadow-sm hover:shadow-md"}`}>
                    <CollapsibleTrigger asChild>
                      <div className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${isOwn ? "hover:bg-slate-50/80" : "hover:bg-slate-50/80"}`}>
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-0" : "-rotate-90"} ${isOwn ? "text-primary" : "text-slate-400"}`} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`font-medium text-sm sm:text-base ${isOwn ? "text-primary" : "text-slate-900"}`}>{rt.name}</p>
                              {/* Tampilkan Badge "RT Anda" JIKA isOwn true */}
                              {isOwn && <Badge variant="default" className="text-[10px] bg-slate-100 text-slate-700 transition-colors group-hover:bg-primary group-hover:text-white">RT Anda</Badge>}
                            </div>
                            <p className="text-xs text-slate-500">{realMemberCount} warga</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {rt.admin && <span className="text-xs text-slate-500 hidden sm:inline">Ketua: {rt.admin.fullName}</span>}
                          <Badge variant="secondary" className="text-xs">{rt.type}</Badge>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        </div>
                        {canViewMembers ? (
                          <ReadOnlyMemberTable members={members} loading={isLoadingThisRT} navigate={navigate} showDetail currentUserId={currentUserId || undefined} />
                        ) : (
                          <p className="text-xs text-slate-400 text-center py-2">Hanya dapat melihat anggota RT Anda sendiri.</p>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================
// ADMIN VIEW (Own RT highlighted + sibling RTs)
// =============================================
function AdminView({ navigate, userGroupId }: { navigate: ReturnType<typeof useNavigate>; userGroupId: number | null }) {
  const [hierarchy, setHierarchy] = useState<HierarchyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRT, setExpandedRT] = useState<number | null>(null);
  const [rtMembers, setRtMembers] = useState<Record<number, UserItem[]>>({});
  const [loadingMembers, setLoadingMembers] = useState<number | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await groupService.getHierarchy();
      setHierarchy(data);
      if (userGroupId) setExpandedRT(userGroupId);
    } catch { toast.error("Gagal memuat data organisasi."); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (userGroupId && !rtMembers[userGroupId] && hierarchy) fetchRTMembersById(userGroupId);
  }, [hierarchy, userGroupId]);

  const fetchRTMembersById = useCallback(async (groupId: number) => {
    if (rtMembers[groupId]) return;
    setLoadingMembers(groupId);
    try {
      const res = await userService.getFiltered({ communityGroupId: groupId, limit: 100 });
      const usersArray = Array.isArray(res) ? res : (res?.data || []);
      setRtMembers((prev) => ({ ...prev, [groupId]: usersArray }));
    } catch { toast.error("Gagal memuat anggota RT."); }
    finally { setLoadingMembers(null); }
  }, [rtMembers]);

  const toggleRT = (groupId: number) => {
    if (expandedRT === groupId) { setExpandedRT(null); } else { setExpandedRT(groupId); fetchRTMembersById(groupId); }
  };

  const sortedRTs = [...(hierarchy?.rtGroups || [])].sort((a, b) => {
    if (a.id === userGroupId) return -1;
    if (b.id === userGroupId) return 1;
    return 0;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <OrgHeader subtitle="Kelola data warga RT dan lihat struktur organisasi." />
      {loading ? <Skeleton className="h-24 w-full rounded-xl" /> : hierarchy?.rw && (
        <RwInfoCard rw={hierarchy.rw} rtCount={hierarchy.rtGroups.length} navigate={navigate} clickableOfficers />
      )}
      {loading ? <LoadingSkeletons /> : (
        <div className="space-y-3">
          {sortedRTs.map((rt) => {
            const isOwn = rt.id === userGroupId;
            const isExpanded = expandedRT === rt.id;
            const members = rtMembers[rt.id] || [];
            const isLoadingThisRT = loadingMembers === rt.id;
            const hasFetchedMembers = rtMembers[rt.id] !== undefined;
            const realMemberCount = hasFetchedMembers ? members.length : rt.memberCount;
            return (
              <Collapsible key={rt.id} open={isExpanded} onOpenChange={() => toggleRT(rt.id)}>
                <Card className={`group overflow-hidden transition-shadow ${isOwn ? "border-slate-100 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-400" : "border-slate-100 shadow-sm hover:shadow-md"}`}>
                  <CollapsibleTrigger asChild>
                    <div className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${isOwn ? "hover:bg-slate-50/80" : "hover:bg-slate-50/80"}`}>
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-0" : "-rotate-90"} ${isOwn ? "text-primary" : "text-slate-400"}`} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`font-medium text-sm sm:text-base ${isOwn ? "text-primary" : "text-slate-900"}`}>{rt.name}</p>
                            {isOwn && <Badge variant="default" className="text-[10px] bg-slate-100 text-slate-700 transition-colors duration-400 group-hover:bg-primary group-hover:text-white">RT Anda</Badge>}
                          </div>
                          <p className="text-xs text-slate-500">{realMemberCount} warga</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {rt.admin && <span className="text-xs text-slate-500 hidden sm:inline">Ketua: {rt.admin.fullName}</span>}
                        <Badge variant="secondary" className="text-xs">{rt.type}</Badge>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      </div>
                      {isOwn ? (
                        <ReadOnlyMemberTable members={members} loading={isLoadingThisRT} navigate={navigate} showDetail currentUserId={getUserIdFromStorage() || undefined} />
                      ) : (
                        <p className="text-xs text-slate-400 text-center py-2">Hanya dapat melihat anggota RT Anda sendiri.</p>
                      )}
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================
// RESIDENT VIEW (Read-only, own RT member list only)
// =============================================
function ResidentView({ navigate, userGroupId }: { navigate: ReturnType<typeof useNavigate>; userGroupId: number | null }) {
  const [hierarchy, setHierarchy] = useState<HierarchyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRT, setExpandedRT] = useState<number | null>(null);
  const [rtMembers, setRtMembers] = useState<Record<number, UserItem[]>>({});
  const [loadingMembers, setLoadingMembers] = useState<number | null>(null);
  const currentUserId = getUserIdFromStorage();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await groupService.getHierarchy();
      setHierarchy(data);
      if (userGroupId) setExpandedRT(userGroupId);
    }
    catch { toast.error("Gagal memuat data organisasi."); }
    finally { setLoading(false); }
  };

  // Auto-fetch own RT members when hierarchy is loaded
  useEffect(() => {
    if (userGroupId && !rtMembers[userGroupId] && hierarchy) {
      fetchRTMembersById(userGroupId);
    }
  }, [hierarchy, userGroupId]);

  const fetchRTMembersById = useCallback(async (groupId: number) => {
    if (rtMembers[groupId]) return;
    setLoadingMembers(groupId);
    try {
      const res = await userService.getFiltered({ communityGroupId: groupId, limit: 100 });
      const usersArray = Array.isArray(res) ? res : (res?.data || []);
      setRtMembers((prev) => ({ ...prev, [groupId]: usersArray }));
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status !== 403) toast.error("Gagal memuat anggota RT.");
      setRtMembers((prev) => ({ ...prev, [groupId]: [] }));
    }
    finally { setLoadingMembers(null); }
  }, [rtMembers]);

  const toggleRT = (groupId: number) => {
    if (expandedRT === groupId) {
      setExpandedRT(null);
    } else {
      setExpandedRT(groupId);
      // Only fetch members for own RT
      if (groupId === userGroupId) fetchRTMembersById(groupId);
    }
  };

  const sortedRTs = [...(hierarchy?.rtGroups || [])].sort((a, b) => {
    if (a.id === userGroupId) return -1;
    if (b.id === userGroupId) return 1;
    return 0;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <OrgHeader subtitle="Lihat struktur organisasi RT/RW Anda." />
      {loading ? <Skeleton className="h-24 w-full rounded-xl" /> : hierarchy?.rw && (
        <RwInfoCard rw={hierarchy.rw} rtCount={hierarchy.rtGroups.length} navigate={navigate} clickableOfficers />
      )}
      {loading ? <LoadingSkeletons /> : (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-800 font-poppins">Daftar RT</h2>
          <div className="space-y-3">
            {sortedRTs.map((rt) => {
              const isOwn = rt.id === userGroupId;
              const isExpanded = expandedRT === rt.id;
              const members = rtMembers[rt.id] || [];
              const isLoadingThisRT = loadingMembers === rt.id;
              const hasFetchedMembers = rtMembers[rt.id] !== undefined;
              const realMemberCount = hasFetchedMembers ? members.length : rt.memberCount;
              return (
                <Collapsible key={rt.id} open={isExpanded} onOpenChange={() => toggleRT(rt.id)}>
                  <Card className={`group overflow-hidden transition-shadow ${isOwn ? "border-slate-100 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-400" : "border-slate-100 shadow-sm hover:shadow-md"}`}>
                    <CollapsibleTrigger asChild>
                      <div className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${isOwn ? "hover:bg-slate-50/80" : "hover:bg-slate-50/80"}`}>
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-0" : "-rotate-90"} ${isOwn ? "text-primary" : "text-slate-400"}`} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`font-medium text-sm sm:text-base ${isOwn ? "text-primary" : "text-slate-900"}`}>{rt.name}</p>
                              {isOwn && <Badge variant="default" className="text-[10px] bg-slate-100 text-slate-700 transition-colors duration-400 group-hover:bg-primary group-hover:text-white">RT Anda</Badge>}
                            </div>
                            <p className="text-xs text-slate-500">{realMemberCount} warga</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {rt.admin && <span className="text-xs text-slate-500 hidden sm:inline">Ketua: {rt.admin.fullName}</span>}
                          <Badge variant="secondary" className="text-xs">{rt.type}</Badge>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-4">

                        {isOwn ? (
                          <ReadOnlyMemberTable members={members} loading={isLoadingThisRT} navigate={navigate} showDetail currentUserId={currentUserId || undefined} />
                        ) : (
                          <p className="text-xs text-slate-400 text-center py-2">Hanya dapat melihat anggota RT Anda sendiri.</p>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================
// SHARED SUB-COMPONENTS
// =============================================

function OrgHeader({ subtitle }: { subtitle?: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold font-poppins text-slate-900">Organisasi</h1>
        <p className="text-sm sm:text-base text-slate-500 mt-1">{subtitle || "Kelola data RT dan Warga di lingkungan Anda."}</p>
      </div>
    </div>
  );
}

function RwInfoCard({ rw, rtCount, navigate, clickableOfficers }: {
  rw: HierarchyData["rw"];
  rtCount: number;
  navigate?: ReturnType<typeof useNavigate>;
  clickableOfficers?: boolean;
}) {
  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardContent className="py-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Crown className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900">{rw.name}</p>
            <p className="text-xs text-slate-500">{rw.memberCount} anggota  {rtCount} RT</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <OfficerBadge label="Ketua RW" officer={rw.leader}
            clickable={clickableOfficers} onClick={() => clickableOfficers && rw.leader && navigate?.(`/dashboard/users/${rw.leader.id}`)} />
          <OfficerBadge label="Bendahara RW" officer={rw.treasurer}
            clickable={clickableOfficers} onClick={() => clickableOfficers && rw.treasurer && navigate?.(`/dashboard/users/${rw.treasurer.id}`)} />
        </div>
      </CardContent>
    </Card>
  );
}

function OfficerBadge({ label, officer, clickable, onClick }: {

  label: string;
  // Tambahkan profileImage ke tipe data officer
  officer: { id: string; fullName: string; email: string; phone?: string | null; profileImage?: string | null } | null;
  clickable?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      className={`rounded-lg border border-slate-100 bg-white p-3 flex flex-col ${clickable && officer ? "cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-colors" : ""
        }`}
      onClick={clickable && officer ? onClick : undefined}
    >
      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-2.5">
        {label}
      </p>

      {officer ? (
        <div className="flex items-center gap-3">
          {/* Implementasi Avatar yang sama dengan RtMemberTable */}
          <Avatar className="h-9 w-9 shrink-0 ring-1 ring-slate-100">
            {getAvatarUrl(officer.profileImage) && (
              <AvatarImage
                src={getAvatarUrl(officer.profileImage)!}
                alt={officer.fullName}
                className="object-cover"
              />
            )}
            <AvatarFallback className="text-sm font-medium bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600">
              {officer.fullName?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {officer.fullName}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {officer.email}
            </p>
          </div>
        </div>
      ) : (
        /* State Kosong (Belum ditentukan) */
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
            <Users className="h-4 w-4 text-slate-300" />
          </div>
          <p className="text-sm text-slate-400 mt-0.5">Belum ditentukan</p>
        </div>
      )}
    </div>
  );
}

function ReadOnlyMemberTable({ members, loading, navigate, showDetail, currentUserId }: {
  members: UserItem[];
  loading: boolean;
  navigate: ReturnType<typeof useNavigate>;
  showDetail?: boolean;
  currentUserId?: string;
}) {
  const getPriority = (u: UserItem): number => {
    if (currentUserId && u.id === currentUserId) return 0;
    const r = u.roleType || u.role?.type || "RESIDENT";
    if (r === "LEADER" || r === "ADMIN") return 1;
    if (r === "TREASURER") return 2;
    return 3;
  };
  const sorted = [...members].sort((a, b) => getPriority(a) - getPriority(b));

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4">
        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
          <Users className="h-5 w-5 text-slate-400" />
        </div>
        <p className="text-xs font-medium text-slate-500">Belum ada anggota</p>
        <p className="text-xs text-slate-400 mt-1">Anggota akan muncul di sini</p>
      </div>
    );
  }

  const getRoleBadgeClass = (rt: string) => {
    if (rt === "LEADER") return "bg-indigo-100 text-indigo-700";
    if (rt === "ADMIN") return "bg-blue-100 text-blue-700";
    if (rt === "TREASURER") return "bg-amber-100 text-amber-700";
    return "bg-slate-100 text-slate-700";
  };

  const columns: ColumnDef<UserItem>[] = [
    {
      key: "name",
      header: "Nama",
      render: (m) => {
        const isSelf = !!(currentUserId && m.id === currentUserId);
        return (
          <div className="flex items-center gap-2">
            <Avatar className={`h-7 w-7 shrink-0 ${isSelf ? "ring-2 ring-primary/30" : ""}`}>
              {getAvatarUrl(m.profileImage) && (
                <AvatarImage src={getAvatarUrl(m.profileImage)!} alt={m.fullName} className="object-cover" />
              )}
              <AvatarFallback
                className={`text-xs font-medium ${isSelf
                  ? "bg-primary/20 text-primary"
                  : "bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600"
                  }`}
              >
                {m.fullName?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium text-slate-700 group-hover:text-slate-900 transition-colors">
                {m.fullName}
                {isSelf && (
                  <span className="ml-1.5 text-[10px] font-semibold bg-brand-green text-white px-1.5 py-0.5 rounded-full">
                    saya
                  </span>
                )}
              </p>
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
      render: (m) => m.email,
    },
    {
      key: "role",
      header: "Role",
      render: (m) => {
        const roleType = m.roleType || m.role?.type || "RESIDENT";
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeClass(roleType)}`}
          >
            {getRoleLabel(roleType)}
          </span>
        );
      },
    },
  ];

  return (
    <div className="bg-white rounded-lg border border-slate-100 overflow-hidden shadow-sm">
      <DataTable
        columns={columns}
        data={sorted}
        keyExtractor={(m) => m.id}
        showRowNumber
        rowNumberPadded
        onRowClick={showDetail ? (m) => navigate(`/dashboard/users/${m.id}`) : undefined}
      />
    </div>
  );
}

function LoadingSkeletons() {
  return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>;
}

function EmptyState({ text, subtext }: { text: string; subtext?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/30">
      <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <Building2 className="h-6 w-6 text-slate-400" />
      </div>
      <p className="text-sm font-medium text-slate-600">{text}</p>
      {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
    </div>
  );
}
