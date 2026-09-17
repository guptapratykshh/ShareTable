import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell, Button, Field, inputClass } from "../components/Form";
import { LocationPicker } from "../components/LocationPicker";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../services/api";
import { DONOR_TYPES, RECIPIENT_TYPES } from "../types";

const DEMO = { lat: 12.9352, lng: 77.6245 };

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<"DONOR" | "RECIPIENT">("DONOR");
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
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      await register({
        ...form,
        role,
        location,
        donorType: role === "DONOR" ? form.donorType : undefined,
        recipientType: role === "RECIPIENT" ? form.recipientType : undefined,
      });
      navigate(`/check-email?email=${encodeURIComponent(form.email.trim())}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not register.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell title="Create an account" subtitle="Register as a donor or as a nearby recipient organization or community member.">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-secondary p-1">
          {(["DONOR", "RECIPIENT"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`rounded-full py-2.5 text-sm font-semibold ${role === r ? "bg-card text-foreground shadow-sm" : "text-muted"}`}
            >
              {r === "DONOR" ? "I have surplus food" : "I can collect food"}
            </button>
          ))}
        </div>
        <Field label="Full name">
          <input className={inputClass} value={form.name} onChange={(e) => set("name", e.target.value)} required />
        </Field>
        <Field label="Email">
          <input className={inputClass} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
        </Field>
        <Field label="Phone">
          <input className={inputClass} value={form.phone} onChange={(e) => set("phone", e.target.value)} required />
        </Field>
        <Field label="Password">
          <input className={inputClass} type="password" value={form.password} onChange={(e) => set("password", e.target.value)} minLength={8} required />
        </Field>
        <Field label="Organization name">
          <input className={inputClass} value={form.organizationName} onChange={(e) => set("organizationName", e.target.value)} />
        </Field>
        {role === "DONOR" ? (
          <Field label="Donor type">
            <select className={inputClass} value={form.donorType} onChange={(e) => set("donorType", e.target.value)}>
              {DONOR_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Recipient type">
            <select className={inputClass} value={form.recipientType} onChange={(e) => set("recipientType", e.target.value)}>
              {RECIPIENT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        )}
        <LocationPicker
          label="Address"
          value={location}
          address={form.address}
          onChange={({ lat, lng, address }) => {
            setLocation({ lat, lng });
            set("address", address);
          }}
        />
        {error && <p className="text-sm text-alert">{error}</p>}
        <Button disabled={pending} className="w-full">
          {pending ? "Creating account…" : "Register"}
        </Button>
      </form>
      <p className="mt-4 text-sm text-muted">
        Already registered? <Link to="/login" className="font-medium text-primary">Log in</Link>
      </p>
    </AuthShell>
  );
}
