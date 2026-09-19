import { useEffect, useState } from "react";
import { ButtonLink, EmptyState, PageHeader, PageLoading } from "../../components/PageChrome";
import { api } from "../../services/api";
import type { DonorPatterns } from "../../types";

function FactsTable({
  columns,
  rows,
}: {
  columns: { key: string; label: string }[];
  rows: Record<string, string | number>[];
}) {
  return (
    <div className="overflow-x-auto rounded-[18px] border border-border">
      <table className="w-full min-w-[320px] text-left text-[13px]">
        <thead className="bg-secondary text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-4 py-3 font-extrabold">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-border">
              {columns.map((column) => (
                <td key={column.key} className="px-4 py-3">
                  {row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DonorInsightsPage() {
  const [patterns, setPatterns] = useState<DonorPatterns | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<DonorPatterns>("/api/donor/patterns")
      .then(setPatterns)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <p className="text-alert">{error}</p>;
  if (!patterns) return <PageLoading />;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Donation history"
        title={
          <>
            What your surplus history <em className="not-italic text-accent">shows.</em>
          </>
        }
        subtitle="Numbers come from your recorded listings and pickups. The write-up is an observation, not a forecast."
        actions={<ButtonLink to="/donor/dashboard" variant="outline">Back to dashboard</ButtonLink>}
      />

      {!patterns.ready ? (
        <EmptyState
          title="Patterns need more history"
          body={`A write-up needs at least ${patterns.minDonations} donations. ${patterns.observed} recorded so far.`}
          action={<ButtonLink to="/donor/donate">Donate surplus →</ButtonLink>}
        />
      ) : (
        <>
          <article className="rounded-[22px] border border-border bg-card px-6 py-8 sm:px-9">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">
              {patterns.analysis?.source === "llm" ? "Analysis" : "Statistical summary"}
            </p>
            <h2 className="display mt-2 text-[clamp(1.8rem,4vw,2.8rem)] leading-[1.05]">
              {patterns.analysis?.title || patterns.insights[0]?.title}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              {patterns.analysis?.summary || patterns.insights[0]?.body}
            </p>
            <div className="mt-8 grid gap-6">
              {(patterns.analysis?.sections ?? []).map((section) => (
                <section key={section.heading}>
                  <h3 className="text-sm font-extrabold">{section.heading}</h3>
                  <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">{section.body}</p>
                </section>
              ))}
            </div>
          </article>

          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">By day</p>
              <FactsTable
                columns={[
                  { key: "day", label: "Day" },
                  { key: "count", label: "Listings" },
                  { key: "meals", label: "Meals" },
                  { key: "average", label: "Avg" },
                ]}
                rows={patterns.byDay}
              />
            </div>
            <div>
              <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">By time</p>
              <FactsTable
                columns={[
                  { key: "period", label: "Period" },
                  { key: "count", label: "Listings" },
                  { key: "meals", label: "Meals" },
                ]}
                rows={patterns.byTime}
              />
            </div>
            <div>
              <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">By category</p>
              <FactsTable
                columns={[
                  { key: "category", label: "Category" },
                  { key: "meals", label: "Meals" },
                  { key: "share", label: "Share %" },
                ]}
                rows={patterns.byCategory}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
