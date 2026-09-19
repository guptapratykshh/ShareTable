import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthShell, Button, Field, inputClass } from "../components/Form";
import { LocationPicker } from "../components/LocationPicker";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../services/api";
import { DONOR_TYPES, RECIPIENT_TYPES } from "../types";

const DEMO = { lat: 12.9352, lng: 77.6245 };

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [role, setRole] = useState<"DONOR" | "RECIPIENT">(params.get("role") === "RECIPIENT" ? "RECIPIENT" : "DONOR");
  useEffect(() => {
    const next = params.get("role");
    if (next === "DONOR" || next === "RECIPIENT") setRole(next);
  }, [params]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [location, setLocation] = useState(DEMO);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
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
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    try {
      const { confirmPassword: _confirmPassword, ...fields } = form;
      await register({
        ...fields,
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
    <AuthShell
      asideTitle={
        <>
          Make every meal
          <br />
          <em className="not-italic text-accent">matter.</em>
        </>
      }
      asideBody="Join a local network helping good food reach the people who can use it."
      cardEyebrow="Create your account"
      title="Start sharing with your community."
      subtitle="Register as a donor or nearby recipient."
      switchLabel="Already registered?"
      switchTo="/login"
      switchCta="Log in"
    >
      <form className="grid gap-4" onSubmit={onSubmit}>
        <div className="mb-1 grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
          {(["DONOR", "RECIPIENT"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`rounded-lg px-2 py-2.5 text-[11px] font-extrabold ${role === r ? "bg-card text-foreground shadow-sm" : "text-muted"}`}
            >
              {r === "DONOR" ? "I have surplus food" : "I can collect food"}
            </button>
          ))}
        </div>
        <Field label="Full name">
          <input className={inputClass} autoComplete="name" placeholder="Your name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
        </Field>
        <Field label="Email">
          <input className={inputClass} type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={(e) => set("email", e.target.value)} required />
        </Field>
        <Field label="Phone">
          <input className={inputClass} type="tel" autoComplete="tel" placeholder="Your phone number" value={form.phone} onChange={(e) => set("phone", e.target.value)} required />
        </Field>
        <Field label="Password">
          <input
            className={inputClass}
            type="password"
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            minLength={8}
            autoComplete="new-password"
            placeholder="Enter your password"
            required
          />
        </Field>
        <Field label="Confirm password">
          <input
            className={inputClass}
            type="password"
            value={form.confirmPassword}
            onChange={(e) => set("confirmPassword", e.target.value)}
            minLength={8}
            autoComplete="new-password"
            placeholder="Repeat your password"
            required
          />
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
          autoLocate
          value={location}
          address={form.address}
          onChange={({ lat, lng, address }) => {
            setLocation({ lat, lng });
            set("address", address);
          }}
        />
        {error && <p className="text-sm text-alert">{error}</p>}
        <Button disabled={pending} className="w-full">
          {pending ? "Creating account…" : "Create account"} <span aria-hidden>→</span>
        </Button>
      </form>
      <p className="mt-6 text-center text-xs text-muted">
        Already have an account?{" "}
        <Link to="/login" className="font-extrabold text-accent">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
