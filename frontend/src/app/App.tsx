import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet, Link } from "react-router-dom";
import { Toaster } from "@/shared/ui/sonner";

// --- IMPORT LAYOUT (Tetap Eager/Sinkron karena merupakan bungkus utama) ---
import DashboardLayout from "@/layouts/DashboardLayout";

// --- LAZY LOADING PAGES (Code Splitting) ---
// Halaman hanya akan diunduh oleh browser saat user mengakses route-nya

// Auth Page
const LoginPage = lazy(() => import("@/features/auth/pages/LoginPage"));

// Dashboard Pages
const LeaderDashboard = lazy(() => import("@/features/dashboard/pages/LeaderDashboard"));
const AdminDashboard = lazy(() => import("@/features/dashboard/pages/AdminDashboard"));
const TreasurerDashboard = lazy(() => import("@/features/dashboard/pages/TreasurerDashboard"));
const ResidentDashboard = lazy(() => import("@/features/dashboard/pages/ResidentDashboard"));

// Feature Pages
const EventsPage = lazy(() => import("@/features/event/pages/EventsPage"));
const EventDetailPage = lazy(() => import("@/features/event/pages/EventDetailPage"));
const FinancePage = lazy(() => import("@/features/finance/pages/FinancePage"));
const PaymentPage = lazy(() => import("@/features/payment/pages/PaymentPage"));
const ResidentPaymentPage = lazy(() => import("@/features/payment/pages/ResidentPaymentPage"));
const OrganizationPage = lazy(() => import("@/features/organization/pages/OrganizationPage"));
const ProfilePage = lazy(() => import("@/features/profile/pages/ProfilePage"));
const UserDetailPage = lazy(() => import("@/features/profile/pages/UserDetailPage"));
const DuesConfigPage = lazy(() => import("@/features/finance/pages/DuesConfigPage"));
const GroupFinanceDetailPage = lazy(() => import("@/features/finance/pages/GroupFinanceDetailPage"));
const TransactionDetailPage = lazy(() => import("@/shared/pages/TransactionDetailPage"));
const FundRequestDetailPage = lazy(() => import("@/features/finance/pages/FundRequestDetailPage"));
const GroupDuesProgressPage = lazy(() => import("@/features/payment/pages/GroupDuesProgressPage"));
const RoleLabelSettingsPage = lazy(() => import("@/features/settings/pages/RoleLabelSettingsPage"));

// --- 1. UTILITY FUNCTIONS ---
const isAuthenticated = () => {
  return localStorage.getItem("user") !== null;
};

const getUserRole = () => {
  const userStr = localStorage.getItem("user");
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      return user.role;
    } catch (e) {
      return null;
    }
  }
  return null;
};

const getDashboardPathByRole = (role: string | null) => {
  switch (role) {
    case "LEADER": return "/dashboard/rw";
    case "ADMIN": return "/dashboard/rt";
    case "TREASURER": return "/dashboard/finance";
    case "RESIDENT": return "/dashboard/warga";
    default: return "/dashboard/warga";
  }
};

// --- 2. GUARDS (SATPAM) ---
const ProtectedRoute = () => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
};

const RoleProtectedRoute = ({ allowedRoles }: { allowedRoles: string[] }) => {
  const role = getUserRole();
  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to={getDashboardPathByRole(role)} replace />;
  }
  return <Outlet />;
};

const PublicRoute = () => {
  if (isAuthenticated()) {
    const role = getUserRole();
    return <Navigate to={getDashboardPathByRole(role)} replace />;
  }
  return <Outlet />;
};

const DashboardIndexRedirect = () => {
  const role = getUserRole();
  return <Navigate to={getDashboardPathByRole(role)} replace />;
};

// --- KOMPONEN FALLBACK LOADING ---
const PageLoader = () => (
  <div className="flex h-[calc(100vh-4rem)] w-full items-center justify-center bg-slate-50/50">
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 animate-bounce rounded-full bg-primary" />
      <p className="font-medium text-slate-500">Memuat halaman...</p>
    </div>
  </div>
);

