import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import type { NotificationItem } from "../types";

function toastHref(item: NotificationItem, role?: string) {
  if (item.claimId) return `/claims/${item.claimId}`;
  if (item.donationId) return `/donation/${item.donationId}`;
  return role === "RECIPIENT" ? "/recipient/notifications" : "/notifications";
}

function ToastCard({ item, onDismiss }: { item: NotificationItem; onDismiss: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const id = window.setTimeout(onDismiss, 5000);
    return () => window.clearTimeout(id);
  }, [item.id, onDismiss]);

  const preview = item.message.split("\n")[0];

  return (
    <button
      type="button"
      onClick={() => {
        onDismiss();
        navigate(toastHref(item, user?.role));
      }}
      className="w-80 rounded-2xl border border-border bg-card p-4 text-left shadow-[0_16px_40px_rgba(15,23,42,0.16)]"
    >
      <p className="text-sm font-semibold">{item.title}</p>
      <p className="mt-1 line-clamp-2 text-sm text-muted">{preview}</p>
    </button>
  );
}

export function NotificationToasts() {
  const { toasts, dismissToast } = useNotifications();
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed right-4 top-20 z-[2000] flex flex-col gap-2 sm:right-8">
      {toasts.map((item) => (
        <div key={item.id} className="pointer-events-auto">
          <ToastCard item={item} onDismiss={() => dismissToast(item.id)} />
        </div>
      ))}
    </div>
  );
}
