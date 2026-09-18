import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Field, inputClass } from "../../components/Form";
import { LocationPicker } from "../../components/LocationPicker";
import { api, ApiError } from "../../services/api";
import { DONOR_TYPES, RECIPIENT_TYPES, type User } from "../../types";
import { AdminHeader } from "./AdminChrome";

const DEMO = { lat: 12.9352, lng: 77.6245 };

export function UserFormPage() {
  const kitchens = useLocation().pathname.includes("/kitchens");
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [location, setLocation] = useState(DEMO);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    organizationName: "",
    address: "",
    donorType: "College Mess",
    recipientType: "NGO",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const data = await api<{ user: User }>("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          role: kitchens ? "DONOR" : "RECIPIENT",
          location,
          donorType: kitchens ? form.donorType : undefined,
          recipientType: kitchens ? undefined : form.recipientType,
        }),
      });
      navigate(`/admin/users/${data.user.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create this account.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <AdminHeader eyebrow="Admin" title={kitchens ? "New kitchen" : "New collector"} />
      <form onSubmit={onSubmit} className="space-y-4 rounded-[1.5rem] border border-border bg-card p-6">
        {error && <p className="text-sm text-alert">{error}</p>}
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
        <Field label="Password">
          <input className={inputClass} type="password" required minLength={8} value={form.password} onChange={(e) => set("password", e.target.value)} />
        </Field>
        {kitchens ? (
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
        <LocationPicker
          value={location}
          address={form.address}
          onChange={(next) => {
            setLocation({ lat: next.lat, lng: next.lng });
            set("address", next.address);
          }}
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Create account"}
        </Button>
      </form>
    </div>
  );
}
