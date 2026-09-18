import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ButtonLink, EmptyState, IconTile, PageHeader, SectionToolbar } from "../../components/PageChrome";
import { homeFor, useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { formatDateTime } from "../../utils/format";

const EMPTY_COPY = {
  DONOR: {
    body: "New activity will appear here as your food finds a home.",
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

function notificationIcon(type: string, title: string) {
  const key = `${type} ${title}`.toLowerCase();
  if (key.includes("pickup") || key.includes("picked") || key.includes("completed")) return "✓";
  if (key.includes("claim")) return "↗";
  return "•";
}

function isSuccessTone(type: string, title: string) {
  const key = `${type} ${title}`.toLowerCase();
  return key.includes("pickup") || key.includes("picked") || key.includes("completed");
}

export function NotificationsPage() {
  const { user } = useAuth();
  const { items, unreadCount, markAllRead } = useNotifications();
  const empty = EMPTY_COPY[user?.role ?? "ADMIN"];
  const dashboard = user ? homeFor(user.role) : "/";

  useEffect(() => {
    const opened = Date.now();
    return () => {
      if (Date.now() - opened < 200) return;
      markAllRead().catch(() => undefined);
    };
  }, [markAllRead]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Stay in the loop"
        title="Notifications"
        subtitle="Updates about claims, pickups, and listings that need your attention."
      />
      {items.length > 0 && (
        <SectionToolbar label="Recent updates" meta={unreadCount > 0 ? undefined : "All caught up"}>
          {unreadCount > 0 ? (
            <span className="rounded-full bg-accent/17 px-2.5 py-1 text-[10px] font-extrabold text-accent">{unreadCount} unread</span>
          ) : null}
        </SectionToolbar>
      )}
      <div className="grid gap-2.5">
        {items.map((n) => {
          const success = isSuccessTone(n.type, n.title);
          return (
            <article key={n.id} className="relative flex gap-4 rounded-[18px] border border-border bg-card px-6 py-5">
              <IconTile accent={success}>{notificationIcon(n.type, n.title)}</IconTile>
              <div className="min-w-0 flex-1 pr-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="display text-[19px] font-semibold">{n.title}</h2>
                  <time className="text-[11px] text-muted">{formatDateTime(n.createdAt)}</time>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-muted">{n.message}</p>
                <div className="mt-3.5 flex flex-wrap gap-4 text-[11px] font-extrabold text-accent">
                  {n.donationId && <Link to={`/donation/${n.donationId}`}>View donation</Link>}
                  {n.claimId && <Link to={`/claims/${n.claimId}`}>View claim</Link>}
                  <Link to={dashboard}>Open dashboard</Link>
                </div>
              </div>
              {!n.isRead && <span className="absolute right-6 top-6 size-1.5 rounded-full bg-accent" aria-label="Unread notification" />}
            </article>
          );
        })}
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
