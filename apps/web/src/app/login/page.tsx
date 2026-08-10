"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api } from "@/lib/api";
import { ApiClientError } from "@/lib/errors";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: String(fd.get("email")),
          password: String(fd.get("password")),
        }),
      });
      router.push("/app");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FFFAF6] px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="font-grotesk text-2xl font-bold tracking-[-0.04em] lowercase">
          TRACE
        </Link>
        <h1 className="mt-8 text-xl font-bold text-foreground">Welcome back</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to continue monitoring the web.</p>
        <form onSubmit={onSubmit} className="mt-8 space-y-3">
          <label className="block text-xs font-medium text-muted-foreground">
            Email
            <input
              name="email"
              type="email"
              required
              className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-orange"
            />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Password
            <input
              name="password"
              type="password"
              required
              minLength={8}
              className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-orange"
            />
          </label>
          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl orange-gradient px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-6 text-sm text-muted-foreground">
          No account?{" "}
          <Link href="/signup" className="text-foreground underline-offset-2 hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
