import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, inputClass } from "../../components/Form";
import { LocationPicker } from "../../components/LocationPicker";
import { api, ApiError } from "../../services/api";
import { DONOR_TYPES, RECIPIENT_TYPES, type User } from "../../types";
import { AdminField, AdminFormCard, AdminHeader } from "./AdminChrome";

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
    <div className="space-y-8">
      <AdminHeader
        eyebrow={kitchens ? "Kitchens" : "Collectors"}
        title={
          kitchens ? (
            <>
              New <em className="text-accent not-italic">kitchen</em>
            </>
          ) : (
            <>
              New <em className="text-accent not-italic">collector</em>
            </>
          )
        }
        subtitle={
          kitchens
            ? "Add a trusted surplus partner to ShareTable."
            : "Register an individual or organization that can receive surplus meals."
        }
      />
      <AdminFormCard
        title={kitchens ? "Kitchen details" : "Collector details"}
        description={
          kitchens
            ? "Keep contact and pickup information current so collectors know where to go."
            : "Verified collectors receive nearby listing alerts and can create claims."
        }
      >
        <form onSubmit={onSubmit} className="grid gap-x-3.5 gap-y-4 sm:grid-cols-2">
          {error && <p className="text-sm text-alert sm:col-span-2">{error}</p>}
          <AdminField label={kitchens ? "Kitchen name" : "Name"}>
            <input className={inputClass} required placeholder={kitchens ? "e.g. Polaris College Mess" : "Full name or organization"} value={form.name} onChange={(e) => set("name", e.target.value)} />
          </AdminField>
          <AdminField label="Organization">
            <input className={inputClass} placeholder="Organization name" value={form.organizationName} onChange={(e) => set("organizationName", e.target.value)} />
          </AdminField>
          <AdminField label="Email">
            <input className={inputClass} type="email" required placeholder="team@example.com" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </AdminField>
          <AdminField label="Phone">
            <input className={inputClass} required placeholder="+91 00000 00000" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </AdminField>
          <AdminField label="Password">
            <input className={inputClass} type="password" required minLength={8} value={form.password} onChange={(e) => set("password", e.target.value)} />
          </AdminField>
          {kitchens ? (
            <AdminField label="Kitchen type">
              <select className={inputClass} value={form.donorType} onChange={(e) => set("donorType", e.target.value)}>
                {DONOR_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </AdminField>
          ) : (
            <AdminField label="Collector type">
              <select className={inputClass} value={form.recipientType} onChange={(e) => set("recipientType", e.target.value)}>
                {RECIPIENT_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </AdminField>
          )}
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
          <Button type="submit" disabled={pending} className="sm:col-span-2">
            {pending ? "Saving…" : "Save changes"} <span aria-hidden>→</span>
          </Button>
        </form>
      </AdminFormCard>
    </div>
  );
}
