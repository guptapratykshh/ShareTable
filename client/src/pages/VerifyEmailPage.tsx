import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthShell, Button } from "../components/Form";
import { api, ApiError } from "../services/api";

function verifiedKey(token: string) {
  return `sharetable-email-verified:${token}`;
}

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token")?.trim() ?? "";
  const [status, setStatus] = useState<"working" | "ok" | "error">(token ? "working" : "error");
  const [error, setError] = useState(token ? "" : "This verification link is missing. Request a new one from the login page.");

  useEffect(() => {
    if (!token) return;
    if (sessionStorage.getItem(verifiedKey(token))) {
      setStatus("ok");
      return;
    }
    let cancelled = false;
    api("/api/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then(() => {
        sessionStorage.setItem(verifiedKey(token), "1");
        if (!cancelled) setStatus("ok");
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus("error");
        setError(err instanceof ApiError ? err.message : "This verification link is invalid or has expired. Request a new one.");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (status === "ok") {
    return (
      <AuthShell
        asideTitle={
          <>
            Email
            <br />
            <em className="not-italic text-accent">confirmed.</em>
          </>
        }
        asideBody="You can log in with this address now."
        cardEyebrow="Ready"
        title="Email confirmed"
        subtitle="You can log in with this address now."
        switchLabel="Need an account?"
        switchTo="/register"
        switchCta="Register"
      >
        <Link
          to="/login"
          className="inline-flex w-full items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Log in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      asideTitle={
        status === "working" ? (
          <>
            Confirming
            <br />
            <em className="not-italic text-accent">your email.</em>
          </>
        ) : (
          <>
            Could not
            <br />
            <em className="not-italic text-accent">confirm.</em>
          </>
        )
      }
      asideBody={
        status === "working"
          ? "Hang on while we verify this link."
          : "Request a new link from the login page, then try again."
      }
      cardEyebrow={status === "working" ? "Please wait" : "Try again"}
      title={status === "working" ? "Confirming email" : "Could not confirm"}
      subtitle={status === "working" ? "Hang on while we verify this link." : "Request a new link from the login page, then try again."}
      switchLabel="Back"
      switchTo="/login"
      switchCta="Log in"
    >
      {error && <p className="text-sm text-alert">{error}</p>}
      {status === "working" ? (
        <p className="text-sm text-muted">This usually takes a moment.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          <Link
            to="/check-email"
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Request a new link
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold hover:bg-secondary"
          >
            Back to log in
          </Link>
        </div>
      )}
      {status === "working" ? (
        <Button type="button" disabled className="mt-6 w-full">
          Confirming…
        </Button>
      ) : null}
    </AuthShell>
  );
}
