"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function WebhooksPage() {
  const qc = useQueryClient();
  const [secret, setSecret] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ["webhooks"],
    queryFn: () =>
      api<{ items: Array<{ id: string; url: string; events: string[]; active: boolean; deliveries: number }> }>(
        "/api/webhooks",
      ),
  });

  const create = useMutation({
    mutationFn: (body: { url: string; events: string[] }) =>
      api<{ webhook: { id: string; secret: string } }>("/api/webhooks", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (res) => {
      setSecret(res.webhook.secret);
      qc.invalidateQueries({ queryKey: ["webhooks"] });
    },
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    create.mutate({
      url: String(fd.get("url")),
      events: String(fd.get("events"))
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="trace-eyebrow text-muted-foreground">Webhooks</p>
        <h1 className="mt-3 font-grotesk text-3xl font-bold tracking-[-0.04em]">Outbound events</h1>
      </div>
      <form onSubmit={onSubmit} className="surface-card space-y-3 p-5">
        <input
          name="url"
          required
          type="url"
          placeholder="https://example.com/hooks/trace"
          className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-orange"
        />
        <input
          name="events"
          defaultValue="project.scan.completed,page.changed,pricing.changed"
          className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-orange"
        />
        <button type="submit" className="rounded-xl orange-gradient px-5 py-2.5 text-sm font-semibold text-white">
          Register webhook
        </button>
        {secret && (
          <p className="rounded-xl bg-[#FFFAF6] p-3 font-mono text-xs">
            Secret (shown once): {secret}
          </p>
        )}
      </form>
      <ul className="space-y-3">
        {list.data?.items.map((w) => (
          <li key={w.id} className="surface-card flex items-center justify-between gap-3 p-4 text-sm">
            <div>
              <p className="font-mono text-xs">{w.url}</p>
              <p className="mt-1 text-muted-foreground">{w.events.join(", ")}</p>
            </div>
            <span className="text-xs">{w.deliveries} deliveries</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
