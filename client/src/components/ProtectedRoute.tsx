import { Navigate } from "react-router-dom";
import { homeFor, useAuth } from "../context/AuthContext";
import type { Role } from "../types";
import type { ReactNode } from "react";

export function ProtectedRoute({
  roles,
  children,
}: {
  roles: Role[];
  children: ReactNode;
}) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="p-10 text-muted">Loading…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}