// --- 3. APP ROUTER ---
function App() {
  return (
    <BrowserRouter>
      {/* Suspense akan merender PageLoader saat chunk JS halaman sedang diunduh */}
      <Suspense fallback={<PageLoader />}>
        <Routes>
          
          <Route path="/" element={ isAuthenticated() ? <DashboardIndexRedirect /> : <Navigate to="/login" replace /> } />

          <Route element={<PublicRoute />}>
              <Route path="/login" element={<LoginPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<DashboardLayout />}>
                  
                  <Route index element={<DashboardIndexRedirect />} />
                  
                  {/* --- RUTE DENGAN PROTEKSI ROLE --- */}
                  
                  {/* Hanya LEADER (Ketua RW) yang bisa buka ini */}
                  <Route element={<RoleProtectedRoute allowedRoles={["LEADER"]} />}>
                    <Route path="rw" element={<LeaderDashboard />} />
                    <Route path="kegiatan" element={<EventsPage />} />
                    <Route path="events/:id" element={<EventDetailPage />} />
                    <Route path="kas" element={<FinancePage />} />
                    <Route path="pembayaran" element={<PaymentPage />} />
                    
                    {/* Detail RT untuk RW */}
                    <Route path="detail-progres/:groupId" element={<PaymentPage />} />
                    <Route path="progres-iuran/:groupId" element={<GroupDuesProgressPage />} />
                  </Route>

                  {/* Hanya ADMIN (Ketua RT) yang bisa buka ini */}
                  <Route element={<RoleProtectedRoute allowedRoles={["ADMIN"]} />}>
                    <Route path="rt" element={<AdminDashboard />} />
                    <Route path="kegiatan-rt" element={<EventsPage />} />
                    <Route path="events-rt/:id" element={<EventDetailPage />} />
                    <Route path="kas-rt" element={<FinancePage />} />
                    <Route path="pembayaran-rt" element={<PaymentPage />} />
                  </Route>

                  {/* Hanya TREASURER (Bendahara) yang bisa buka ini */}
                  <Route element={<RoleProtectedRoute allowedRoles={["TREASURER"]} />}>
                    <Route path="finance" element={<TreasurerDashboard />} />
                    <Route path="organisasi-bendahara" element={<OrganizationPage />} />
                    <Route path="kegiatan-bendahara" element={<EventsPage />} />
                    <Route path="events-bendahara/:id" element={<EventDetailPage />} />
                    <Route path="kas-bendahara" element={<FinancePage />} />
                    <Route path="pembayaran-bendahara" element={<PaymentPage />} />
                    
                    {/* Detail RT untuk Bendahara */}
                    <Route path="detail-progres-bendahara/:groupId" element={<PaymentPage />} />
                    <Route path="progres-iuran-bendahara" element={<GroupDuesProgressPage />} />
                    <Route path="progres-iuran-bendahara/:groupId" element={<GroupDuesProgressPage />} />
                  </Route>

                  {/* LEADER boleh buka halaman organisasi */}
                  <Route element={<RoleProtectedRoute allowedRoles={["LEADER"]} />}>
                    <Route path="organisasi" element={<OrganizationPage />} />
                    <Route path="pengaturan" element={<RoleLabelSettingsPage />} />
                  </Route>

                  {/* ADMIN boleh buka halaman organisasi */}
                  <Route element={<RoleProtectedRoute allowedRoles={["ADMIN"]} />}>
                    <Route path="organisasi-rt" element={<OrganizationPage />} />
                  </Route>

                  {/* Detail User — Accessible by LEADER, ADMIN, TREASURER, dan RESIDENT */}
                  <Route element={<RoleProtectedRoute allowedRoles={["LEADER", "ADMIN", "TREASURER", "RESIDENT"]} />}>
                    <Route path="users/:id" element={<UserDetailPage />} />
                  </Route>

                  {/* Detail Keuangan RT — Bisa diakses oleh LEADER, ADMIN, dan TREASURER */}
                  <Route element={<RoleProtectedRoute allowedRoles={["LEADER", "ADMIN", "TREASURER"]} />}>
                    <Route path="keuangan-rt/:groupId" element={<GroupFinanceDetailPage />} />
                  </Route>

                  {/* Detail Transaksi — Accessible by ALL roles */}
                  <Route element={<RoleProtectedRoute allowedRoles={["LEADER", "ADMIN", "TREASURER", "RESIDENT"]} />}>
                    <Route path="transaksi/:id" element={<TransactionDetailPage />} />
                  </Route>

                  {/* Detail Pengajuan Dana — ADMIN, TREASURER, dan LEADER */}
                  <Route element={<RoleProtectedRoute allowedRoles={["ADMIN", "TREASURER", "LEADER"]} />}>
                    <Route path="pengajuan-dana/:id" element={<FundRequestDetailPage />} />
                  </Route>

                  {/* Pengaturan Iuran — LEADER dan ADMIN */}
                  <Route element={<RoleProtectedRoute allowedRoles={["LEADER", "ADMIN"]} />}>
                    <Route path="pengaturan-iuran" element={<DuesConfigPage />} />
                  </Route>

                  {/* Warga dashboard */}
                  <Route element={<RoleProtectedRoute allowedRoles={["RESIDENT"]} />}>
                    <Route path="warga" element={<ResidentDashboard />} />
                    <Route path="organisasi-warga" element={<OrganizationPage />} />
                    <Route path="kegiatan-warga" element={<EventsPage />} />
                    <Route path="events-warga/:id" element={<EventDetailPage />} />
                    <Route path="pembayaran-warga" element={<ResidentPaymentPage />} />
                  </Route>

                  {/* Profil bisa dibuka oleh SEMUA role yang sudah login */}
                  <Route path="profile" element={<ProfilePage />} />
              </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>

      <Toaster position="top-center" richColors /> 
    </BrowserRouter>
  );
}

export default App;

// --- UBAH <a href> MENJADI <Link to> ---
const NotFound = () => (
    <div className="flex flex-col items-center justify-center min-h-screen text-slate-500 bg-slate-50">
        <h1 className="text-6xl font-bold mb-2 font-poppins text-slate-900">404</h1>
        <p className="text-lg">Halaman tidak ditemukan</p>
        <Link to="/" className="mt-4 text-primary hover:text-brand-green hover:underline transition-colors font-medium">
          Kembali ke Beranda
        </Link>
    </div>
);