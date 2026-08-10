"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function SettingsPage() {
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ user: { email: string; name: string | null } }>("/api/auth/me"),
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="trace-eyebrow text-muted-foreground">Settings</p>
        <h1 className="mt-3 font-grotesk text-3xl font-bold tracking-[-0.04em]">Account</h1>
      </div>
      <div className="surface-card space-y-3 p-5 text-sm">
        <p>
          <span className="text-muted-foreground">Name:</span> {me.data?.user.name || "—"}
        </p>
        <p>
          <span className="text-muted-foreground">Email:</span> {me.data?.user.email}
        </p>
        <p className="text-muted-foreground">
          OAuth providers are architected in the API (`/api/auth/oauth/:provider`) but currently unavailable — email
          sessions are the supported path.
        </p>
      </div>
    </div>
  );
}
