import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { EmptyState, PageLoading } from "../../components/PageChrome";
import { api } from "../../services/api";
import type { User } from "../../types";
import { formatDateTime } from "../../utils/format";
import { AdminCreateLink, AdminHeader, AdminLink, AdminTable } from "./AdminChrome";

export function UsersListPage() {
  const kitchens = useLocation().pathname.includes("/kitchens");
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    setUsers(null);
    const role = kitchens ? "DONOR" : "RECIPIENT";
    api<{ users: User[] }>(`/api/admin/users?role=${role}`)
      .then((data) => setUsers(data.users))
      .catch((e) => setError(e.message));
  }, [kitchens]);

  if (error) return <p className="text-alert">{error}</p>;
  if (!users) return <PageLoading label={kitchens ? "Loading kitchens…" : "Loading collectors…"} />;

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <AdminHeader
        eyebrow="Admin"
        title={kitchens ? "Kitchens" : "Collectors"}
        subtitle={
          kitchens
            ? "Surplus posters: organization, listings, and verification."
            : "Food collectors: claims, reliability, and NGO verification."
        }
        actions={<AdminCreateLink to={kitchens ? "/admin/kitchens/new" : "/admin/collectors/new"}>{kitchens ? "New kitchen" : "New collector"}</AdminCreateLink>}
      />
      {users.length === 0 ? (
        <EmptyState title={kitchens ? "No kitchens yet" : "No collectors yet"} body="Create an account from this console." />
      ) : (
        <AdminTable
          columns={
            kitchens
              ? ["Kitchen", "Type", "Address", "Listings", "Last post", "Status"]
              : ["Collector", "Type", "Address", "Claims", "Reliability", "Status"]
          }
        >
          {users.map((u) => (
            <tr key={u.id} className="border-t border-border">
              <td className="px-3 py-3">
                <AdminLink to={`/admin/users/${u.id}`}>{u.organizationName || u.name}</AdminLink>
                <p className="text-xs text-muted">{u.email}</p>
              </td>
              <td className="px-3 py-3">{u.donorType || u.recipientType}</td>
              <td className="max-w-[14rem] px-3 py-3 text-muted">{u.address}</td>
              {kitchens ? (
                <>
                  <td className="px-3 py-3">{u.listingsCount ?? 0}</td>
                  <td className="px-3 py-3">{u.lastPostedAt ? formatDateTime(u.lastPostedAt) : "—"}</td>
                </>
              ) : (
                <>
                  <td className="px-3 py-3">{u.claimsCount ?? 0}</td>
                  <td className="px-3 py-3">{u.reliabilityScore == null ? "—" : u.reliabilityScore}</td>
                </>
              )}
              <td className="px-3 py-3">
                {u.isFlagged ? "Flagged" : u.isVerified ? "Verified" : "Unverified"}
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
    </div>
  );
}
