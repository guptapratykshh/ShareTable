import { useEffect, useState } from "react";
import { EmptyState, PageLoading } from "../../components/PageChrome";
import { StatusBadge } from "../../components/StatusBadge";
import { api } from "../../services/api";
import type { Donation } from "../../types";
import { formatDateTime } from "../../utils/format";
import { AdminCreateLink, AdminHeader, AdminLink, AdminTable } from "./AdminChrome";

export function ListingsPage() {
  const [donations, setDonations] = useState<Donation[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ donations: Donation[] }>("/api/admin/donations")
      .then((data) => setDonations(data.donations))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-alert">{error}</p>;
  if (!donations) return <PageLoading label="Loading listings…" />;

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <AdminHeader
        eyebrow="Admin"
        title="Listings"
        subtitle="Every surplus post on the platform."
        actions={<AdminCreateLink to="/admin/listings/new">New listing</AdminCreateLink>}
      />
      {donations.length === 0 ? (
        <EmptyState title="No listings" body="Post surplus as a kitchen from this console." />
      ) : (
        <AdminTable columns={["Food", "Kitchen", "Status", "Available", "Address", "Posted"]}>
          {donations.map((d) => (
            <tr key={d.id} className="border-t border-border">
              <td className="px-3 py-3">
                <AdminLink to={`/admin/listings/${d.id}`}>{d.foodName}</AdminLink>
              </td>
              <td className="px-3 py-3">
                {d.donor ? (
                  <AdminLink to={`/admin/users/${d.donor.id}`}>{d.donor.organizationName || d.donor.name}</AdminLink>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-3 py-3">
                <StatusBadge status={d.status} />
              </td>
              <td className="px-3 py-3">
                {d.availableQuantity}/{d.quantity}
              </td>
              <td className="max-w-[14rem] px-3 py-3 text-muted">{d.address}</td>
              <td className="px-3 py-3">{formatDateTime(d.createdAt)}</td>
            </tr>
          ))}
        </AdminTable>
      )}
    </div>
  );
}
