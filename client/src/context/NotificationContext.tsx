import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "../services/api";
import type { NotificationItem } from "../types";
import { useAuth } from "./AuthContext";

type NotificationContextValue = {
  items: NotificationItem[];
  unreadCount: number;
  toasts: NotificationItem[];
  markAllRead: () => Promise<void>;
  dismissToast: (id: string) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState<NotificationItem[]>([]);
  const seenRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setUnreadCount(0);
      setToasts([]);
      seenRef.current = null;
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const data = await api<{ notifications: NotificationItem[]; unreadCount: number }>("/api/notifications");
        if (cancelled) return;
        if (!seenRef.current) {
          seenRef.current = new Set(data.notifications.map((n) => n.id));
        } else {
          const fresh = data.notifications.filter((n) => !seenRef.current!.has(n.id));
          for (const n of fresh) seenRef.current.add(n.id);
          if (fresh.length) {
            setToasts((prev) => [...fresh, ...prev].slice(0, 5));
          }
        }
        setItems(data.notifications);
        setUnreadCount(data.unreadCount);
      } catch {
        /* polling is best-effort */
      }
    }

    load();
    const id = window.setInterval(load, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [user?.id]);

  const markAllRead = useCallback(async () => {
    await api("/api/notifications/read-all", { method: "PATCH" });
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(
    () => ({ items, unreadCount, toasts, markAllRead, dismissToast }),
    [items, unreadCount, toasts, markAllRead, dismissToast],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
