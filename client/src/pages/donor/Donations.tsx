import { useEffect, useState } from "react";
import { DonationCard } from "../../components/DonationCard";
import { api } from "../../services/api";
import type { Donation } from "../../types";

export function DonorDonationsPage() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ donations: Donation[] }>("/api/donations")
      .then((d) => setDonations(d.donations))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h1 className="display text-4xl font-semibold tracking-tight">Donation history</h1>
      <p className="mt-2 text-muted">Active listings, pickups, and expired leftovers.</p>
      {error && <p className="mt-4 text-alert">{error}</p>}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {donations.map((d) => (
          <DonationCard key={d.id} donation={d} actionLabel="View details" />
        ))}
      </div>
      {donations.length === 0 && !error && (
        <p className="mt-6 rounded-[1.5rem] bg-secondary p-8 text-center text-sm text-muted">No donations yet.</p>
      )}
    </div>
  );
}
