import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ButtonLink, EmptyState, PageHeader } from "../../components/PageChrome";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { formatDateTime } from "../../utils/format";

const EMPTY_COPY = {
  DONOR: {
    body: "When someone claims your listing, pickup updates will show up here.",
    action: { to: "/donor/donate", label: "Donate surplus food" },
  },
  RECIPIENT: {
    body: "When surplus is posted nearby, it will show up here.",
    action: { to: "/recipient/dashboard", label: "See nearby meals" },
  },
  ADMIN: {
    body: "Alerts from the network will show up here.",
    action: null,
  },
} as const;

export function NotificationsPage() {
  const { user } = useAuth();
  const { items, markAllRead } = useNotifications();
  const empty = EMPTY_COPY[user?.role ?? "ADMIN"];

  useEffect(() => {
    markAllRead().catch(() => undefined);
  }, [markAllRead]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Alerts"
        title="Notifications"
        subtitle="New alerts also appear as a pop-up on any screen. Opening this tab marks them read."
      />
      <div className="space-y-3">
        {items.map((n) => (
          <article
            key={n.id}
            className={`rounded-[1.25rem] border border-border p-4 ${n.isRead ? "bg-card" : "bg-secondary"}`}
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
        <EmptyState
          title="You're all caught up"
          body={empty.body}
          action={empty.action ? <ButtonLink to={empty.action.to}>{empty.action.label}</ButtonLink> : undefined}
        />
      )}
    </div>
  );
}
