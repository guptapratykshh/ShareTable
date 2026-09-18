import { Bell } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { homeFor, useAuth } from "../context/AuthContext";
import { NotificationProvider, useNotifications } from "../context/NotificationContext";
import { AdminSidebar } from "./AdminSidebar";
import { BrandMark } from "./SiteHeader";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationToasts } from "./NotificationToasts";
import { AssistantPanel } from "./AssistantPanel";

export function AppLayout() {
  return (
    <NotificationProvider>
      <AppShell />
    </NotificationProvider>
  );
}

function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();
  const isAdmin = user?.role === "ADMIN";

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
        : [];

  return (
    <div className={`bg-background text-foreground ${isAdmin ? "flex h-svh overflow-hidden" : "min-h-screen"}`}>
      {!isAdmin && <NotificationToasts />}
      {!isAdmin && <AssistantPanel />}
      {isAdmin && <AdminSidebar />}
      <div className={`flex min-w-0 flex-1 flex-col ${isAdmin ? "min-h-0" : ""}`}>
        <header className="sticky top-0 z-30 shrink-0 border-b border-border bg-background/90 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-[18px] sm:px-8 lg:px-12">
            <BrandMark to={user ? homeFor(user.role) : "/"} />
            {!isAdmin && (
              <nav className="hidden items-center gap-5 text-xs font-bold text-muted md:flex">
                {links.map(([to, label]) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      `rounded-full px-[13px] py-[9px] transition-colors ${
                        isActive ? "bg-primary text-primary-foreground" : "hover:text-foreground"
                      }`
                    }
                  >
                    {label}
                    {label === "Notifications" && unreadCount > 0 && (
                      <span className="ml-1 rounded-full bg-primary-foreground/20 px-1.5 text-[10px]">{unreadCount}</span>
                    )}
                  </NavLink>
                ))}
              </nav>
            )}
            <div className="flex items-center gap-3 text-xs">
              {user?.role === "RECIPIENT" && (
                <NavLink to="/recipient/notifications" className="relative rounded-full p-2 hover:bg-secondary md:hidden">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-alert" />}
                </NavLink>
              )}
              {!isAdmin && (
                <span className="hidden max-w-[10rem] truncate font-semibold text-foreground sm:inline lg:max-w-xs">
                  {user?.organizationName || user?.name}
                </span>
              )}
              <ThemeToggle compact />
              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate("/");
                }}
                className="inline-flex items-center gap-1 rounded-full px-3 py-2 font-bold text-muted transition-colors hover:bg-secondary hover:text-foreground"
              >
                Log out
              </button>
            </div>
          </div>
          {!isAdmin && (
            <nav className="flex gap-2 overflow-x-auto border-t border-border px-5 py-2.5 text-sm md:hidden lg:px-12">
              {links.map(([to, label]) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `whitespace-nowrap rounded-full px-4 py-2 ${isActive ? "bg-primary text-primary-foreground" : "text-muted"}`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          )}
        </header>
        <main
          className={`mx-auto w-full max-w-7xl flex-1 px-5 py-10 sm:px-8 lg:px-12 ${
            isAdmin ? "flex min-h-0 flex-col overflow-auto lg:py-8" : "lg:py-16"
          }`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
