import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Utensils } from "lucide-react";
import { ButtonLink, CardList, EmptyState, FilterPills, PageHeader, PageLoading, SectionToolbar } from "../../components/PageChrome";
import { MetricStrip } from "../../components/StatCard";
import { StatusBadge } from "../../components/StatusBadge";
import { api } from "../../services/api";
import type { Claim } from "../../types";
import { formatDateTime } from "../../utils/format";

type Filter = "all" | "upcoming" | "picked";

export function RecipientClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    api<{ claims: Claim[] }>("/api/claims")
      .then((d) => setClaims(d.claims))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const picked = claims.filter((c) => c.status === "PICKED_UP");
  const mealsCollected = picked.reduce((sum, c) => sum + c.quantity, 0);
  const success = claims.length === 0 ? 0 : Math.round((picked.length / claims.length) * 100);

  const visible = useMemo(() => {
    if (filter === "upcoming") return claims.filter((c) => c.status === "CLAIMED" || c.status === "PICKUP_PENDING");
    if (filter === "picked") return picked;
    return claims;
  }, [claims, filter, picked]);

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Collections"
        title={
          <>
            My <em className="text-accent not-italic">claims</em>
          </>
        }
        subtitle="Pickup codes, reserved meals, and completed collections."
        actions={
          <ButtonLink to="/recipient/dashboard">
            Find nearby food <span aria-hidden>→</span>
          </ButtonLink>
        }
      />
      {error && <p className="text-alert">{error}</p>}
      <MetricStrip
        items={[
          { label: "Total claims", value: claims.length },
          { label: "Meals collected", value: mealsCollected },
          { label: "Pickup success", value: `${success}%` },
        ]}
      />
      <SectionToolbar label="Showing your recent collections">
        <FilterPills
          value={filter}
          onChange={setFilter}
          options={[
            { id: "all", label: "All claims" },
            { id: "upcoming", label: "Upcoming" },
            { id: "picked", label: "Picked up" },
          ]}
        />
      </SectionToolbar>
      <CardList>
        {visible.map((c) => {
          const open = c.status === "CLAIMED" || c.status === "PICKUP_PENDING";
          return (
            <article key={c.id} className="flex items-center gap-3.5 py-3.5">
              <div
                className={`grid size-[37px] shrink-0 place-items-center rounded-lg ${
                  open ? "bg-rescued/20 text-rescued" : "bg-secondary text-foreground"
                }`}
              >
                <Utensils size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-[13px] font-semibold tracking-tight">{c.donation?.foodName ?? "Donation"}</h3>
                  <StatusBadge status={c.status} />
                </div>
                <p className="mt-1.5 text-[10px] text-muted">
                  {c.quantity} meals · {formatDateTime(c.claimedAt)}
                  {c.claimCode ? ` · Pickup code ${c.claimCode}` : ""}
                </p>
              </div>
              <div className="hidden min-w-[75px] gap-0.5 sm:grid">
                <strong className="text-[13px]">{c.quantity}</strong>
                <span className="text-[9px] text-muted">meals reserved</span>
              </div>
              <Link
                to={`/claims/${c.id}`}
                aria-label="View claim"
                className="grid size-[30px] shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
              >
                <ArrowRight size={16} />
              </Link>
            </article>
          );
        })}
      </CardList>
      {claims.length === 0 && !error && (
        <EmptyState
          title="No claims yet"
          body="When you reserve nearby meals, they will show up here with a pickup code."
          action={<ButtonLink to="/recipient/dashboard">Find nearby food</ButtonLink>}
        />
      )}
      {claims.length > 0 && visible.length === 0 && (
        <EmptyState title="Nothing in this filter" body="Try All claims to see your full collection history." />
      )}
    </div>
  );
}
