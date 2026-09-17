import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Field, inputClass } from "../../components/Form";
import { LocationPicker } from "../../components/LocationPicker";
import { useAuth } from "../../context/AuthContext";
import { api, ApiError } from "../../services/api";
import { FOOD_CATEGORIES } from "../../types";

export function DonatePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [location, setLocation] = useState(user?.location ?? { lat: 12.9352, lng: 77.6245 });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [aiHint, setAiHint] = useState("");
  const [form, setForm] = useState({
    foodName: "Rice + Dal + Vegetables",
    description: "Freshly prepared vegetarian meal from the evening mess service.",
    quantity: "40",
    category: "Vegetarian",
    preparedAt: "",
    bestBefore: "",
    storageCondition: "Kept covered in insulated containers",
    address: user?.address ?? "College Cafeteria",
    pickupInstructions: "Enter from the west gate. Ask for the mess supervisor.",
    safetyConfirmed: false,
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function enhance() {
    setAiHint("");
    try {
      const data = await api<{ available: boolean; description?: string; category?: string; error?: string }>(
        "/api/ai/describe-food",
        { method: "POST", body: JSON.stringify({ text: form.foodName + " " + form.description }) },
      );
      if (!data.available) return;
      if (data.description) set("description", data.description);
      if (data.category) set("category", data.category);
      setAiHint("Description updated. Quantity is still entered by you. ShareTable never predicts meal counts.");
    } catch {
      // Optional helper; the donor can keep typing the description.
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const quantity = Number(form.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      setError("Enter the number of surplus meals. ShareTable does not predict this number.");
      return;
    }
    if (!form.safetyConfirmed) {
      setError("Please confirm that the food is suitable for donation and has been handled safely.");
      return;
    }
    setPending(true);
    try {
      const data = await api<{ donation: { id: string }; notifiedRecipientCount: number }>(
        "/api/donations",
        {
          method: "POST",
          body: JSON.stringify({
            ...form,
            quantity,
            location,
            preparedAt: form.preparedAt ? new Date(form.preparedAt).toISOString() : undefined,
            bestBefore: form.bestBefore ? new Date(form.bestBefore).toISOString() : undefined,
          }),
        },
      );
      navigate(`/donation/${data.donation.id}`, { state: { notified: data.notifiedRecipientCount } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create donation.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="display text-4xl font-semibold tracking-tight">Donate surplus food</h1>
      <p className="mt-2 text-muted">
        Enter how many meals you have. Nearby registered recipients within 2.5 km are notified. Listings expire in one hour.
      </p>

      <form className="mt-6 space-y-4 rounded-[1.5rem] border border-border bg-card p-6" onSubmit={onSubmit}>
        <Field label="Food name">
          <input className={inputClass} value={form.foodName} onChange={(e) => set("foodName", e.target.value)} required />
        </Field>
        <Field label="Description">
          <textarea className={inputClass} rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} required />
        </Field>
        <button type="button" onClick={enhance} className="text-sm font-medium text-accent">
          Improve description with AI (optional)
        </button>
        {aiHint && <p className="text-xs text-muted">{aiHint}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Number of meals">
            <input
              className={inputClass}
              type="number"
              min={1}
              step={1}
              value={form.quantity}
              onChange={(e) => set("quantity", e.target.value)}
              required
            />
          </Field>
          <Field label="Category">
            <select className={inputClass} value={form.category} onChange={(e) => set("category", e.target.value)}>
              {FOOD_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prepared at">
            <input className={inputClass} type="datetime-local" value={form.preparedAt} onChange={(e) => set("preparedAt", e.target.value)} />
          </Field>
          <Field label="Best before">
            <input className={inputClass} type="datetime-local" value={form.bestBefore} onChange={(e) => set("bestBefore", e.target.value)} />
          </Field>
        </div>
        <Field label="Storage condition">
          <input className={inputClass} value={form.storageCondition} onChange={(e) => set("storageCondition", e.target.value)} />
        </Field>
        <LocationPicker
          label="Pickup location"
          value={location}
          address={form.address}
          onChange={({ lat, lng, address }) => {
            setLocation({ lat, lng });
            set("address", address);
          }}
        />
        <Field label="Pickup instructions">
          <textarea className={inputClass} rows={2} value={form.pickupInstructions} onChange={(e) => set("pickupInstructions", e.target.value)} />
        </Field>
        <p className="rounded-xl bg-secondary px-3 py-3 text-xs text-muted">
          Donors are responsible for ensuring that donated food is safe, properly handled, and suitable for consumption.
          ShareTable only facilitates discovery, claiming, and pickup.
        </p>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.safetyConfirmed}
            onChange={(e) => set("safetyConfirmed", e.target.checked)}
            className="mt-1"
          />
          I confirm that the food is suitable for donation and has been handled safely.
        </label>
        {error && <p className="text-sm text-alert">{error}</p>}
        <Button disabled={pending} className="w-full">
          {pending ? "Notifying recipients…" : "Post donation"}
        </Button>
      </form>
    </div>
  );
}
