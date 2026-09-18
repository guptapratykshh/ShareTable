import { Navigate } from "react-router-dom";
import { homeFor, useAuth } from "../context/AuthContext";
import type { Role } from "../types";
import type { ReactNode } from "react";
import { PageLoading } from "./PageChrome";

export function ProtectedRoute({
  roles,
  children,
}: {
  roles: Role[];
  children: ReactNode;
}) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-12">
        <PageLoading />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}
