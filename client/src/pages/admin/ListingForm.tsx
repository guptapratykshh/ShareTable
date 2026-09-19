import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button, inputClass } from "../../components/Form";
import { LocationPicker } from "../../components/LocationPicker";
import { PageLoading } from "../../components/PageChrome";
import { api, ApiError } from "../../services/api";
import { FOOD_CATEGORIES, type Donation, type User } from "../../types";
import { AdminField, AdminFormCard, AdminHeader } from "./AdminChrome";

export function ListingFormPage() {
  const navigate = useNavigate();
  const [kitchens, setKitchens] = useState<User[] | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [donorId, setDonorId] = useState("");
  const [location, setLocation] = useState({ lat: 12.9352, lng: 77.6245 });
  const [form, setForm] = useState({
    foodName: "",
    description: "",
    quantity: "20",
    category: "Vegetarian",
    address: "",
    pickupInstructions: "",
    safetyConfirmed: false,
  });

  useEffect(() => {
    api<{ users: User[] }>("/api/admin/users?role=DONOR")
      .then((data) => {
        setKitchens(data.users);
        const first = data.users[0];
        if (first) {
          setDonorId(first.id);
          setForm((current) => ({ ...current, address: first.address }));
          if (first.location) setLocation(first.location);
        }
      })
      .catch((e) => setError(e.message));
  }, []);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const data = await api<{ donation: Donation }>("/api/admin/donations", {
        method: "POST",
        body: JSON.stringify({
          donorId,
          foodName: form.foodName,
          description: form.description,
          quantity: Number(form.quantity),
          category: form.category,
          address: form.address,
          pickupInstructions: form.pickupInstructions,
          location,
          safetyConfirmed: form.safetyConfirmed,
        }),
      });
      navigate(`/admin/listings/${data.donation.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create listing.");
    } finally {
      setPending(false);
    }
  }

  if (!kitchens && !error) return <PageLoading />;

  return (
    <div className="space-y-8">
      <AdminHeader
        eyebrow="Listings"
        title={
          <>
            New <em className="text-accent not-italic">listing</em>
          </>
        }
        subtitle="Post a surplus meal with enough detail for a safe, quick pickup."
      />
      <AdminFormCard
        title="Listing details"
        description="Clear quantities, categories, and pickup guidance help meals move faster."
      >
        <form onSubmit={onSubmit} className="grid gap-x-3.5 gap-y-4 sm:grid-cols-2">
          {error && <p className="text-sm text-alert sm:col-span-2">{error}</p>}
          <AdminField label="Kitchen">
            <select
              className={inputClass}
              value={donorId}
              onChange={(e) => {
                const next = kitchens?.find((k) => k.id === e.target.value);
                setDonorId(e.target.value);
                if (next) {
                  set("address", next.address);
                  if (next.location) setLocation(next.location);
                }
              }}
            >
              {(kitchens ?? []).map((k) => (
                <option key={k.id} value={k.id}>
                  {k.organizationName || k.name}
                </option>
              ))}
            </select>
          </AdminField>
          <AdminField label="Food name">
            <input className={inputClass} required placeholder="e.g. Rice + Dal + Vegetables" value={form.foodName} onChange={(e) => set("foodName", e.target.value)} />
          </AdminField>
          <AdminField label="Description" wide>
            <textarea className={inputClass} required rows={4} placeholder="Describe what is available" value={form.description} onChange={(e) => set("description", e.target.value)} />
          </AdminField>
          <AdminField label="Meals">
            <input className={inputClass} type="number" min={1} required value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
          </AdminField>
          <AdminField label="Category">
            <select className={inputClass} value={form.category} onChange={(e) => set("category", e.target.value)}>
              {FOOD_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </AdminField>
          <div className="sm:col-span-2">
            <LocationPicker
              value={location}
              address={form.address}
              onChange={(next) => {
                setLocation({ lat: next.lat, lng: next.lng });
                set("address", next.address);
              }}
            />
          </div>
          <AdminField label="Pickup instructions" wide>
            <textarea className={inputClass} rows={2} value={form.pickupInstructions} onChange={(e) => set("pickupInstructions", e.target.value)} />
          </AdminField>
          <label className="flex items-center gap-2 text-sm font-normal sm:col-span-2">
            <input type="checkbox" checked={form.safetyConfirmed} onChange={(e) => set("safetyConfirmed", e.target.checked)} />
            Food is suitable for donation and has been handled safely.
          </label>
          <Button type="submit" disabled={pending} className="sm:col-span-2">
            {pending ? "Posting…" : "Save changes"} <span aria-hidden>→</span>
          </Button>
        </form>
      </AdminFormCard>
    </div>
  );
}
