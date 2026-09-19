import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConfirmModal } from "../../components/ConfirmModal";
import { Button, Field, inputClass } from "../../components/Form";
import { LocationPicker } from "../../components/LocationPicker";
import { PageLoading } from "../../components/PageChrome";
import { StatusBadge } from "../../components/StatusBadge";
import { api, ApiError } from "../../services/api";
import { FOOD_CATEGORIES, type Claim, type Donation } from "../../types";
import { formatDateTime } from "../../utils/format";
import { AdminHeader, AdminLink, AdminTable } from "./AdminChrome";

type Detail = { donation: Donation; claims: Claim[] };

export function ListingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [location, setLocation] = useState({ lat: 12.9352, lng: 77.6245 });
  const [form, setForm] = useState({
    foodName: "",
    description: "",
    category: "Vegetarian",
    address: "",
    pickupInstructions: "",
  });

  async function load() {
    const data = await api<Detail>(`/api/admin/donations/${id}`);
    setDetail(data);
    setForm({
      foodName: data.donation.foodName,
      description: data.donation.description,
      category: data.donation.category,
      address: data.donation.address ?? "",
      pickupInstructions: data.donation.pickupInstructions ?? "",
    });
    if (data.donation.location) setLocation(data.donation.location);
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
      await api(`/api/admin/donations/${detail.donation.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...form, location }),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save listing.");
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!detail) return;
    setPending(true);
    try {
      await api(`/api/admin/donations/${detail.donation.id}`, { method: "DELETE" });
      navigate("/admin/listings");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete listing.");
      setConfirm(false);
    } finally {
      setPending(false);
    }
  }

  if (error && !detail) return <p className="text-alert">{error}</p>;
  if (!detail) return <PageLoading />;
  const d = detail.donation;

  return (
    <div className="space-y-6">
      <AdminHeader
        eyebrow="Listing"
        title={d.foodName}
        subtitle={`${d.availableQuantity} of ${d.quantity} meals still available`}
        actions={
          <Link to="/admin/listings" className="text-sm font-semibold text-muted">
            Back to listings
          </Link>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={d.status} />
        {d.donor && <AdminLink to={`/admin/users/${d.donor.id}`}>{d.donor.organizationName || d.donor.name}</AdminLink>}
        <Button type="button" variant="danger" onClick={() => setConfirm(true)}>
          Delete
        </Button>
      </div>
      {error && <p className="text-sm text-alert">{error}</p>}

      <form onSubmit={save} className="space-y-4 rounded-[1.5rem] border border-border bg-card p-6">
        <Field label="Food">
          <input className={inputClass} required value={form.foodName} onChange={(e) => set("foodName", e.target.value)} />
        </Field>
        <Field label="Description">
          <textarea className={inputClass} required rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <Field label="Category">
          <select className={inputClass} value={form.category} onChange={(e) => set("category", e.target.value)}>
            {FOOD_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <LocationPicker
          value={location}
          address={form.address}
          onChange={(next) => {
            setLocation({ lat: next.lat, lng: next.lng });
            set("address", next.address);
          }}
        />
        <Field label="Pickup instructions">
          <textarea className={inputClass} rows={2} value={form.pickupInstructions} onChange={(e) => set("pickupInstructions", e.target.value)} />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save listing"}
        </Button>
      </form>

      <section className="space-y-3">
        <h2 className="font-semibold">Claims</h2>
        {detail.claims.length === 0 ? (
          <p className="text-sm text-muted">No claims on this listing.</p>
        ) : (
          <AdminTable columns={["Collector", "Qty", "Status", "Claimed"]}>
            {detail.claims.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <AdminLink to={`/admin/claims/${c.id}`}>
                    {c.recipient?.organizationName || c.recipient?.name || c.recipientId}
                  </AdminLink>
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

      <ConfirmModal
        open={confirm}
        title="Delete this listing?"
        body="Listings with recorded pickups cannot be removed, so rescued totals stay intact."
        confirmLabel="Delete listing"
        cancelLabel="Keep listing"
        busy={pending}
        onConfirm={remove}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}
