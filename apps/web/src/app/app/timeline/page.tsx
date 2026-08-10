"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function TimelineHubPage() {
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => api<{ items: Array<{ id: string; name: string }> }>("/api/projects"),
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="trace-eyebrow text-muted-foreground">Timeline</p>
        <h1 className="mt-3 font-grotesk text-3xl font-bold tracking-[-0.04em]">Choose a project</h1>
      </div>
      <ul className="space-y-3">
        {projects.data?.items.map((p) => (
          <li key={p.id}>
            <Link href={`/app/projects/${p.id}/timeline`} className="surface-card block p-4">
              {p.name}
            </Link>
          </li>
        ))}
        {(projects.data?.items.length ?? 0) === 0 && (
          <li className="surface-card p-8 text-sm text-muted-foreground">No projects yet.</li>
        )}
      </ul>
    </div>
  );
}
