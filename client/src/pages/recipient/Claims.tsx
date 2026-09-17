import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { StatusBadge } from "../../components/StatusBadge";
import { api } from "../../services/api";
import type { Claim } from "../../types";
import { formatDateTime } from "../../utils/format";

export function RecipientClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ claims: Claim[] }>("/api/claims")
      .then((d) => setClaims(d.claims))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h1 className="display text-4xl font-semibold tracking-tight">My claims</h1>
      <p className="mt-2 text-muted">Pickup codes, reserved meals, and completed collections.</p>
      {error && <p className="mt-4 text-alert">{error}</p>}
      <div className="mt-6 space-y-3">
        {claims.map((c) => (
          <Link
            key={c.id}
            to={`/claims/${c.id}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-border bg-card p-4"
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
        <p className="mt-6 rounded-[1.5rem] bg-secondary p-8 text-center text-sm text-muted">No claims yet.</p>
      )}
    </div>
  );
}
