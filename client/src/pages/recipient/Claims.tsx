import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ButtonLink, EmptyState, FilterPills, IconTile, PageHeader, PageLoading, SectionToolbar } from "../../components/PageChrome";
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

  const featuredId = visible.find((c) => c.status === "CLAIMED" || c.status === "PICKUP_PENDING")?.id ?? visible[0]?.id;

  if (loading) return <PageLoading label="Loading claims…" />;

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
      <div className="grid gap-2.5">
        {visible.map((c) => {
          const featured = c.id === featuredId;
          return (
            <article
              key={c.id}
              className={`grid items-center gap-4 rounded-[18px] border bg-card px-6 py-5 sm:grid-cols-[auto_1fr_auto] ${
                featured ? "border-accent/55 shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent)_15%,transparent)]" : "border-border"
              }`}
            >
              <IconTile accent={featured} className="size-11 rounded-[14px] text-lg">
                ⌁
              </IconTile>
              <div>
                <h2 className="display text-xl font-semibold">{c.donation?.foodName ?? "Donation"}</h2>
                <p className="mt-1 text-xs text-muted">
                  {c.quantity} meals · {formatDateTime(c.claimedAt)}
                </p>
                {c.claimCode ? (
                  <span className="mt-2.5 inline-flex rounded-md bg-secondary px-2 py-1 text-[11px] font-extrabold tracking-[0.08em]">
                    PICKUP CODE {c.claimCode}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 sm:flex-col sm:items-end">
                <StatusBadge status={c.status} />
                <Link to={`/claims/${c.id}`} className="text-[11px] font-extrabold text-accent">
                  View details →
                </Link>
              </div>
            </article>
          );
        })}
      </div>
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
