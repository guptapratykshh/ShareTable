import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell, Button, Field, inputClass } from "../components/Form";
import { homeFor, useAuth } from "../context/AuthContext";
import { api, ApiError } from "../services/api";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [unverified, setUnverified] = useState(false);
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setUnverified(false);
    setPending(true);
    try {
      const user = await login(email, password, remember);
      navigate(homeFor(user.role));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not log in.";
      setError(message);
      setUnverified(err instanceof ApiError && err.status === 403 && /verify your email/i.test(message));
    } finally {
      setPending(false);
    }
  }

  async function resend() {
    setError("");
    setNotice("");
    setResending(true);
    try {
      await api("/api/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setNotice("If that address still needs confirming, we sent a new link.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not resend the link.");
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthShell
      asideTitle={
        <>
          Welcome
          <br />
          <em className="not-italic text-accent">back.</em>
        </>
      }
      asideBody="Pick up where you left off and help keep surplus food in the community."
      cardEyebrow="Welcome back"
      title="Good to see you again."
      subtitle="Log in to donate surplus food or claim nearby meals."
      switchLabel="New here?"
      switchTo="/register"
      switchCta="Register"
    >
      <form className="grid gap-4" onSubmit={onSubmit}>
        <Field label="Email">
          <input
            className={inputClass}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label="Password">
          <input
            className={inputClass}
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <label className="flex items-center gap-2 text-[11px] font-semibold text-muted">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Remember me
        </label>
        {notice && <p className="text-sm text-foreground">{notice}</p>}
        {error && <p className="text-sm text-alert">{error}</p>}
        {unverified && (
          <Button type="button" variant="outline" className="w-full" onClick={resend} disabled={resending}>
            {resending ? "Sending…" : "Resend verification link"}
          </Button>
        )}
        <Button disabled={pending} className="w-full">
          {pending ? "Signing in…" : "Log in"} <span aria-hidden>→</span>
        </Button>
      </form>
      <p className="mt-6 text-center text-xs text-muted">
        New to ShareTable?{" "}
        <Link to="/register" className="font-extrabold text-accent">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
