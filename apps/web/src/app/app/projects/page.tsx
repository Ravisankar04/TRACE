"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function ProjectsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () =>
      api<{
        items: Array<{
          id: string;
          name: string;
          rootUrl: string;
          status: string;
          changesDetected: number;
        }>;
      }>("/api/projects"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="trace-eyebrow text-muted-foreground">Projects</p>
          <h1 className="mt-3 font-grotesk text-3xl font-bold tracking-[-0.04em]">All projects</h1>
        </div>
        <Link href="/app/projects/new" className="rounded-xl orange-gradient px-4 py-2 text-sm font-semibold text-white">
          Create
        </Link>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <ul className="space-y-3">
        {data?.items.map((p) => (
          <li key={p.id}>
            <Link href={`/app/projects/${p.id}`} className="surface-card flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{p.rootUrl}</p>
              </div>
              <span className="text-xs text-muted-foreground">{p.changesDetected} changes</span>
            </Link>
          </li>
        ))}
        {!isLoading && data?.items.length === 0 && (
          <li className="surface-card p-8 text-center text-sm text-muted-foreground">No projects yet.</li>
        )}
      </ul>
    </div>
  );
}
