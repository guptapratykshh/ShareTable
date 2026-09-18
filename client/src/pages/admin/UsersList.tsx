import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { EmptyState, PageLoading } from "../../components/PageChrome";
import { ToneBadge } from "../../components/StatusBadge";
import { api } from "../../services/api";
import type { User } from "../../types";
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

export function UsersListPage() {
  const kitchens = useLocation().pathname.includes("/kitchens");
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "verified" | "unverified" | "flagged">("all");

  useEffect(() => {
    setError("");
    setUsers(null);
    setQuery("");
    setTypeFilter("all");
    setStatusFilter("all");
    const role = kitchens ? "DONOR" : "RECIPIENT";
    api<{ users: User[] }>(`/api/admin/users?role=${role}`)
      .then((data) => setUsers(data.users))
      .catch((e) => setError(e.message));
  }, [kitchens]);

  const types = useMemo(() => {
    const values = new Set((users ?? []).map((u) => (kitchens ? u.donorType : u.recipientType)).filter(Boolean) as string[]);
    return ["all", ...values];
  }, [users, kitchens]);

  const filtered = (users ?? []).filter((u) => {
    const hay = `${u.organizationName ?? ""} ${u.name} ${u.email}`.toLowerCase();
    if (query && !hay.includes(query.toLowerCase())) return false;
    const type = kitchens ? u.donorType : u.recipientType;
    if (typeFilter !== "all" && type !== typeFilter) return false;
    if (statusFilter === "verified" && !u.isVerified) return false;
    if (statusFilter === "unverified" && u.isVerified) return false;
    if (statusFilter === "flagged" && !u.isFlagged) return false;
    return true;
  });

  if (error) return <p className="text-alert">{error}</p>;
  if (!users) return <PageLoading label={kitchens ? "Loading kitchens…" : "Loading collectors…"} />;

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <AdminHeader
        eyebrow="Admin directory"
        title={kitchens ? "Kitchens" : "Collectors"}
        subtitle={
          kitchens
            ? "Manage surplus partners, verification, and posting activity."
            : "Review recipient accounts, claim activity, and reliability."
        }
        actions={
          <AdminCreateLink to={kitchens ? "/admin/kitchens/new" : "/admin/collectors/new"}>
            {kitchens ? "New kitchen" : "New collector"}
          </AdminCreateLink>
        }
      />
      <AdminToolbar>
        <input
          className={adminSearchClass}
          placeholder={kitchens ? "Search kitchens" : "Search collectors"}
          aria-label={kitchens ? "Search kitchens" : "Search collectors"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {types.map((type) => (
          <AdminFilterButton key={type} active={typeFilter === type} onClick={() => setTypeFilter(type)}>
            {type === "all" ? "All types" : type}
          </AdminFilterButton>
        ))}
        {(["all", "verified", "unverified"] as const).map((status) => (
          <AdminFilterButton key={status} active={statusFilter === status} onClick={() => setStatusFilter(status)}>
            {status === "all" ? "All" : status === "verified" ? "Verified" : "Unverified"}
          </AdminFilterButton>
        ))}
      </AdminToolbar>
      {filtered.length === 0 ? (
        <EmptyState title={kitchens ? "No kitchens yet" : "No collectors yet"} body="Create an account from this console." />
      ) : (
        <AdminTable
          columns={
            kitchens
              ? ["Kitchen", "Type", "Address", "Listings", "Last post", "Status"]
              : ["Collector", "Type", "Address", "Claims", "Reliability", "Status"]
          }
        >
          {filtered.map((u) => (
            <tr key={u.id} className="border-t border-border">
              <td className="px-4 py-4">
                <AdminLink to={`/admin/users/${u.id}`}>{u.organizationName || u.name}</AdminLink>
                <small className="mt-1 block text-[11px] text-muted">{u.email}</small>
              </td>
              <td className="px-4 py-4">{u.donorType || u.recipientType}</td>
              <td className="max-w-[14rem] px-4 py-4 text-muted">{u.address}</td>
              {kitchens ? (
                <>
                  <td className="px-4 py-4">{u.listingsCount ?? 0}</td>
                  <td className="px-4 py-4">{u.lastPostedAt ? formatDateTime(u.lastPostedAt) : "—"}</td>
                </>
              ) : (
                <>
                  <td className="px-4 py-4">{u.claimsCount ?? 0}</td>
                  <td className="px-4 py-4">{u.reliabilityScore == null ? "—" : `${u.reliabilityScore}%`}</td>
                </>
              )}
              <td className="px-4 py-4">
                <ToneBadge tone={u.isFlagged ? "bad" : u.isVerified ? "good" : "warn"}>
                  {u.isFlagged ? "Flagged" : u.isVerified ? "Verified" : "Unverified"}
                </ToneBadge>
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
    </div>
  );
}
