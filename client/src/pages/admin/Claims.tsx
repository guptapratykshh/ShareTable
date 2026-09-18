import { useEffect, useState } from "react";
import { EmptyState, PageLoading } from "../../components/PageChrome";
import { StatusBadge } from "../../components/StatusBadge";
import { api } from "../../services/api";
import type { Claim } from "../../types";
import { formatDateTime } from "../../utils/format";
import { AdminCreateLink, AdminHeader, AdminLink, AdminTable } from "./AdminChrome";

export function ClaimsPage() {
  const [claims, setClaims] = useState<Claim[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ claims: Claim[] }>("/api/admin/claims")
      .then((data) => setClaims(data.claims))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-alert">{error}</p>;
  if (!claims) return <PageLoading label="Loading claims…" />;

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <AdminHeader
        eyebrow="Admin"
        title="Claims"
        subtitle="Reservations and pickups. Pickup codes are only on the claim detail."
        actions={<AdminCreateLink to="/admin/claims/new">New claim</AdminCreateLink>}
      />
      {claims.length === 0 ? (
        <EmptyState title="No claims" body="Create a reservation from this console." />
      ) : (
        <AdminTable columns={["Food", "Collector", "Qty", "Status", "Claimed"]}>
          {claims.map((c) => (
            <tr key={c.id} className="border-t border-border">
              <td className="px-3 py-3">
                <AdminLink to={`/admin/claims/${c.id}`}>{c.donation?.foodName ?? c.donationId}</AdminLink>
              </td>
              <td className="px-3 py-3">
                {c.recipient ? (
                  <AdminLink to={`/admin/users/${c.recipient.id}`}>
                    {c.recipient.organizationName || c.recipient.name}
                  </AdminLink>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-3 py-3">{c.quantity}</td>
              <td className="px-3 py-3">
                <StatusBadge status={c.status} />
              </td>
              <td className="px-3 py-3">{formatDateTime(c.claimedAt)}</td>
            </tr>
          ))}
        </AdminTable>
      )}
    </div>
  );
}
