import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button, inputClass } from "../../components/Form";
import { PageLoading } from "../../components/PageChrome";
import { api, ApiError } from "../../services/api";
import type { Claim, Donation, User } from "../../types";
import { AdminField, AdminFormCard, AdminHeader } from "./AdminChrome";

export function ClaimFormPage() {
  const navigate = useNavigate();
  const [donations, setDonations] = useState<Donation[] | null>(null);
  const [collectors, setCollectors] = useState<User[] | null>(null);
  const [donationId, setDonationId] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    Promise.all([
      api<{ donations: Donation[] }>("/api/admin/donations"),
      api<{ users: User[] }>("/api/admin/users?role=RECIPIENT"),
    ])
      .then(([d, u]) => {
        const open = d.donations.filter((item) => ["ACTIVE", "PARTIALLY_CLAIMED"].includes(item.status) && item.availableQuantity > 0);
        setDonations(open);
        setCollectors(u.users);
        if (open[0]) {
          setDonationId(open[0].id);
          setQuantity(String(Math.min(1, open[0].availableQuantity)));
        }
        if (u.users[0]) setRecipientId(u.users[0].id);
      })
      .catch((e) => setError(e.message));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const data = await api<{ claim: Claim }>("/api/admin/claims", {
        method: "POST",
        body: JSON.stringify({ donationId, recipientId, quantity: Number(quantity) }),
      });
      navigate(`/admin/claims/${data.claim.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create claim.");
    } finally {
      setPending(false);
    }
  }

  if ((!donations || !collectors) && !error) return <PageLoading label="Loading claim form…" />;

  return (
    <div className="space-y-8">
      <AdminHeader
        eyebrow="Claims"
        title="New claim"
        subtitle="Reserve meals for a collector and keep the handoff accountable."
      />
      <AdminFormCard title="Claim details" description="The collector must be within the listing rescue radius.">
        <form onSubmit={onSubmit} className="grid gap-x-3.5 gap-y-4 sm:grid-cols-2">
          {error && <p className="text-sm text-alert sm:col-span-2">{error}</p>}
          <AdminField label="Listing">
            <select className={inputClass} value={donationId} onChange={(e) => setDonationId(e.target.value)}>
              {(donations ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.foodName} · {d.availableQuantity} left
                </option>
              ))}
            </select>
          </AdminField>
          <AdminField label="Collector">
            <select className={inputClass} value={recipientId} onChange={(e) => setRecipientId(e.target.value)}>
              {(collectors ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.organizationName || u.name}
                </option>
              ))}
            </select>
          </AdminField>
          <AdminField label="Quantity">
            <input className={inputClass} type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </AdminField>
          <Button type="submit" disabled={pending || !donationId || !recipientId} className="sm:col-span-2">
            {pending ? "Creating…" : "Save changes"} <span aria-hidden>→</span>
          </Button>
        </form>
      </AdminFormCard>
    </div>
  );
}
