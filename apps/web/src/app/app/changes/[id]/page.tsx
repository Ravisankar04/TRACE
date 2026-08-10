"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

type ChangeDetail = {
  change: {
    id: string;
    type: string;
    severity: string;
    summary: string;
    confidence: number;
    createdAt: string;
    rawDiff: { lines?: Array<{ type: string; text: string }> } | null;
    semanticDiff: {
      previousExcerpt?: string;
      currentExcerpt?: string;
      sections?: Array<{ label: string; previous?: string; current?: string }>;
    } | null;
    page: { url: string };
    projectId: string;
  };
};

export default function ChangeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [question, setQuestion] = useState("Why did this change happen?");

  const { data, isLoading, error } = useQuery({
    queryKey: ["change", id],
    queryFn: () => api<ChangeDetail>(`/api/changes/${id}`),
  });

  const investigate = useMutation({
    mutationFn: () =>
      api<{ investigation: { id: string } }>("/api/investigations", {
        method: "POST",
        body: JSON.stringify({
          question,
          projectId: data?.change.projectId,
          changeId: id,
        }),
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["investigations"] });
      window.location.href = `/app/investigations/${res.investigation.id}`;
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading change…</p>;
  if (error || !data) return <p className="text-sm text-red-700">Change not found.</p>;

  const c = data.change;
  const lines = c.rawDiff?.lines || [];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="trace-eyebrow text-muted-foreground">Change detected</p>
        <h1 className="mt-3 font-grotesk text-3xl font-bold tracking-[-0.04em]">{c.summary}</h1>
        <p className="mt-2 font-mono text-xs text-muted-foreground">{c.page.url}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          Detected {new Date(c.createdAt).toLocaleString()} · {c.type} · {c.severity} · Confidence{" "}
          {Math.round(c.confidence * 100)}%
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="surface-card p-5">
          <h2 className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Before</h2>
          <pre className="mt-3 whitespace-pre-wrap font-mono text-xs text-muted-foreground">
            {c.semanticDiff?.previousExcerpt || "—"}
          </pre>
        </div>
        <div className="surface-card p-5">
          <h2 className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">After</h2>
          <pre className="mt-3 whitespace-pre-wrap font-mono text-xs text-muted-foreground">
            {c.semanticDiff?.currentExcerpt || "—"}
          </pre>
        </div>
      </section>

      <section className="surface-card p-5">
        <h2 className="font-grotesk text-lg font-semibold">Semantic analysis</h2>
        {c.semanticDiff?.sections?.length ? (
          <ul className="mt-4 space-y-3">
            {c.semanticDiff.sections.map((s) => (
              <li key={s.label} className="rounded-xl bg-muted/40 p-3 text-sm">
                <p className="font-medium">{s.label}</p>
                <p className="mt-1 text-muted-foreground">Previous: {s.previous || "—"}</p>
                <p className="text-muted-foreground">Current: {s.current || "—"}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{c.summary}</p>
        )}
      </section>

      <section className="surface-card p-5">
        <h2 className="font-grotesk text-lg font-semibold">Raw diff</h2>
        <div className="mt-4 max-h-80 overflow-auto rounded-xl bg-near-black p-4 font-mono text-xs text-white">
          {lines.length === 0 && <p className="text-white/50">No line-level diff stored.</p>}
          {lines.map((line, i) => (
            <div
              key={`${i}-${line.text.slice(0, 12)}`}
              className={
                line.type === "add" ? "text-emerald-300" : line.type === "remove" ? "text-red-300" : "text-white/50"
              }
            >
              {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "} {line.text}
            </div>
          ))}
        </div>
      </section>

      <section className="surface-card p-5">
        <h2 className="font-grotesk text-lg font-semibold">Investigate</h2>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            investigate.mutate();
          }}
        >
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="min-h-24 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-orange"
          />
          <button
            type="submit"
            disabled={investigate.isPending}
            className="rounded-xl orange-gradient px-5 py-2.5 text-sm font-semibold text-white"
          >
            {investigate.isPending ? "Starting…" : "Run investigation"}
          </button>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          Answers cite only retrieved evidence.{" "}
          <Link href="/app/investigations" className="underline">
            View all investigations
          </Link>
        </p>
      </section>
    </div>
  );
}
