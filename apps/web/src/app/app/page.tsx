"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

type ProjectList = {
  items: Array<{
    id: string;
    name: string;
    rootUrl: string;
    status: string;
    pagesMonitored: number;
    totalSnapshots: number;
    changesDetected: number;
    lastScanAt: string | null;
  }>;
};

export default function OverviewPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api<ProjectList>("/api/projects"),
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="trace-eyebrow text-muted-foreground">Overview</p>
          <h1 className="mt-3 font-grotesk text-3xl font-bold tracking-[-0.04em]">Workspace</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Every number below comes from your database — projects you created, pages crawled, changes detected.
          </p>
        </div>
        <Link
          href="/app/projects/new"
          className="rounded-xl orange-gradient px-5 py-2.5 text-sm font-semibold text-white"
        >
          Create project
        </Link>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading projects…</p>}
      {error && (
        <div className="surface-card p-5 text-sm text-red-700">
          We couldn&apos;t load your projects. Confirm the API is running on port 4000.
        </div>
      )}

      {!isLoading && data?.items.length === 0 && (
        <div className="surface-card p-10 text-center">
          <p className="font-grotesk text-xl font-semibold">No projects yet.</p>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            The internet changes constantly. Start watching a website and TRACE will remember it for you.
          </p>
          <Link
            href="/app/projects/new"
            className="mt-6 inline-flex rounded-xl orange-gradient px-5 py-2.5 text-sm font-semibold text-white"
          >
            Start watching a website
          </Link>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data?.items.map((p) => (
          <Link key={p.id} href={`/app/projects/${p.id}`} className="surface-card block p-5 transition hover:border-orange/40">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-grotesk text-lg font-semibold">{p.name}</h2>
              <span className="rounded-full bg-orange-light/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-foreground">
                {p.status}
              </span>
            </div>
            <p className="mt-2 truncate font-mono text-xs text-muted-foreground">{p.rootUrl}</p>
            <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-muted/40 p-2">
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Pages</dt>
                <dd className="mt-1 font-grotesk text-lg font-semibold">{p.pagesMonitored}</dd>
              </div>
              <div className="rounded-xl bg-muted/40 p-2">
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Snaps</dt>
                <dd className="mt-1 font-grotesk text-lg font-semibold">{p.totalSnapshots}</dd>
              </div>
              <div className="rounded-xl bg-muted/40 p-2">
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Changes</dt>
                <dd className="mt-1 font-grotesk text-lg font-semibold">{p.changesDetected}</dd>
              </div>
            </dl>
          </Link>
        ))}
      </div>
    </div>
  );
}
