import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Users } from "lucide-react";
import type { EventItem, EventParticipant } from "@/shared/types";
import { getRoleLabel } from "@/shared/helpers/roleLabel"; 
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { getAvatarUrl } from "@/shared/helpers/avatarUrl";

const participantRoleLabel = (role: string) => {
  const labels: Record<string, string> = {
    COMMITTEE: "Panitia",
    ATTENDEE: "Peserta",
    GUEST: "Tamu",
  };
  return labels[role] || role;
};

interface CommitteeListProps {
  event: EventItem;
  currentUserId?: string; 
}

export function CommitteeList({ event, currentUserId }: CommitteeListProps) {
  // Ambil hanya partisipan dengan role COMMITTEE
  const committeeMembers = event.participants?.filter((p) => p.role === "COMMITTEE") || [];

  // === FUNGSI PENGURUTAN PRIORITAS (memoized) ===
  const sortedCommittee = useMemo(() => {
    const getPriority = (participant: EventParticipant) => {
      // Prioritas 1: Pembuat Acara (Creator)
      if (participant.userId === event.createdById) return 1;
      
      // Prioritas 2: Bendahara (Treasurer)
      const systemRole = participant.user?.roleType || participant.user?.role?.type || "RESIDENT";
      if (systemRole === "TREASURER") return 2;
      
      // Prioritas 3: Diri Sendiri (Current User)
      if (currentUserId && (participant.userId === currentUserId || participant.user?.id === currentUserId)) return 3;
      
      // Prioritas 4: Residen Lainnya
      return 4;
    };

    return [...committeeMembers].sort((a, b) => {
      const priorityA = getPriority(a);
      const priorityB = getPriority(b);

      // Jika prioritasnya sama, urutkan berdasarkan nama sesuai abjad
      if (priorityA === priorityB) {
        const nameA = a.user?.fullName || "";
        const nameB = b.user?.fullName || "";
        return nameA.localeCompare(nameB);
      }

      return priorityA - priorityB;
    });
  }, [committeeMembers, event.createdById, currentUserId]);

  return (
    <Card className="border-slate-200 shadow-sm flex flex-col h-full max-h-[500px]">
      <CardHeader className="pb-3 bg-slate-50/50 border-b border-slate-100 shrink-0">
        <CardTitle className="text-base flex items-center gap-2 text-slate-800">
          <div className="p-1.5 rounded-md bg-primary/10">
            <Users className="h-4 w-4 text-primary" />
          </div>
          Susunan Panitia ({sortedCommittee.length})
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pt-4 overflow-y-auto flex-1">
        {sortedCommittee.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-slate-500 font-medium">Belum ada panitia terdaftar.</p>
            <p className="text-xs text-slate-400 mt-1">Tambahkan warga untuk menjadi panitia acara ini.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {sortedCommittee.map((participant) => {
              const systemRole = participant.user?.roleType || participant.user?.role?.type || "RESIDENT";
              const groupName = participant.user?.communityGroup?.name;
              
              const isSelf = !!(currentUserId && (participant.userId === currentUserId || participant.user?.id === currentUserId));
              
              // Cek apakah user ini adalah pembuat event
              const isCreator = participant.userId === event.createdById;

              return (
                <div
                  key={participant.userId}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between px-3 py-2.5 rounded-xl bg-white border shadow-sm transition-all gap-2 group ${
                    isSelf ? "border-emerald-200 bg-emerald-50/30" : "border-slate-100 hover:border-primary/20 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                    
                    <Avatar className={`h-9 w-9 shrink-0 ${isSelf ? 'ring-2 ring-emerald-500/30 ring-offset-1' : 'border border-slate-100'}`}>
                      {getAvatarUrl(participant.user?.profileImage) && (
                        <AvatarImage src={getAvatarUrl(participant.user?.profileImage)!} alt={participant.user?.fullName} className="object-cover" />
                      )}
                      <AvatarFallback className={`text-xs font-medium ${isSelf ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {participant.user?.fullName?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className={`text-sm font-semibold truncate ${isSelf ? "text-emerald-700" : "text-slate-900"}`}>
                          {participant.user?.fullName}
                        </p>
                        
                        {/* === BADGE IDENTITAS === */}
                        {isCreator && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-medium bg-blue-50 text-blue-700 border-blue-200 shrink-0">
                            Pembuat Acara
                          </Badge>
                        )}
                        
                        {isSelf && !isCreator && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-medium bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0">
                            Saya
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-[11px] text-slate-500 truncate mb-1.5">
                        {participant.user?.email}
                      </p>
                      
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge 
                          variant="secondary" 
                          className={`text-[9px] px-1.5 py-0 font-medium ${
                            systemRole === "LEADER" ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                            systemRole === "ADMIN" ? "bg-blue-50 text-blue-700 border-blue-200" :
                            systemRole === "TREASURER" ? "bg-amber-50 text-amber-700 border-amber-200" :
                            "bg-slate-100 text-slate-700 border-slate-200"
                          } border`}
                        >
                          {getRoleLabel(systemRole)}
                        </Badge>
                        
                        {groupName && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-slate-600 border-slate-200 bg-white">
                            {groupName}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="shrink-0 self-start sm:self-center mt-1 sm:mt-0">
                    <Badge className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary hover:bg-primary/20 border-0">
                      {participantRoleLabel(participant.role)}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}