import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, PageHeader, PageLoading } from "../../components/PageChrome";
import { StatusBadge } from "../../components/StatusBadge";
import { api } from "../../services/api";
import type { Claim } from "../../types";
import { formatDateTime } from "../../utils/format";

export function RecipientClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ claims: Claim[] }>("/api/claims")
      .then((d) => setClaims(d.claims))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoading label="Loading claims…" />;

  return (
    <div className="space-y-8">
      <PageHeader title="My claims" eyebrow="Collections" subtitle="Pickup codes, reserved meals, and completed collections." />
      {error && <p className="text-alert">{error}</p>}
      <div className="space-y-3">
        {claims.map((c) => (
          <Link
            key={c.id}
            to={`/claims/${c.id}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-accent/40"
          >
            <div>
              <p className="font-semibold">{c.donation?.foodName ?? "Donation"}</p>
              <p className="text-sm text-muted">
                {c.quantity} meals
                {c.claimCode ? ` · code ${c.claimCode}` : ""} · {formatDateTime(c.claimedAt)}
              </p>
            </div>
            <StatusBadge status={c.status} />
          </Link>
        ))}
      </div>
      {claims.length === 0 && !error && (
        <EmptyState title="No claims yet" body="When you reserve nearby meals, they will show up here with a pickup code." />
      )}
    </div>
  );
}
