import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useNotifications } from "../../context/NotificationContext";
import { formatDateTime } from "../../utils/format";

export function NotificationsPage() {
  const { items, markAllRead } = useNotifications();

  useEffect(() => {
    markAllRead().catch(() => undefined);
  }, [markAllRead]);

  return (
    <div>
      <h1 className="display text-4xl font-semibold tracking-tight">Notifications</h1>
      <p className="mt-2 text-muted">New alerts also appear as a pop-up on any screen. Opening this tab marks them read.</p>
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
