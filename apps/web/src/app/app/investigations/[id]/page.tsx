"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

type Investigation = {
  investigation: {
    id: string;
    question: string;
    status: string;
    confidence: number | null;
    answer: {
      answer: string;
      confidence: number;
      claims: Array<{ text: string; evidenceIds: string[] }>;
    } | null;
    evidence: Array<{ id: string; label: string; excerpt: string; changeId: string | null; snapshotId: string | null }>;
  };
};

export default function InvestigationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ["investigation", id],
    queryFn: () => api<Investigation>(`/api/investigations/${id}`),
    refetchInterval: (q) => (q.state.data?.investigation.status === "completed" ? false : 2000),
  });

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading investigation…</p>;
  const inv = data.investigation;
  const evidenceByPipelineId = new Map<string, (typeof inv.evidence)[number]>();
  for (const e of inv.evidence) {
    if (e.changeId) evidenceByPipelineId.set(`chg_${e.changeId}`, e);
    if (e.snapshotId) evidenceByPipelineId.set(`snap_${e.snapshotId}`, e);
    evidenceByPipelineId.set(e.id, e);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="trace-eyebrow text-muted-foreground">Investigation</p>
        <h1 className="mt-3 font-grotesk text-3xl font-bold tracking-[-0.04em]">{inv.question}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Status: {inv.status}
          {inv.confidence != null ? ` · Confidence ${Math.round(inv.confidence * 100)}%` : ""}
        </p>
      </div>

      {inv.status !== "completed" && (
        <div className="surface-card p-5 text-sm text-muted-foreground">
          Retrieving evidence and reasoning… This page updates automatically.
        </div>
      )}

      {inv.answer && (
        <section className="surface-card space-y-4 p-5">
          <h2 className="font-grotesk text-lg font-semibold">Conclusion</h2>
          <p className="text-sm leading-relaxed">{inv.answer.answer}</p>
          <ul className="space-y-3">
            {inv.answer.claims.map((claim, idx) => (
              <li key={idx} className="rounded-xl bg-muted/40 p-3 text-sm">
                <p>{claim.text}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {claim.evidenceIds.map((eid) => {
                    const ev = evidenceByPipelineId.get(eid);
                    const href = ev?.changeId
                      ? `/app/changes/${ev.changeId}`
                      : ev?.snapshotId
                        ? `#evidence-${ev.id}`
                        : `#evidence-${eid}`;
                    return (
                      <Link
                        key={eid}
                        href={href}
                        className="rounded-full border border-orange/30 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground"
                      >
                        Evidence
                      </Link>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-grotesk text-lg font-semibold">Evidence set ({inv.evidence.length})</h2>
        {inv.evidence.map((e, i) => (
          <article key={e.id} id={`evidence-${e.id}`} className="surface-card p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Evidence #{i + 1}</p>
            <p className="mt-2 text-sm font-medium">{e.label}</p>
            <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-muted-foreground">{e.excerpt}</pre>
            {e.changeId && (
              <Link href={`/app/changes/${e.changeId}`} className="mt-3 inline-block text-xs underline">
                Open change
              </Link>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
