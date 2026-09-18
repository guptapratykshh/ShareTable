import { useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Field, inputClass } from "../../components/Form";
import { LocationPicker } from "../../components/LocationPicker";
import { useAuth } from "../../context/AuthContext";
import { api, ApiError } from "../../services/api";
import { COMMON_ALLERGENS, FOOD_CATEGORIES } from "../../types";

const STEPS = [
  { id: 0, label: "01 Essentials" },
  { id: 1, label: "02 Safety" },
  { id: 2, label: "03 Pickup" },
] as const;

type Step = (typeof STEPS)[number]["id"];

function Section({
  step,
  title,
  body,
  children,
}: {
  step: string;
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-8 border-b border-border px-6 py-9 sm:px-10 lg:grid-cols-[minmax(210px,0.7fr)_1.5fr] lg:gap-12">
      <div className="flex gap-4">
        <span className="display text-sm text-accent">{step}</span>
        <div>
          <h2 className="display m-0 mb-2.5 text-[25px] leading-[1.05]">{title}</h2>
          <p className="m-0 max-w-[210px] text-xs leading-5 text-muted">{body}</p>
        </div>
      </div>
      <div>{children}</div>
    </section>
  );
}

export function DonatePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(0);
  const [location, setLocation] = useState(user?.location ?? { lat: 12.9352, lng: 77.6245 });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [aiHint, setAiHint] = useState("");
  const [allergens, setAllergens] = useState<string[]>([]);
  const [customAllergen, setCustomAllergen] = useState("");
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

  function toggleAllergen(name: string) {
    setAllergens((current) =>
      current.some((item) => item.toLowerCase() === name.toLowerCase())
        ? current.filter((item) => item.toLowerCase() !== name.toLowerCase())
        : [...current, name].slice(0, 15),
    );
  }

  function addCustomAllergen() {
    const name = customAllergen.replace(/\s+/g, " ").trim().slice(0, 40);
    if (!name) return;
    toggleAllergen(name);
    setCustomAllergen("");
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function essentialsReady() {
    if (!form.foodName.trim() || !form.description.trim()) {
      setError("Fill in the food name and a short description.");
      return false;
    }
    const quantity = Number(form.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      setError("Enter the number of surplus meals. ShareTable does not predict this number.");
      return false;
    }
    return true;
  }

  function goToStep(next: Step) {
    if (next === step) return;
    setError("");
    if (next > 0 && step === 0 && !essentialsReady()) return;
    setStep(next);
  }

  function goNext() {
    if (step === 0) goToStep(1);
    else if (step === 1) goToStep(2);
  }

  function goBack() {
    if (step === 2) goToStep(1);
    else if (step === 1) goToStep(0);
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
    if (step !== 2) {
      goNext();
      return;
    }
    setError("");
    const quantity = Number(form.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      setError("Enter the number of surplus meals. ShareTable does not predict this number.");
      setStep(0);
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
            allergens,
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
    <div className="mx-auto max-w-[960px]">
      <section className="max-w-[750px] pb-10 pt-2">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">Share surplus</p>
        <h1 className="display mt-3 text-[clamp(3rem,7vw,5.1rem)] leading-[0.94]">
          Give good food
          <br />
          <em className="not-italic text-accent">a second table.</em>
        </h1>
        <p className="mt-4 max-w-[490px] text-[15px] leading-6 text-muted">
          Tell nearby recipients what is available. Your listing stays live for one hour, so keep the details simple and useful.
        </p>
      </section>

      <form
        className="mb-16 overflow-hidden rounded-[22px] border border-border bg-card shadow-[18px_20px_0_color-mix(in_srgb,var(--accent)_14%,transparent)]"
        onSubmit={onSubmit}
      >
        <div className="flex gap-7 border-b border-border px-6 py-4 text-[11px] font-extrabold uppercase tracking-[0.08em] sm:px-7">
          {STEPS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => goToStep(item.id)}
              aria-current={item.id === step ? "step" : undefined}
              className={
                item.id === step
                  ? "relative bg-transparent p-0 text-accent after:absolute after:inset-x-0 after:-bottom-[17px] after:h-0.5 after:bg-accent"
                  : item.id < step
                    ? "bg-transparent p-0 text-foreground/70 hover:text-accent"
                    : "bg-transparent p-0 text-muted hover:text-foreground"
              }
            >
              {item.label}
            </button>
          ))}
        </div>

        {step === 0 && (
          <Section step="01" title="What are you sharing?" body="Start with the details recipients need to decide quickly.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Food name">
                  <input className={inputClass} value={form.foodName} onChange={(e) => set("foodName", e.target.value)} required />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Short description">
                  <textarea className={inputClass} rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} required />
                </Field>
                <button type="button" onClick={enhance} className="mt-2 text-xs font-extrabold text-accent">
                  Improve description with AI (optional)
                </button>
                {aiHint && <p className="mt-1 text-[11px] text-muted">{aiHint}</p>}
              </div>
              <Field label="Number of meals">
                <input className={inputClass} type="number" min={1} step={1} value={form.quantity} onChange={(e) => set("quantity", e.target.value)} required />
              </Field>
              <Field label="Category">
                <select className={inputClass} value={form.category} onChange={(e) => set("category", e.target.value)}>
                  {FOOD_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>
          </Section>
        )}

        {step === 1 && (
          <Section
            step="02"
            title="Make it safe to claim."
            body="Be transparent about allergens and how the food was handled."
          >
            <div className="grid gap-5">
              <fieldset className="m-0 border-0 p-0">
                <legend className="mb-1 text-[11px] font-extrabold">Allergens in this food</legend>
                <p className="m-0 text-[11px] font-medium leading-5 text-muted">
                  Check what you know is in the food. ShareTable does not test meals. You can select more than one, and add extras.
                </p>
                <div className="mt-3.5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {COMMON_ALLERGENS.map((name) => {
                    const checked = allergens.some((item) => item.toLowerCase() === name.toLowerCase());
                    return (
                      <label key={name} className="flex items-center gap-2 text-xs font-semibold text-muted">
                        <input type="checkbox" checked={checked} onChange={() => toggleAllergen(name)} />
                        {name}
                      </label>
                    );
                  })}
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    className={inputClass}
                    value={customAllergen}
                    placeholder="Add another allergen"
                    onChange={(e) => setCustomAllergen(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomAllergen();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={addCustomAllergen} className="min-h-11 shrink-0 px-4">
                    Add
                  </Button>
                </div>
                {allergens.filter((name) => !COMMON_ALLERGENS.includes(name as (typeof COMMON_ALLERGENS)[number])).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {allergens
                      .filter((name) => !COMMON_ALLERGENS.includes(name as (typeof COMMON_ALLERGENS)[number]))
                      .map((name) => (
                        <button
                          key={name}
                          type="button"
                          className="rounded-full border border-border bg-secondary px-3 py-1 text-xs"
                          onClick={() => toggleAllergen(name)}
                        >
                          {name} · remove
                        </button>
                      ))}
                  </div>
                )}
              </fieldset>
              <Field label="Storage condition">
                <input className={inputClass} value={form.storageCondition} onChange={(e) => set("storageCondition", e.target.value)} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Prepared at">
                  <input className={inputClass} type="datetime-local" value={form.preparedAt} onChange={(e) => set("preparedAt", e.target.value)} />
                </Field>
                <Field label="Best before">
                  <input className={inputClass} type="datetime-local" value={form.bestBefore} onChange={(e) => set("bestBefore", e.target.value)} />
                </Field>
              </div>
            </div>
          </Section>
        )}

        {step === 2 && (
          <Section step="03" title="Where can it be picked up?" body="Choose a precise location and add anything that makes handoff easier.">
            <div className="grid gap-5">
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
                <textarea className={inputClass} rows={3} value={form.pickupInstructions} onChange={(e) => set("pickupInstructions", e.target.value)} />
              </Field>
            </div>
          </Section>
        )}

        <div className="grid gap-4 bg-[color-mix(in_srgb,var(--secondary)_22%,var(--card))] px-6 py-8 sm:px-10">
          {step === 2 && (
            <>
              <p className="m-0 text-[11px] leading-5 text-muted">
                Donors are responsible for ensuring that donated food is safe, properly handled, and suitable for consumption.
                ShareTable only facilitates discovery, claiming, and pickup.
              </p>
              <label className="flex items-start gap-2 text-xs font-semibold text-muted">
                <input
                  type="checkbox"
                  checked={form.safetyConfirmed}
                  onChange={(e) => set("safetyConfirmed", e.target.checked)}
                  className="mt-0.5"
                />
                I confirm this food is suitable for donation and has been handled safely.
              </label>
            </>
          )}
          {error && <p className="text-sm text-alert">{error}</p>}
          <div className={`flex gap-3 ${step === 0 ? "" : "sm:justify-between"}`}>
            {step > 0 && (
              <Button type="button" variant="outline" onClick={goBack} className="min-w-28">
                Back
              </Button>
            )}
            {step < 2 ? (
              <Button type="button" onClick={goNext} className={step === 0 ? "w-full" : "flex-1"}>
                Next <span aria-hidden>→</span>
              </Button>
            ) : (
              <Button disabled={pending} className="flex-1">
                {pending ? "Notifying recipients…" : "Review and post donation"} <span aria-hidden>→</span>
              </Button>
            )}
          </div>
          {step === 2 && (
            <p className="m-0 text-center text-[11px] text-muted">Nearby registered recipients within 2.5 km will be notified.</p>
          )}
        </div>
      </form>
    </div>
  );
}
