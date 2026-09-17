import { Link } from "react-router-dom";
import { useNotifications } from "../../hooks/useNotifications";
import { api } from "../../services/api";
import { formatDateTime } from "../../utils/format";

export function NotificationsPage() {
  const { items, setItems, setUnreadCount } = useNotifications(true);

  async function markRead(id: string) {
    await api(`/api/notifications/${id}/read`, { method: "PATCH" });
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  return (
    <div>
      <h1 className="display text-4xl font-semibold tracking-tight">Notifications</h1>
      <p className="mt-2 text-muted">Updates refresh automatically every 20 seconds.</p>
      <div className="mt-6 space-y-3">
        {items.map((n) => (
          <article
            key={n.id}
            className={`rounded-2xl border border-border p-4 ${n.isRead ? "bg-card" : "bg-secondary"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold">{n.title}</h2>
              <span className="text-xs text-muted">{formatDateTime(n.createdAt)}</span>
            </div>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-muted">{n.message}</pre>
            <div className="mt-3 flex gap-3 text-sm">
              {n.donationId && (
                <Link to={`/donation/${n.donationId}`} className="font-medium text-primary">
                  View donation
                </Link>
              )}
              {n.claimId && (
                <Link to={`/claims/${n.claimId}`} className="font-medium text-primary">
                  View claim
                </Link>
              )}
              {!n.isRead && (
                <button type="button" className="text-muted" onClick={() => markRead(n.id)}>
                  Mark read
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {items.length === 0 && (
        <p className="mt-6 rounded-[1.5rem] bg-secondary p-8 text-center text-sm text-muted">No notifications yet.</p>
      )}
    </div>
  );
}
