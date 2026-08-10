"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  GitBranch,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Network,
  Plus,
  Search,
  Settings,
  Sparkles,
  Webhook,
  FolderKanban,
  Clock3,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

const nav = [
  { href: "/app", label: "Overview", icon: LayoutDashboard },
  { href: "/app/projects", label: "All projects", icon: FolderKanban },
  { href: "/app/projects/new", label: "Create project", icon: Plus },
  { href: "/app/timeline", label: "Timeline", icon: Clock3 },
  { href: "/app/changes", label: "Changes", icon: GitBranch },
  { href: "/app/investigations", label: "Investigations", icon: Sparkles },
  { href: "/app/graph", label: "Knowledge Graph", icon: Network },
  { href: "/app/search", label: "Search", icon: Search },
  { href: "/app/webhooks", label: "Webhooks", icon: Webhook },
  { href: "/app/api-keys", label: "API Keys", icon: KeyRound },
  { href: "/app/jobs", label: "Jobs", icon: Activity },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <aside className="flex h-full w-[240px] shrink-0 flex-col border-r border-border/60 bg-white/70 backdrop-blur-sm">
      <div className="px-5 py-6">
        <Link href="/app" className="font-grotesk text-xl font-bold tracking-[-0.04em] lowercase">
          TRACE
        </Link>
        <p className="mt-1 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">intelligence</p>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4" aria-label="Main">
        {nav.map((item) => {
          const active = pathname === item.href || (item.href !== "/app" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150",
                active
                  ? "bg-orange-light/60 text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border/60 p-3">
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </div>
    </aside>
  );
}
