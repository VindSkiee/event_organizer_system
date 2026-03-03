import { useEffect, useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Wallet,
  Users,
  UserCircle,
  LogOut,
  Menu,
  Building2,
  CalendarDays,
  CreditCard,
  Settings,
} from "lucide-react";

import { Button } from "@/shared/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/shared/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { toast } from "sonner";
import { authService } from "@/features/auth/services/authService";
import { getRoleLabel, loadCustomRoleLabels } from "@/shared/helpers/roleLabel";
import { getAvatarUrl } from "@/shared/helpers/avatarUrl";
import { onSidebarUpdate, offSidebarUpdate } from "@/shared/helpers/sidebarEvents";
import { useBadgeNotifications } from "@/shared/hooks/useBadgeNotifications";

// Tipe data user dari LocalStorage
interface User {
  id: number;
  email: string;
  fullName: string;
  role: string;
  profileImage?: string | null;
}

export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [roleLabel, setRoleLabel] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  // Helper to read user from localStorage
  const readUser = () => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try { return JSON.parse(storedUser) as User; } catch { return null; }
    }
    return null;
  };

  // 1. Ambil Data User + Load Labels Saat Komponen Dimuat
  useEffect(() => {
    const u = readUser();
    setUser(u);
    loadCustomRoleLabels().then(() => {
      setRoleLabel(getRoleLabel(u?.role));
    });
  }, []);

  // 2. Listen for sidebar update events (avatar upload, role label change)
  useEffect(() => {
    const handleUpdate = () => {
      const u = readUser();
      setUser(u);
      loadCustomRoleLabels().then(() => {
        setRoleLabel(getRoleLabel(u?.role));
      });
    };
    onSidebarUpdate(handleUpdate);
    return () => offSidebarUpdate(handleUpdate);
  }, []);

  // 2. Fungsi Logout
  const handleLogout = async () => {
    try {
      await authService.logout();
      toast.success("Berhasil keluar.");
    } catch {
      // Fallback: clear manually if API fails
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user");
    }
    navigate("/login");
  };

  // 3. Konfigurasi Menu Berdasarkan Role
  const getMenuItems = (role?: string) => {
    const menu = [];

    if (role === "LEADER") {
      menu.push({ title: "Dashboard", path: "/dashboard/rw", icon: LayoutDashboard });
      menu.push({ title: "Organisasi", path: "/dashboard/organisasi", icon: Building2 });
      menu.push({ title: "Kegiatan", path: "/dashboard/kegiatan", icon: CalendarDays });
      menu.push({ title: "Kas & Keuangan", path: "/dashboard/kas", icon: Wallet });
      menu.push({ title: "Pembayaran", path: "/dashboard/pembayaran", icon: CreditCard });
      menu.push({ title: "Pengaturan", path: "/dashboard/pengaturan", icon: Settings });
    }
    else if (role === "ADMIN") {
      menu.push({ title: "Dashboard", path: "/dashboard/rt", icon: LayoutDashboard });
      menu.push({ title: "Data Warga RT", path: "/dashboard/organisasi-rt", icon: Users });
      menu.push({ title: "Kegiatan", path: "/dashboard/kegiatan-rt", icon: CalendarDays });
      menu.push({ title: "Kas & Keuangan", path: "/dashboard/kas-rt", icon: Wallet });
      menu.push({ title: "Pembayaran", path: "/dashboard/pembayaran-rt", icon: CreditCard });
    }
    else if (role === "TREASURER") {
      menu.push({ title: "Dashboard", path: "/dashboard/finance", icon: Wallet });
      menu.push({ title: "Organisasi", path: "/dashboard/organisasi-bendahara", icon: Building2 });
      menu.push({ title: "Kegiatan", path: "/dashboard/kegiatan-bendahara", icon: CalendarDays });
      menu.push({ title: "Kas & Keuangan", path: "/dashboard/kas-bendahara", icon: Wallet });
      menu.push({ title: "Pembayaran", path: "/dashboard/pembayaran-bendahara", icon: CreditCard });
    }
    else {
      // Default / RESIDENT
      menu.push({ title: "Beranda Warga", path: "/dashboard/warga", icon: LayoutDashboard });
      menu.push({ title: "Organisasi", path: "/dashboard/organisasi-warga", icon: Building2 });
      menu.push({ title: "Pembayaran", path: "/dashboard/pembayaran-warga", icon: CreditCard });
    }

    // Menu global untuk semua role
    menu.push({ title: "Profil Saya", path: "/dashboard/profile", icon: UserCircle });

    return menu;
  };

  const menuItems = getMenuItems(user?.role);

  // 5. Badge notifications
  const badges = useBadgeNotifications();

  const getBadgeCount = (path: string): number => {
    if (path.includes("kegiatan")) return badges.events;
    if (path.includes("kas")) return badges.finance;
    if (path.includes("pembayaran")) return badges.payment;
    if (path.includes("profile")) return badges.profile;
    return 0;
  };

  const subPathToParent: Record<string, string> = {
    "pengaturan-iuran": "kas",
    "progres-iuran": "pembayaran",
    "detail-progres": "pembayaran",
  };

  const isMenuActive = (menuPath: string): boolean => {
    const pathname = location.pathname;
    for (const [subPath, parentKey] of Object.entries(subPathToParent)) {
      if (pathname.includes(subPath)) {
        return menuPath.includes(parentKey);
      }
    }
    return pathname.includes(menuPath);
  };

  // 4. Sidebar Content (Glass Sidebar - Shared Desktop & Mobile)
  const SidebarContent = ({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) => {
    const avatarUrl = getAvatarUrl(user?.profileImage);
    return (
      <>
        {/* Logo */}
        <div className={`flex items-center pt-5 pb-2 transition-all duration-300 ${collapsed ? 'px-3 justify-center' : 'px-5 gap-3'}`}>
          <img
            src="/images/logoRB.webp"
            alt="Logo Marinakas"
            className={`object-contain shrink-0 transition-all duration-300 ${collapsed ? 'h-8 w-8' : 'h-6.5'}`} 
          />
          {!collapsed && (
            <div className="font-extrabold text-[26px] leading-none tracking-tight truncate transition-opacity duration-300 font-montserrat flex-1">
              <span className="text-white">MARINA</span>
              <span className="text-primary">KAS</span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-px w-full opacity-20">
          <div className="h-full w-full bg-white/60" />
        </div>

        {/* Profile Section */}
        <div className={`flex items-center gap-3 pt-3 pb-5 ${collapsed ? 'px-3 justify-center' : 'px-6'}`}>
          <Avatar className="h-12 w-12 border-2 border-white/20 shadow-lg">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={user?.fullName || "Avatar"} className="object-cover" />}
            <AvatarFallback className="bg-white/10 text-white font-bold text-lg font-poppins">
              {user?.fullName?.charAt(0).toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.4px] text-white/50 leading-[22px]">
                {roleLabel || getRoleLabel(user?.role)}
              </p>
              <p className="text-[14px] font-medium text-white leading-[20px] truncate">
                {user?.fullName || "User"}
              </p>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-px w-full opacity-20">
          <div className="h-full w-full bg-white/60" />
        </div>

        {/* Menu Section */}
        <div className={`flex-1 pt-4 pb-2 overflow-y-auto ${collapsed ? 'px-3' : 'px-5'}`}>
          {!collapsed && (
            <p className="text-[11px] font-medium uppercase tracking-[0.4px] text-white/40 px-4 mb-2 leading-[24px]">
              Menu
            </p>
          )}
          <nav className="flex flex-col gap-[2px]">
            {menuItems.map((item) => {
              const isActive = isMenuActive(item.path);
              const Icon = item.icon;
              const badgeCount = getBadgeCount(item.path);
              return (
                <Link key={item.path} to={item.path} onClick={() => onNavigate?.()}>
                  <div
                    className={`relative flex items-center gap-4 rounded-xl transition-all duration-200 font-medium text-[14px] leading-[20px] ${collapsed ? 'px-3 py-[14px] justify-center' : 'px-4 py-[14px]'}
                    ${isActive
                        ? "bg-brand-green text-white shadow-lg shadow-brand-green/20 border-[0.5px] border-white/10"
                        : "text-white/70 hover:bg-white/10 hover:text-white border-[0.5px] border-transparent"
                      }`}
                    title={collapsed ? item.title : undefined}
                  >
                    <div className="relative shrink-0">
                      <Icon className="h-[22px] w-[22px]" strokeWidth={1.8} />
                      {badgeCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-lg shadow-red-500/30 ring-2 ring-[rgba(7,44,82,0.7)]">
                          {badgeCount > 9 ? "9+" : badgeCount}
                        </span>
                      )}
                    </div>
                    {!collapsed && <span className="truncate">{item.title}</span>}
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Divider */}
        <div className="h-px w-full opacity-20">
          <div className="h-full w-full bg-gradient-to-r from-transparent via-red to-transparent" />
        </div>

        {/* Logout */}
        <div className={`py-4 ${collapsed ? 'px-3' : 'px-5'}`}>
          <button
            onClick={() => setShowLogoutDialog(true)}
            className={`flex items-center gap-4 w-full rounded-xl text-white/70 hover:bg-red-500/20 hover:text-red-300 transition-all duration-200 text-[14px] font-medium leading-[20px] ${collapsed ? 'px-3 py-[14px] justify-center' : 'px-4 py-[14px]'}`}
            title={collapsed ? "Keluar" : undefined}
          >
            <LogOut className="h-[22px] w-[22px] shrink-0" strokeWidth={1.8} />
            {!collapsed && "Keluar"}
          </button>
        </div>
      </>
    );
  };

  return (
    <div
      className="flex min-h-screen w-full font-sans"
      style={{
        backgroundImage: "url('/images/bgimage.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        backgroundRepeat: "no-repeat",
      }}
    >

      {/* --- SIDEBAR (DESKTOP) --- */}
      {/* Ubah md:flex menjadi lg:flex agar iPad masuk ke mode Mobile */}
      <aside className={`hidden lg:flex shrink-0 p-3 z-20 transition-all duration-300 ${isCollapsed ? 'w-[100px]' : 'w-[280px]'}`}>
        <div className="relative w-full backdrop-blur-[80px] bg-primary/70 border-[0.5px] border-solid border-white/10 rounded-[28px] shadow-[0px_24px_64px_-16px_rgba(7,44,82,0.3)] flex flex-col">
          {/* Collapse Button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute -right-3 top-20 z-50 w-8 h-8 rounded-full bg-white border-[0.5px] border-primary/20 shadow-[0px_4px_12px_rgba(7,44,82,0.15)] flex items-center justify-center hover:bg-brand-green transition-all duration-200 group"
            title={isCollapsed ? "Perluas sidebar" : "Tutup sidebar"}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`text-primary group-hover:text-white transition-all duration-300 ${isCollapsed ? 'rotate-180' : ''}`}
            >
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>

          <SidebarContent collapsed={isCollapsed} />
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">

        {/* Mobile Header with Menu Button */}
        {/* Ubah md:hidden menjadi lg:hidden */}
        <header className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 py-3 bg-primary/90 backdrop-blur-xl border-b border-white/10 shadow-[0px_4px_24px_rgba(7,44,82,0.25)]">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 text-white hover:text-white hover:bg-white/10">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            {/* Glass Sidebar Mobile */}
            <SheetContent
              side="left"
              className="w-[300px] sm:w-[320px] p-0 border-r-0 bg-transparent shadow-none [&>button]:text-white/80 [&>button]:bg-white/10 [&>button]:hover:bg-white/20 [&>button]:hover:text-white [&>button]:rounded-full [&>button]:w-8 [&>button]:h-8 [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:top-5 [&>button]:right-5 [&>button]:transition-all [&>button]:duration-200"
            >
              {/* LAPISAN 1: FAKE BACKGROUND 
                  Trik untuk memblokir overlay gelap (fade-in) Shadcn agar tidak menembus lapisan kaca. */}
              <div 
                className="absolute top-3 bottom-3 left-3 right-3 rounded-[28px] -z-10"
                style={{
                  backgroundImage: "url('/images/bgimage.png')",
                  backgroundSize: "cover",
                  backgroundPosition: "left top", 
                }}
              />

              {/* LAPISAN 2: GLASSMORPHISM 
                  Warna dan efek kaca ini sekarang sudah 100% sama dengan yang ada di Desktop. */}
              <div className="h-full m-3 backdrop-blur-[80px] bg-primary/70 border-[0.5px] border-solid border-white/10 rounded-[28px] shadow-[0px_24px_64px_-16px_rgba(7,44,82,0.3)] flex flex-col overflow-hidden">
                <SidebarContent collapsed={false} onNavigate={() => setMobileOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold font-poppins text-white truncate">
              {menuItems.find(item => location.pathname.includes(item.path))?.title || "Dashboard"}
            </h1>
          </div>
          <Avatar className="h-8 w-8 border border-white/20">
            {getAvatarUrl(user?.profileImage) && <AvatarImage src={getAvatarUrl(user?.profileImage)!} alt={user?.fullName || "Avatar"} className="object-cover" />}
            <AvatarFallback className="bg-white/10 text-white font-bold text-sm font-poppins">
              {user?.fullName?.charAt(0).toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
        </header>

        {/* CONTENT OUTLET - Full Screen */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          <Outlet />
        </div>

      </main>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-poppins">Konfirmasi Keluar</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin keluar dari akun ini? Anda perlu login kembali untuk mengakses dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Ya, Keluar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}