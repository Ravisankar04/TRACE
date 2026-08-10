"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function ApiKeysPage() {
  const qc = useQueryClient();
  const [raw, setRaw] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ["api-keys"],
    queryFn: () =>
      api<{
        items: Array<{ id: string; name: string; masked: string; lastUsedAt: string | null; revokedAt: string | null }>;
      }>("/api/api-keys"),
  });

  const create = useMutation({
    mutationFn: (name: string) =>
      api<{ apiKey: { raw: string } }>("/api/api-keys", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: (res) => {
      setRaw(res.apiKey.raw);
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api(`/api/api-keys/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    create.mutate(String(fd.get("name")));
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="trace-eyebrow text-muted-foreground">API Keys</p>
        <h1 className="mt-3 font-grotesk text-3xl font-bold tracking-[-0.04em]">Programmatic access</h1>
        <p className="mt-2 text-sm text-muted-foreground">Raw keys are shown once. TRACE stores only hashes.</p>
      </div>
      <form onSubmit={onSubmit} className="surface-card flex gap-2 p-5">
        <input
          name="name"
          required
          placeholder="CI key"
          className="flex-1 rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-orange"
        />
        <button type="submit" className="rounded-xl orange-gradient px-5 py-2.5 text-sm font-semibold text-white">
          Generate
        </button>
      </form>
      {raw && (
        <p className="rounded-xl border border-orange/30 bg-white p-4 font-mono text-xs break-all">
          {raw}
        </p>
      )}
      <ul className="space-y-3">
        {list.data?.items.map((k) => (
          <li key={k.id} className="surface-card flex items-center justify-between gap-3 p-4 text-sm">
            <div>
              <p className="font-medium">{k.name}</p>
              <p className="font-mono text-xs text-muted-foreground">{k.masked}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Last used: {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "never"}
                {k.revokedAt ? " · revoked" : ""}
              </p>
            </div>
            {!k.revokedAt && (
              <button
                type="button"
                onClick={() => revoke.mutate(k.id)}
                className="rounded-xl border border-border px-3 py-1.5 text-xs"
              >
                Revoke
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
