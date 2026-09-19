import { useEffect, useMemo, useState } from "react";
import { EmptyState, PageLoading } from "../../components/PageChrome";
import { StatusBadge } from "../../components/StatusBadge";
import { api } from "../../services/api";
import type { Claim } from "../../types";
import { formatDateTime } from "../../utils/format";
import {
  AdminCreateLink,
  AdminFilterButton,
  AdminHeader,
  AdminLink,
  AdminTable,
  AdminToolbar,
  adminSearchClass,
} from "./AdminChrome";

type StatusFilter = "all" | "CLAIMED" | "PICKED_UP" | "CANCELLED";

export function ClaimsPage() {
  const [claims, setClaims] = useState<Claim[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  useEffect(() => {
    api<{ claims: Claim[] }>("/api/admin/claims")
      .then((data) => setClaims(data.claims))
      .catch((e) => setError(e.message));
  }, []);

  const filtered = useMemo(() => {
    return (claims ?? []).filter((c) => {
      const hay = `${c.donation?.foodName ?? ""} ${c.recipient?.organizationName ?? ""} ${c.recipient?.name ?? ""}`.toLowerCase();
      if (query && !hay.includes(query.toLowerCase())) return false;
      if (status === "all") return true;
      if (status === "CLAIMED") return c.status === "CLAIMED" || c.status === "PICKUP_PENDING";
      return c.status === status;
    });
  }, [claims, query, status]);

  if (error) return <p className="text-alert">{error}</p>;
  if (!claims) return <PageLoading />;

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <AdminHeader
        eyebrow="Admin operations"
        title="Claims"
        subtitle="Track reservations, pickups, and exceptions before they become waste."
        actions={<AdminCreateLink to="/admin/claims/new">New claim</AdminCreateLink>}
      />
      <AdminToolbar>
        <input
          className={adminSearchClass}
          placeholder="Search food or collector"
          aria-label="Search claims"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {([
          ["all", "All statuses"],
          ["CLAIMED", "Reserved"],
          ["PICKED_UP", "Picked up"],
          ["CANCELLED", "Cancelled"],
        ] as const).map(([id, label]) => (
          <AdminFilterButton key={id} active={status === id} onClick={() => setStatus(id)}>
            {label}
          </AdminFilterButton>
        ))}
      </AdminToolbar>
      {filtered.length === 0 ? (
        <EmptyState title="No claims" body="Create a reservation from this console." />
      ) : (
        <AdminTable columns={["Food", "Collector", "Qty", "Status", "Claimed"]}>
          {filtered.map((c) => (
            <tr key={c.id} className="border-t border-border">
              <td className="px-4 py-4">
                <AdminLink to={`/admin/claims/${c.id}`}>{c.donation?.foodName ?? c.donationId}</AdminLink>
              </td>
              <td className="px-4 py-4">
                {c.recipient ? (
                  <AdminLink to={`/admin/users/${c.recipient.id}`}>
                    {c.recipient.organizationName || c.recipient.name}
                  </AdminLink>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-4">{c.quantity}</td>
              <td className="px-4 py-4">
                <StatusBadge status={c.status} />
              </td>
              <td className="px-4 py-4">{formatDateTime(c.claimedAt)}</td>
            </tr>
          ))}
        </AdminTable>
      )}
    </div>
  );
}
