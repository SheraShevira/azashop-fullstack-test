"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, tokenStore } from "@/lib/api";
import { Button, ErrorState, LoadingState } from "@/components/ui";
import type { User } from "@/lib/types";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/products", label: "Produk" },
  { href: "/customers", label: "Pelanggan" },
  { href: "/orders/new", label: "Buat Order" },
  { href: "/orders", label: "Riwayat Order" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/orders") return pathname === "/orders" || /^\/orders\/\d+/.test(pathname);
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Route guard + shell. No token => /login; an expired token is caught by the API client's 401 handling. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [hasToken, setHasToken] = useState<boolean | null>(null);

  useEffect(() => {
    const token = tokenStore.get();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
    setHasToken(Boolean(token));
    if (!token) router.replace("/login");
  }, [router]);

  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api<User>("/auth/me")).data,
    enabled: hasToken === true,
  });

  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      /* the token is dropped locally either way */
    }
    tokenStore.clear();
    queryClient.clear();
    router.replace("/login");
  }

  if (!hasToken || me.isPending) return <LoadingState />;
  if (me.isError) return <ErrorState message={me.error.message} onRetry={() => me.refetch()} />;

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <span className="font-semibold text-indigo-700">AZA Shop</span>
        <Button variant="secondary" aria-expanded={open} aria-controls="sidebar" onClick={() => setOpen((v) => !v)}>
          Menu
        </Button>
      </header>

      <aside
        id="sidebar"
        className={`${open ? "block" : "hidden"} border-b border-slate-200 bg-white md:flex md:min-h-screen md:w-60 md:shrink-0 md:flex-col md:border-r md:border-b-0`}
      >
        <div className="hidden px-6 py-5 text-lg font-semibold text-indigo-700 md:block">AZA Shop</div>
        <nav className="flex flex-col gap-1 px-3 py-2 md:flex-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                isActive(pathname, item.href) ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-200 px-4 py-4">
          <p className="truncate text-sm font-medium text-slate-800">{me.data?.name}</p>
          <p className="mb-3 truncate text-xs text-slate-500">{me.data?.email}</p>
          <Button variant="secondary" className="w-full" onClick={logout}>
            Keluar
          </Button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
