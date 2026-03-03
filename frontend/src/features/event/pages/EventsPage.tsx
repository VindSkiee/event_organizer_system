import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import {
    CalendarDays,
    Clock,
    Plus,
    Zap,
} from "lucide-react";
import { toast } from "sonner";
import { eventService } from "@/features/event/services/eventService";
import { userService } from "@/shared/services/userService";
import type { EventItem, UserItem } from "@/shared/types";
import type { EventStatusType } from "@/features/event/types";
import { DateRangeFilter } from "@/shared/components/DateRangeFilter";
import type { DateRange } from "@/shared/components/DateRangeFilter";
import {
    CreateEventDialog,
    EventsTable,
} from "@/features/event/components";

const PENDING_STATUSES: EventStatusType[] = ["SUBMITTED"];
const ACTIVE_STATUSES: EventStatusType[] = ["FUNDED", "ONGOING"];
const DONE_STATUSES: EventStatusType[] = ["COMPLETED", "SETTLED", "REJECTED", "CANCELLED"];

export default function EventsPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [events, setEvents] = useState<EventItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [activeTab, setActiveTab] = useState("semua");
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

    // Resolve event detail path based on current route
    const getEventDetailPath = (id: string) => {
        const path = location.pathname;
        if (path.includes("kegiatan-bendahara")) return `/dashboard/events-bendahara/${id}`;
        if (path.includes("kegiatan-rt")) return `/dashboard/events-rt/${id}`;
        if (path.includes("kegiatan-warga")) return `/dashboard/events-warga/${id}`;
        return `/dashboard/events/${id}`;
    };

    // Create Event Dialog
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [allUsers, setAllUsers] = useState<UserItem[]>([]);
    const [creatingEvent, setCreatingEvent] = useState(false);

    useEffect(() => {
        fetchEvents();
        fetchAllUsers();
    }, []);

    const fetchEvents = async () => {
        setLoading(true);
        try {
            const data = await eventService.getAll();
            setEvents(data);
        } catch {
            toast.error("Gagal memuat data kegiatan.");
        } finally {
            setLoading(false);
        }
    };

    const fetchAllUsers = async () => {
        try {
            const res = await userService.getFiltered({ limit: 100 });

            // 1. Cek isi sebenarnya dari response API di console
            console.log("Data mentah dari API Users:", res);

            // 2. Pastikan yang dimasukkan ke state benar-benar sebuah Array
            if (Array.isArray(res)) {
                setAllUsers(res);
            } else {
                console.warn("Format data user tidak dikenali, diset ke array kosong:", res);
                setAllUsers([]);
            }
        } catch (error) {
            console.error("Gagal menarik data user:", error);
            setAllUsers([]); // Pastikan tetap array kosong jika gagal
        }
    };

    // === Create Event ===
    const handleCreateEvent = async (data: { title: string; description: string; budgetEstimated: number; startDate?: string; endDate?: string; committeeUserIds?: string[] }) => {
        setCreatingEvent(true);
        try {
            await eventService.create({ data, committeeUserIds: data.committeeUserIds });
            toast.success("Kegiatan berhasil dibuat!");
            setShowCreateDialog(false);
            fetchEvents();
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(message || "Gagal membuat kegiatan.");
        } finally {
            setCreatingEvent(false);
        }
    };

    // Filtered events
    const filteredEvents = events.filter((e) => {
        const matchSearch =
            e.title.toLowerCase().includes(search.toLowerCase()) ||
            e.description.toLowerCase().includes(search.toLowerCase());
        if (!matchSearch) return false;
        if (dateRange?.from) {
            const raw = e.startDate || e.createdAt;
            const d = new Date(raw);
            d.setHours(0, 0, 0, 0);
            const from = new Date(dateRange.from);
            from.setHours(0, 0, 0, 0);
            if (d < from) return false;
            if (dateRange.to) {
                const to = new Date(dateRange.to);
                to.setHours(23, 59, 59, 999);
                if (d > to) return false;
            }
        }
        if (activeTab === "semua") return true;
        if (activeTab === "menunggu") return PENDING_STATUSES.includes(e.status);
        if (activeTab === "berjalan") return ACTIVE_STATUSES.includes(e.status);
        if (activeTab === "selesai") return DONE_STATUSES.includes(e.status);
        if (activeTab === "draft") return e.status === "DRAFT";
        return true;
    });

    const pendingCount = events.filter((e) => PENDING_STATUSES.includes(e.status)).length;
    const activeCount = events.filter((e) => ACTIVE_STATUSES.includes(e.status)).length;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold font-poppins text-slate-900">
                        Kegiatan
                    </h1>
                    <p className="text-sm sm:text-base text-slate-500 mt-1">
                        Kelola seluruh kegiatan dan acara lingkungan.
                    </p>
                </div>
                {(() => {
                    try { const u = localStorage.getItem("user"); if (u && JSON.parse(u).role === "TREASURER") return null; } catch { } return (
                        <Button onClick={() => setShowCreateDialog(true)} className="shrink-0">
                            <Plus className="h-4 w-4 mr-1" /> Buat Acara Baru
                        </Button>
                    );
                })()}
            </div>

            {/* Summary Cards */}
            <div className="grid gap-2 sm:gap-4 grid-cols-3">
                <Card className="min-w-0">
                    <CardHeader className="flex flex-row items-center justify-between p-3 pb-1.5 sm:p-5 sm:pb-2">
                        <CardTitle className="text-[10px] sm:text-sm font-medium text-slate-600 font-poppins leading-tight truncate">
                            Total
                        </CardTitle>
                        <CalendarDays className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary shrink-0" />
                    </CardHeader>
                    <CardContent className="px-3 pb-3 pt-0 sm:px-5 sm:pb-4">
                        {loading ? <Skeleton className="h-7 w-8 sm:h-8 sm:w-12" /> : (
                            <div className="text-xl sm:text-2xl font-bold text-slate-900">{events.length}</div>
                        )}
                    </CardContent>
                </Card>
                <Card className="min-w-0">
                    <CardHeader className="flex flex-row items-center justify-between p-3 pb-1.5 sm:p-5 sm:pb-2">
                        <CardTitle className="text-[10px] sm:text-sm font-medium text-slate-600 font-poppins leading-tight truncate">
                            Menunggu
                        </CardTitle>
                        <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-500 shrink-0" />
                    </CardHeader>
                    <CardContent className="px-3 pb-3 pt-0 sm:px-5 sm:pb-4">
                        {loading ? <Skeleton className="h-7 w-8 sm:h-8 sm:w-12" /> : (
                            <div className="text-xl sm:text-2xl font-bold text-amber-600">{pendingCount}</div>
                        )}
                    </CardContent>
                </Card>
                <Card className="min-w-0">
                    <CardHeader className="flex flex-row items-center justify-between p-3 pb-1.5 sm:p-5 sm:pb-2">
                        <CardTitle className="text-[10px] sm:text-sm font-medium text-slate-600 font-poppins leading-tight truncate">
                            Berjalan
                        </CardTitle>
                        <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500 shrink-0" />
                    </CardHeader>
                    <CardContent className="px-3 pb-3 pt-0 sm:px-5 sm:pb-4">
                        {loading ? <Skeleton className="h-7 w-8 sm:h-8 sm:w-12" /> : (
                            <div className="text-xl sm:text-2xl font-bold text-emerald-600">{activeCount}</div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Tabs + Search */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="overflow-x-auto -mx-1 px-1 pb-0.5">
                        <TabsList className="w-max">
                            <TabsTrigger value="semua">Semua</TabsTrigger>
                            <TabsTrigger value="draft">Draft</TabsTrigger>
                            <TabsTrigger value="menunggu">
                                Menunggu {pendingCount > 0 && `(${pendingCount})`}
                            </TabsTrigger>
                            <TabsTrigger value="berjalan">Berjalan</TabsTrigger>
                            <TabsTrigger value="selesai">Selesai</TabsTrigger>
                        </TabsList>
                    </div>
                    <div className="flex gap-2 flex-wrap shrink-0">
                        <DateRangeFilter
                            value={dateRange}
                            onChange={setDateRange}
                            placeholder="Filter tanggal"
                        />
                        <div className="relative max-w-sm group">
                            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                                <svg className="h-4 w-4 text-slate-500 group-focus-within:text-primary transition-colors duration-200" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <circle cx="11" cy="11" r="8" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                placeholder="Cari kegiatan..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full h-11 pl-10 pr-4 rounded-xl text-sm bg-white text-slate-800 placeholder:text-slate-400 border border-slate-300 shadow-sm outline-none transition-all duration-200 focus:border-slate-600 focus:ring-2 focus:ring-slate-600/10 focus:shadow-md hover:border-slate-400"
                            />
                        </div>
                    </div>
                </div>

                <TabsContent value={activeTab} className="mt-0 space-y-6">
                    <EventsTable
                        events={filteredEvents}
                        loading={loading}
                        searchQuery={search}
                        onEventClick={(id) => navigate(getEventDetailPath(id))}
                        currentUserId={(() => { try { const u = localStorage.getItem("user"); return u ? JSON.parse(u).id : undefined; } catch { return undefined; } })()}
                    />
                </TabsContent>
            </Tabs>

            {/* === Create Event Dialog === */}
            <CreateEventDialog
                open={showCreateDialog}
                onClose={() => setShowCreateDialog(false)}
                onSubmit={handleCreateEvent}
                allUsers={allUsers}
                submitting={creatingEvent}
            />
        </div>
    );
}
