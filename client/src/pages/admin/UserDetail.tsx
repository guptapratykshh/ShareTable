import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { MapContainer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ConfirmModal } from "../../components/ConfirmModal";
import { Button, Field, inputClass } from "../../components/Form";
import { LocationPicker } from "../../components/LocationPicker";
import { PageLoading } from "../../components/PageChrome";
import { StatusBadge } from "../../components/StatusBadge";
import { ThemedTileLayer } from "../../components/ThemedTileLayer";
import { api, ApiError } from "../../services/api";
import { DONOR_TYPES, RECIPIENT_TYPES, type Claim, type Donation, type User } from "../../types";
import { formatDateTime } from "../../utils/format";
import { AdminHeader, AdminLink, AdminTable } from "./AdminChrome";

const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

type Detail = {
  user: User;
  reliability?: { score: number | null; sampleSize: number; successfulRescues: number };
  donations: Donation[];
  claims: Claim[];
};

export function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    organizationName: "",
    address: "",
    donorType: "College Mess",
    recipientType: "NGO",
    password: "",
  });
  const [location, setLocation] = useState({ lat: 12.9352, lng: 77.6245 });

  async function load() {
    const data = await api<Detail>(`/api/admin/users/${id}`);
    setDetail(data);
    setForm({
      name: data.user.name,
      email: data.user.email,
      phone: data.user.phone,
      organizationName: data.user.organizationName ?? "",
      address: data.user.address,
      donorType: data.user.donorType ?? "College Mess",
      recipientType: data.user.recipientType ?? "NGO",
      password: "",
    });
    if (data.user.location) setLocation(data.user.location);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [id]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    setError("");
    setPending(true);
    try {
      await api(`/api/admin/users/${detail.user.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          organizationName: form.organizationName,
          address: form.address,
          location,
          role: detail.user.role,
          donorType: detail.user.role === "DONOR" ? form.donorType : undefined,
          recipientType: detail.user.role === "RECIPIENT" ? form.recipientType : undefined,
          password: form.password || undefined,
        }),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }

  async function patch(body: { isVerified?: boolean; isFlagged?: boolean }) {
    if (!detail) return;
    await api(`/api/admin/users/${detail.user.id}`, { method: "PATCH", body: JSON.stringify(body) });
    await load();
  }

  async function remove() {
    if (!detail) return;
    setPending(true);
    setError("");
    try {
      await api(`/api/admin/users/${detail.user.id}`, { method: "DELETE" });
      navigate(detail.user.role === "DONOR" ? "/admin/kitchens" : "/admin/collectors");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete.");
      setConfirm(false);
    } finally {
      setPending(false);
    }
  }

  if (error && !detail) return <p className="text-alert">{error}</p>;
  if (!detail) return <PageLoading />;
  const user = detail.user;
  const kitchen = user.role === "DONOR";

  return (
    <div className="space-y-6">
      <AdminHeader
        eyebrow={kitchen ? "Kitchen" : "Collector"}
        title={user.organizationName || user.name}
        subtitle={`${user.email} · ${user.phone}`}
        actions={
          <Link to={kitchen ? "/admin/kitchens" : "/admin/collectors"} className="text-sm font-semibold text-muted">
            Back to list
          </Link>
        }
      />
      {error && <p className="text-sm text-alert">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {user.role === "RECIPIENT" && user.recipientType === "NGO" && (
          <Button type="button" variant="outline" onClick={() => patch({ isVerified: !user.isVerified })}>
            {user.isVerified ? "Unverify NGO" : "Verify NGO"}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => patch({ isFlagged: !user.isFlagged })}>
          {user.isFlagged ? "Clear flag" : "Flag"}
        </Button>
        <Button type="button" variant="danger" onClick={() => setConfirm(true)}>
          Delete
        </Button>
      </div>

      {user.location && (
        <div className="overflow-hidden rounded-[1.5rem] border border-border">
          <div className="h-56">
            <MapContainer attributionControl={false} center={[user.location.lat, user.location.lng]} zoom={15} className="h-full w-full">
              <ThemedTileLayer />
              <Marker position={[user.location.lat, user.location.lng]} icon={icon} />
            </MapContainer>
          </div>
          <p className="px-4 py-2 text-xs text-muted">{user.address}</p>
        </div>
      )}

      {!kitchen && detail.reliability && (
        <p className="text-sm text-muted">
          Reliability {detail.reliability.score ?? "—"} · {detail.reliability.sampleSize} claims · {detail.reliability.successfulRescues} meals rescued
        </p>
      )}

      <form onSubmit={save} className="space-y-4 rounded-[1.5rem] border border-border bg-card p-6">
        <Field label="Name">
          <input className={inputClass} required value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Organization">
          <input className={inputClass} value={form.organizationName} onChange={(e) => set("organizationName", e.target.value)} />
        </Field>
        <Field label="Email">
          <input className={inputClass} type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Phone">
          <input className={inputClass} required value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        {kitchen ? (
          <Field label="Kitchen type">
            <select className={inputClass} value={form.donorType} onChange={(e) => set("donorType", e.target.value)}>
              {DONOR_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Collector type">
            <select className={inputClass} value={form.recipientType} onChange={(e) => set("recipientType", e.target.value)}>
              {RECIPIENT_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label="New password (optional)">
          <input className={inputClass} type="password" minLength={8} value={form.password} onChange={(e) => set("password", e.target.value)} />
        </Field>
        <LocationPicker
          value={location}
          address={form.address}
          onChange={(next) => {
            setLocation({ lat: next.lat, lng: next.lng });
            set("address", next.address);
          }}
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </form>

      {kitchen ? (
        <section className="space-y-3">
          <h2 className="font-semibold">Listings</h2>
          {detail.donations.length === 0 ? (
            <p className="text-sm text-muted">No listings yet.</p>
          ) : (
            <AdminTable columns={["Food", "Status", "Available", "Posted"]}>
              {detail.donations.map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <AdminLink to={`/admin/listings/${d.id}`}>{d.foodName}</AdminLink>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-3 py-2">
                    {d.availableQuantity}/{d.quantity}
                  </td>
                  <td className="px-3 py-2">{formatDateTime(d.createdAt)}</td>
                </tr>
              ))}
            </AdminTable>
          )}
        </section>
      ) : (
        <section className="space-y-3">
          <h2 className="font-semibold">Claims</h2>
          {detail.claims.length === 0 ? (
            <p className="text-sm text-muted">No claims yet.</p>
          ) : (
            <AdminTable columns={["Food", "Qty", "Status", "Claimed"]}>
              {detail.claims.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <AdminLink to={`/admin/claims/${c.id}`}>{c.donation?.foodName ?? c.donationId}</AdminLink>
                  </td>
                  <td className="px-3 py-2">{c.quantity}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-3 py-2">{formatDateTime(c.claimedAt)}</td>
                </tr>
              ))}
            </AdminTable>
          )}
        </section>
      )}

      <ConfirmModal
        open={confirm}
        title="Delete this account?"
        body="Accounts with rescued meals stay on record. Other listings and open claims will be removed."
        confirmLabel="Delete account"
        cancelLabel="Keep account"
        busy={pending}
        onConfirm={remove}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}
