import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthShell, Button } from "../components/Form";
import { api, ApiError } from "../services/api";

export function CheckEmailPage() {
  const [params] = useSearchParams();
  const email = params.get("email")?.trim() ?? "";
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function resend() {
    if (!email) {
      setError("Enter the email you registered with on the login page to resend a link.");
      return;
    }
    setError("");
    setNotice("");
    setPending(true);
    try {
      await api("/api/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setNotice("If that address still needs confirming, we sent a new link.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not resend the link.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      asideTitle={
        <>
          Check
          <br />
          <em className="not-italic text-accent">your email.</em>
        </>
      }
      asideBody="Open the confirmation link we sent, then log in. The link expires in 24 hours."
      cardEyebrow="Almost there"
      title="Check your email"
      subtitle="We sent a confirmation link. Open it, then log in."
      switchLabel="Already confirmed?"
      switchTo="/login"
      switchCta="Log in"
    >
      {email ? <p className="text-sm">Sent to <span className="font-medium">{email}</span>.</p> : null}
      {notice && <p className="mt-3 rounded-xl bg-primary/5 px-3 py-2 text-sm text-primary">{notice}</p>}
      {error && <p className="mt-3 text-sm text-alert">{error}</p>}
      <div className="mt-6 flex flex-col gap-2">
        <Button type="button" onClick={resend} disabled={pending} className="w-full">
          {pending ? "Sending…" : "Resend link"}
        </Button>
        <Link
          to="/login"
          className="inline-flex items-center justify-center rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold hover:bg-secondary"
        >
          Back to log in
        </Link>
      </div>
    </AuthShell>
  );
}
