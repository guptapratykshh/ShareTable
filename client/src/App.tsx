import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth, homeFor } from "./context/AuthContext";
import { AppLayout } from "./components/AppLayout";
import { PageLoading } from "./components/PageChrome";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { CheckEmailPage } from "./pages/CheckEmailPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import { DonorDashboard } from "./pages/donor/Dashboard";
import { DonatePage } from "./pages/donor/Donate";
import { DonorDonationsPage } from "./pages/donor/Donations";
import { DonorInsightsPage } from "./pages/donor/Insights";
import { RecipientDashboard } from "./pages/recipient/Dashboard";
import { RecipientClaimsPage } from "./pages/recipient/Claims";
import { NotificationsPage } from "./pages/recipient/Notifications";
import { AdminDashboard } from "./pages/admin/Dashboard";
import { UsersListPage } from "./pages/admin/UsersList";
import { UserFormPage } from "./pages/admin/UserForm";
import { UserDetailPage } from "./pages/admin/UserDetail";
import { ListingsPage } from "./pages/admin/Listings";
import { ListingFormPage } from "./pages/admin/ListingForm";
import { ListingDetailPage } from "./pages/admin/ListingDetail";
import { ClaimsPage } from "./pages/admin/Claims";
import { ClaimFormPage } from "./pages/admin/ClaimForm";
import { ClaimDetailPage } from "./pages/admin/ClaimDetail";
import { DonationDetailsPage } from "./pages/DonationDetailsPage";
import { ClaimDetailsPage } from "./pages/ClaimDetailsPage";

function RoleHome() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-12">
        <PageLoading />
      </div>
    );
  }
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
          <Route path="/check-email" element={<CheckEmailPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
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
              path="/donor/insights"
              element={
                <ProtectedRoute roles={["DONOR"]}>
                  <DonorInsightsPage />
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
            <Route
              path="/admin/kitchens"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <UsersListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/kitchens/new"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <UserFormPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/collectors"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <UsersListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/collectors/new"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <UserFormPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users/:id"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <UserDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/listings"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <ListingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/listings/new"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <ListingFormPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/listings/:id"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <ListingDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/claims"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <ClaimsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/claims/new"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <ClaimFormPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/claims/:id"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <ClaimDetailPage />
                </ProtectedRoute>
              }
            />
            <Route path="/donation/:id" element={<DonationDetailsPage />} />
            <Route path="/claims/:id" element={<ClaimDetailsPage />} />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute roles={["DONOR"]}>
                  <NotificationsPage />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
