import { useEffect, useMemo, useState } from "react";
import { EmptyState, PageLoading } from "../../components/PageChrome";
import { StatusBadge } from "../../components/StatusBadge";
import { api } from "../../services/api";
import type { Donation } from "../../types";
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

type StatusFilter = "all" | "ACTIVE" | "EXPIRED" | "COMPLETED";

export function ListingsPage() {
  const [donations, setDonations] = useState<Donation[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  useEffect(() => {
    api<{ donations: Donation[] }>("/api/admin/donations")
      .then((data) => setDonations(data.donations))
      .catch((e) => setError(e.message));
  }, []);

  const filtered = useMemo(() => {
    return (donations ?? []).filter((d) => {
      const hay = `${d.foodName} ${d.donor?.organizationName ?? ""} ${d.donor?.name ?? ""} ${d.category}`.toLowerCase();
      if (query && !hay.includes(query.toLowerCase())) return false;
      if (status === "all") return true;
      if (status === "ACTIVE") return ["ACTIVE", "PARTIALLY_CLAIMED"].includes(d.status);
      if (status === "COMPLETED") return d.status === "COMPLETED" || d.status === "FULLY_CLAIMED";
      return d.status === status;
    });
  }, [donations, query, status]);

  if (error) return <p className="text-alert">{error}</p>;
  if (!donations) return <PageLoading />;

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <AdminHeader
        eyebrow="Admin operations"
        title="Listings"
        subtitle="Every surplus post, its current state, and the next action."
        actions={<AdminCreateLink to="/admin/listings/new">New listing</AdminCreateLink>}
      />
      <AdminToolbar>
        <input
          className={adminSearchClass}
          placeholder="Search food or kitchen"
          aria-label="Search listings"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {([
          ["all", "All statuses"],
          ["ACTIVE", "Active"],
          ["COMPLETED", "Completed"],
          ["EXPIRED", "Expired"],
        ] as const).map(([id, label]) => (
          <AdminFilterButton key={id} active={status === id} onClick={() => setStatus(id)}>
            {label}
          </AdminFilterButton>
        ))}
      </AdminToolbar>
      {filtered.length === 0 ? (
        <EmptyState title="No listings" body="Post surplus as a kitchen from this console." />
      ) : (
        <AdminTable columns={["Food", "Kitchen", "Status", "Available", "Posted"]}>
          {filtered.map((d) => (
            <tr key={d.id} className="border-t border-border">
              <td className="px-4 py-4">
                <AdminLink to={`/admin/listings/${d.id}`}>{d.foodName}</AdminLink>
                <small className="mt-1 block text-[11px] text-muted">{d.category}</small>
              </td>
              <td className="px-4 py-4">
                {d.donor ? (
                  <AdminLink to={`/admin/users/${d.donor.id}`}>{d.donor.organizationName || d.donor.name}</AdminLink>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-4">
                <StatusBadge status={d.status} />
              </td>
              <td className="px-4 py-4">
                {d.availableQuantity} / {d.quantity}
              </td>
              <td className="px-4 py-4">{formatDateTime(d.createdAt)}</td>
            </tr>
          ))}
        </AdminTable>
      )}
    </div>
  );
}
