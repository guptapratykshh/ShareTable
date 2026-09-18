import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { ClipboardList, CookingPot, Gauge, HeartHandshake, Package, PanelLeftClose, PanelLeftOpen } from "lucide-react";

const KEY = "sharetable-admin-sidebar";

const LINKS = [
  { to: "/admin/dashboard", label: "Impact", icon: Gauge, end: true },
  { to: "/admin/kitchens", label: "Kitchens", icon: CookingPot },
  { to: "/admin/collectors", label: "Collectors", icon: HeartHandshake },
  { to: "/admin/listings", label: "Listings", icon: Package },
  { to: "/admin/claims", label: "Claims", icon: ClipboardList },
] as const;

export function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(KEY) === "collapsed");

  useEffect(() => {
    localStorage.setItem(KEY, collapsed ? "collapsed" : "expanded");
  }, [collapsed]);

  return (
    <aside
      className={`sticky top-0 flex h-full shrink-0 flex-col overflow-y-auto border-r border-border bg-[color-mix(in_srgb,var(--card)_86%,var(--background))] transition-[width] duration-200 ${
        collapsed ? "w-[72px]" : "w-[235px]"
      }`}
    >
      <div className={`flex items-center ${collapsed ? "justify-center px-2 py-6" : "justify-between px-4 py-8"}`}>
        {!collapsed && (
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">Admin</p>
        )}
        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed((value) => !value)}
          className="rounded-full p-2 text-muted transition-colors hover:bg-secondary hover:text-foreground"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>
      <nav className="flex flex-1 flex-col gap-1.5 px-3" aria-label="Admin">
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={"end" in link ? link.end : false}
            title={link.label}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-[14px] px-3.5 py-3 text-sm font-extrabold transition-colors ${
                collapsed ? "justify-center px-0" : ""
              } ${isActive ? "bg-primary text-primary-foreground" : "text-muted hover:bg-secondary hover:text-foreground"}`
            }
          >
            <link.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{link.label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
