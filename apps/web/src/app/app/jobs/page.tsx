"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function JobsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: () =>
      api<{
        items: Array<{
          id: string;
          type: string;
          status: string;
          attempts: number;
          maxAttempts: number;
          reason: string | null;
          nextRetryAt: string | null;
          createdAt: string;
        }>;
      }>("/api/jobs"),
    refetchInterval: 3000,
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="trace-eyebrow text-muted-foreground">Jobs</p>
        <h1 className="mt-3 font-grotesk text-3xl font-bold tracking-[-0.04em]">Queue monitor</h1>
        <p className="mt-2 text-sm text-muted-foreground">Live BullMQ job records from your workspace.</p>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading jobs…</p>}
      <ul className="space-y-3">
        {data?.items.map((job) => (
          <li key={job.id} className="surface-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-sm font-medium">{job.type}</p>
              <span className="rounded-full bg-orange-light/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
                {job.status}
              </span>
            </div>
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">
              Attempt {job.attempts} / {job.maxAttempts}
              {job.reason ? ` · ${job.reason}` : ""}
              {job.nextRetryAt ? ` · next retry ${new Date(job.nextRetryAt).toLocaleTimeString()}` : ""}
            </p>
          </li>
        ))}
        {(data?.items.length ?? 0) === 0 && (
          <li className="surface-card p-8 text-sm text-muted-foreground">No jobs yet. Trigger a scan to enqueue work.</li>
        )}
      </ul>
    </div>
  );
}
