import { Bell, LogOut } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { homeFor, useAuth } from "../context/AuthContext";
import { useNotifications } from "../hooks/useNotifications";
import { BrandMark } from "./SiteHeader";

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { unreadCount } = useNotifications(Boolean(user));

  const links =
    user?.role === "DONOR"
      ? [
          ["/donor/dashboard", "Dashboard"],
          ["/donor/donate", "Donate food"],
          ["/donor/donations", "Donations"],
          ["/notifications", "Notifications"],
        ]
      : user?.role === "RECIPIENT"
        ? [
            ["/recipient/dashboard", "Nearby food"],
            ["/recipient/claims", "My claims"],
            ["/recipient/notifications", "Notifications"],
          ]
        : [
            ["/admin/dashboard", "Impact"],
            ["/notifications", "Notifications"],
          ];

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <BrandMark to={user ? homeFor(user.role) : "/"} />
          <nav className="hidden items-center gap-1 text-sm font-medium md:flex">
            {links.map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 transition-colors ${
                    isActive ? "bg-primary text-primary-foreground" : "text-muted hover:bg-secondary hover:text-foreground"
                  }`
                }
              >
                {label}
                {label === "Notifications" && unreadCount > 0 && (
                  <span className="ml-1 rounded-full bg-primary-foreground/20 px-1.5 text-xs">{unreadCount}</span>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            {user?.role === "RECIPIENT" && (
              <NavLink to="/recipient/notifications" className="relative rounded-full p-2 hover:bg-secondary md:hidden">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-alert" />}
              </NavLink>
            )}
            <span className="hidden text-muted sm:inline">{user?.organizationName || user?.name}</span>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate("/");
              }}
              className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-muted transition-colors hover:bg-secondary hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        </div>
        <nav className="flex gap-2 overflow-x-auto border-t border-border px-5 py-2 text-sm md:hidden">
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-full px-3 py-1.5 ${isActive ? "bg-primary text-primary-foreground" : "text-muted"}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <Outlet />
      </main>
    </div>
  );
}
