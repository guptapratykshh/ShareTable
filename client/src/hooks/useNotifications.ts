import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { NotificationItem } from "../types";

export function useNotifications(enabled: boolean) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function load() {
      try {
        const data = await api<{ notifications: NotificationItem[]; unreadCount: number }>(
          "/api/notifications",
        );
        if (!cancelled) {
          setItems(data.notifications);
          setUnreadCount(data.unreadCount);
        }
      } catch {
        /* polling is best-effort */
      }
    }

    load();
    const id = window.setInterval(load, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled]);

  return { items, unreadCount, setItems, setUnreadCount };
}
