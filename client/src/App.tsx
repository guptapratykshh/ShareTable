import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth, homeFor } from "./context/AuthContext";
import { AppLayout } from "./components/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DonorDashboard } from "./pages/donor/Dashboard";
import { DonatePage } from "./pages/donor/Donate";
import { DonorDonationsPage } from "./pages/donor/Donations";
import { RecipientDashboard } from "./pages/recipient/Dashboard";
import { RecipientClaimsPage } from "./pages/recipient/Claims";
import { NotificationsPage } from "./pages/recipient/Notifications";
import { AdminDashboard } from "./pages/admin/Dashboard";
import { DonationDetailsPage } from "./pages/DonationDetailsPage";
import { ClaimDetailsPage } from "./pages/ClaimDetailsPage";

function RoleHome() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10 text-muted">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={homeFor(user.role)} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/app" element={<RoleHome />} />
          <Route
            element={
              <ProtectedRoute roles={["DONOR", "RECIPIENT", "ADMIN"]}>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route
              path="/donor/dashboard"
              element={
                <ProtectedRoute roles={["DONOR"]}>
                  <DonorDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/donor/donate"
              element={
                <ProtectedRoute roles={["DONOR"]}>
                  <DonatePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/donor/donations"
              element={
                <ProtectedRoute roles={["DONOR"]}>
                  <DonorDonationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recipient/dashboard"
              element={
                <ProtectedRoute roles={["RECIPIENT"]}>
                  <RecipientDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recipient/claims"
              element={
                <ProtectedRoute roles={["RECIPIENT"]}>
                  <RecipientClaimsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recipient/notifications"
              element={
                <ProtectedRoute roles={["RECIPIENT"]}>
                  <NotificationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="/donation/:id" element={<DonationDetailsPage />} />
            <Route path="/claims/:id" element={<ClaimDetailsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
