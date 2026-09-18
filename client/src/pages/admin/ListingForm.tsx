import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Field, inputClass } from "../../components/Form";
import { LocationPicker } from "../../components/LocationPicker";
import { PageLoading } from "../../components/PageChrome";
import { api, ApiError } from "../../services/api";
import { FOOD_CATEGORIES, type Donation, type User } from "../../types";
import { AdminHeader } from "./AdminChrome";

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

  if (!kitchens && !error) return <PageLoading label="Loading kitchens…" />;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <AdminHeader eyebrow="Admin" title="New listing" subtitle="Posted as the chosen kitchen." />
      <form onSubmit={onSubmit} className="space-y-4 rounded-[1.5rem] border border-border bg-card p-6">
        {error && <p className="text-sm text-alert">{error}</p>}
        <Field label="Kitchen">
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
        </Field>
        <Field label="Food">
          <input className={inputClass} required value={form.foodName} onChange={(e) => set("foodName", e.target.value)} />
        </Field>
        <Field label="Description">
          <textarea className={inputClass} required rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <Field label="Meals">
          <input className={inputClass} type="number" min={1} required value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
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
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.safetyConfirmed} onChange={(e) => set("safetyConfirmed", e.target.checked)} />
          Food is suitable for donation and has been handled safely.
        </label>
        <Button type="submit" disabled={pending}>
          {pending ? "Posting…" : "Post listing"}
        </Button>
      </form>
    </div>
  );
}
