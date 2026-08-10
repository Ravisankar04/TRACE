"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ApiClientError } from "@/lib/errors";

type ProjectDetail = {
  project: {
    id: string;
    name: string;
    rootUrl: string;
    status: string;
    lastScanAt: string | null;
    pagesMonitored: number;
    totalSnapshots: number;
    changesDetected: number;
    recentChanges: Array<{
      id: string;
      type: string;
      summary: string;
      confidence: number;
      createdAt: string;
      page: { url: string };
    }>;
    mostChangedPages: Array<{ id: string; url: string; title: string | null; changes: number }>;
    changeCategories: Array<{ type: string; count: number }>;
  };
};

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const qc = useQueryClient();
  const [live, setLive] = useState<string[]>([]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["project", id],
    queryFn: () => api<ProjectDetail>(`/api/projects/${id}`),
    refetchInterval: 5000,
  });

  const scan = useMutation({
    mutationFn: () => api(`/api/projects/${id}/scan`, { method: "POST" }),
    onSuccess: () => {
      setLive((l) => ["● LIVE — scan queued", ...l].slice(0, 40));
      qc.invalidateQueries({ queryKey: ["project", id] });
    },
  });

  const pause = useMutation({
    mutationFn: (status: "active" | "paused") =>
      api(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", id] }),
  });

  useEffect(() => {
    const es = new EventSource(`/api/events/stream?projectId=${id}`);
    // Note: native EventSource doesn't send cookies cross-origin in all browsers;
    // same-site proxy is preferred in production. For local, we also poll.

    const handler = (eventName: string) => (ev: MessageEvent) => {
      try {
        const payload = JSON.parse(ev.data);
        const line =
          eventName === "page.scanned"
            ? `→ page scanned ${payload.url || ""} (${payload.pagesScanned ?? "?"} scanned)`
            : eventName === "page.discovered"
              ? `→ discovered ${payload.url || ""}`
              : eventName === "change.detected"
                ? `→ change detected: ${payload.summary || payload.type}`
                : eventName === "scan.completed"
                  ? `→ scan completed — ${payload.changesDetected ?? 0} changes`
                  : `→ ${eventName}`;
        setLive((l) => [line, ...l].slice(0, 40));
        qc.invalidateQueries({ queryKey: ["project", id] });
      } catch {
        // ignore
      }
    };

    [
      "scan.started",
      "page.discovered",
      "page.scanned",
      "change.detected",
      "scan.completed",
      "scan.failed",
    ].forEach((name) => es.addEventListener(name, handler(name) as EventListener));

    return () => es.close();
  }, [id, qc]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading project…</p>;
  if (error || !data) {
    return (
      <div className="surface-card p-5 text-sm text-red-700">
        {error instanceof ApiClientError ? error.message : "Project not found."}
      </div>
    );
  }

  const p = data.project;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="trace-eyebrow text-muted-foreground">Project</p>
          <h1 className="mt-3 font-grotesk text-3xl font-bold tracking-[-0.04em]">{p.name}</h1>
          <p className="mt-2 font-mono text-xs text-muted-foreground">{p.rootUrl}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Monitoring status: <span className="font-medium text-foreground">{p.status}</span>
            {p.lastScanAt ? ` · Last scan ${new Date(p.lastScanAt).toLocaleString()}` : " · Never scanned"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => scan.mutate()}
            disabled={scan.isPending || p.status === "paused"}
            className="rounded-xl orange-gradient px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {scan.isPending ? "Queuing…" : "Scan now"}
          </button>
          <button
            type="button"
            onClick={() => pause.mutate(p.status === "paused" ? "active" : "paused")}
            className="rounded-xl border border-border bg-white px-4 py-2 text-sm"
          >
            {p.status === "paused" ? "Resume" : "Pause"}
          </button>
          <Link href={`/app/projects/${id}/timeline`} className="rounded-xl border border-border bg-white px-4 py-2 text-sm">
            Timeline
          </Link>
          <Link href={`/app/graph?projectId=${id}`} className="rounded-xl border border-border bg-white px-4 py-2 text-sm">
            Graph
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Pages monitored", p.pagesMonitored],
          ["Total snapshots", p.totalSnapshots],
          ["Changes detected", p.changesDetected],
          ["Categories", p.changeCategories.length],
        ].map(([label, value]) => (
          <div key={String(label)} className="surface-card p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
            <p className="mt-2 font-grotesk text-3xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="surface-card p-5">
          <h2 className="font-grotesk text-lg font-semibold">Recent changes</h2>
          {p.recentChanges.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No changes yet. Run a scan twice against a changing site (or the demo site versions) to detect diffs.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {p.recentChanges.map((c) => (
                <li key={c.id}>
                  <Link href={`/app/changes/${c.id}`} className="block rounded-xl p-2.5 transition hover:bg-orange-light/40">
                    <p className="text-sm font-medium">{c.summary}</p>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                      {c.type} · {Math.round(c.confidence * 100)}% · {c.page.url}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="surface-card p-5">
          <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
            <span className="trace-hue-cycle inline-block h-1.5 w-1.5 rounded-full bg-orange" />
            Scan activity
          </div>
          <div className="max-h-72 space-y-2 overflow-auto font-mono text-xs text-muted-foreground">
            {live.length === 0 ? <p>Waiting for live events…</p> : live.map((line, i) => <p key={`${line}-${i}`}>{line}</p>)}
          </div>
        </section>
      </div>

      <section className="surface-card p-5">
        <h2 className="font-grotesk text-lg font-semibold">Most changed pages</h2>
        <ul className="mt-4 divide-y divide-border/60">
          {p.mostChangedPages.map((page) => (
            <li key={page.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <span className="truncate font-mono text-xs">{page.url}</span>
              <span className="rounded-full bg-orange px-2 py-0.5 text-[10px] font-bold text-white">{page.changes}</span>
            </li>
          ))}
          {p.mostChangedPages.length === 0 && (
            <li className="py-6 text-sm text-muted-foreground">No pages indexed yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
