"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatDayMonth, formatRupiah } from "@/lib/format";
import { Alert, Card, EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui";
import type { DashboardSummary } from "@/lib/types";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </Card>
  );
}

/** Dependency-free bar chart; the <title> on each bar gives a native tooltip. */
function SalesChart({ days }: { days: DashboardSummary["daily_sales"] }) {
  const max = Math.max(...days.map((d) => Number(d.sales)), 1);
  const width = 600;
  const height = 160;
  const slot = width / days.length;

  if (days.every((d) => Number(d.sales) === 0)) {
    return <EmptyState title="Belum ada penjualan dalam 30 hari terakhir" />;
  }

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height + 20}`} className="w-full" role="img" aria-label="Grafik penjualan harian 30 hari terakhir">
        {days.map((day, index) => {
          const barHeight = (Number(day.sales) / max) * height;
          return (
            <g key={day.date}>
              <rect x={index * slot + 2} y={height - barHeight} width={slot - 4} height={barHeight} rx={2} className="fill-indigo-500 hover:fill-indigo-700">
                <title>{`${formatDayMonth(day.date)}: ${formatRupiah(day.sales)} (${day.orders} order)`}</title>
              </rect>
              {index % 5 === 0 && (
                <text x={index * slot + slot / 2} y={height + 14} textAnchor="middle" className="fill-slate-500 text-[10px]">
                  {formatDayMonth(day.date)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-xs text-slate-500">Penjualan harian, puncak {formatRupiah(max)}</p>
    </div>
  );
}

export default function DashboardPage() {
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api<DashboardSummary>("/dashboard/summary")).data,
  });

  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;

  const data = query.data;

  return (
    <>
      <PageHeader title="Dashboard" />

      {data.low_stock_products.length > 0 && (
        <div className="mb-6">
          <Alert tone="warning">
            <p className="font-medium">Stok menipis (kurang dari {data.low_stock_threshold})</p>
            <ul className="mt-1 list-inside list-disc">
              {data.low_stock_products.map((product) => (
                <li key={product.id}>
                  {product.product_name} ({product.product_code}): sisa <strong>{product.stock}</strong>
                </li>
              ))}
            </ul>
          </Alert>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Total Transaksi" value={data.total_orders.toLocaleString("id-ID")} />
        <StatCard label="Total Penjualan" value={formatRupiah(data.total_sales)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 font-semibold text-slate-900">Produk Terlaris</h2>
          {data.top_products.length === 0 ? (
            <EmptyState title="Belum ada transaksi" description="Produk terlaris muncul setelah ada order." />
          ) : (
            <ol className="divide-y divide-slate-100">
              {data.top_products.map((product, index) => (
                <li key={product.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="mr-2 text-slate-400">{index + 1}.</span>
                    {product.product_name}
                  </span>
                  <span className="shrink-0 text-slate-600">{product.total_quantity} terjual</span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 font-semibold text-slate-900">Penjualan 30 Hari Terakhir</h2>
          <SalesChart days={data.daily_sales} />
        </Card>
      </div>

      <p className="mt-6 text-sm text-slate-500">
        <Link href="/orders/new" className="font-medium text-indigo-600 hover:underline">
          Buat order baru
        </Link>
      </p>
    </>
  );
}
