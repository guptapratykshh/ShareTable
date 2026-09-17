import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell, Button, Field, inputClass } from "../components/Form";
import { homeFor, useAuth } from "../context/AuthContext";
import { ApiError } from "../services/api";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const user = await login(email, password);
      navigate(homeFor(user.role));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not log in.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Log in to donate surplus food or claim nearby meals.">
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field label="Email">
          <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password">
          <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        {error && <p className="text-sm text-alert">{error}</p>}
        <Button disabled={pending} className="w-full">
          {pending ? "Signing in…" : "Log in"}
        </Button>
      </form>
      <p className="mt-4 text-sm text-muted">
        New here? <Link to="/register" className="font-medium text-primary">Create an account</Link>
      </p>
    </AuthShell>
  );
}
