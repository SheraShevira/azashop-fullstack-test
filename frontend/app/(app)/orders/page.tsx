"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { api, download } from "@/lib/api";
import { formatDateTime, formatRupiah } from "@/lib/format";
import {
  Alert, Button, Card, EmptyState, ErrorState, Field, LoadingState, PageHeader, Pagination, TableWrap, td, th,
} from "@/components/ui";
import type { Customer, Order } from "@/lib/types";

export default function OrdersPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const rangeInvalid = Boolean(from && to && to < from);
  const filters = { from, to: rangeInvalid ? "" : to, customer_id: customerId };

  const customers = useQuery({
    queryKey: ["customers", "options"],
    queryFn: async () => (await api<Customer[]>("/customers", { query: { per_page: 100 } })).data,
  });

  const query = useQuery({
    queryKey: ["orders", filters, page],
    queryFn: () => api<Order[]>("/orders", { query: { ...filters, page, per_page: 10 } }),
    placeholderData: keepPreviousData,
  });

  const reset = (apply: () => void) => {
    apply();
    setPage(1);
  };

  async function exportCsv() {
    setExporting(true);
    setExportError(null);
    try {
      await download("/orders/export", filters, "orders.csv");
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Gagal mengunduh file");
    } finally {
      setExporting(false);
    }
  }

  const orders = query.data?.data ?? [];
  const hasFilter = Boolean(from || to || customerId);

  return (
    <>
      <PageHeader
        title="Riwayat Order"
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv} loading={exporting}>
              Ekspor CSV
            </Button>
            <Link href="/orders/new" className="inline-flex min-h-10 items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              Buat Order
            </Link>
          </>
        }
      />

      {exportError && (
        <div className="mb-4">
          <Alert>{exportError}</Alert>
        </div>
      )}

      <Card>
        <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Dari tanggal">
            {(props) => <input {...props} type="date" value={from} max={to || undefined} onChange={(e) => reset(() => setFrom(e.target.value))} />}
          </Field>
          <Field label="Sampai tanggal" error={rangeInvalid ? "Tidak boleh sebelum tanggal awal" : undefined}>
            {(props) => <input {...props} type="date" value={to} min={from || undefined} onChange={(e) => reset(() => setTo(e.target.value))} />}
          </Field>
          <Field label="Pelanggan">
            {(props) => (
              <select {...props} value={customerId} onChange={(e) => reset(() => setCustomerId(e.target.value))}>
                <option value="">Semua pelanggan</option>
                {customers.data?.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.customer_name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          {hasFilter && (
            <div className="flex items-end">
              <Button variant="ghost" onClick={() => reset(() => { setFrom(""); setTo(""); setCustomerId(""); })}>
                Reset filter
              </Button>
            </div>
          )}
        </div>

        {query.isPending ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
        ) : orders.length === 0 ? (
          <EmptyState title={hasFilter ? "Tidak ada order pada filter ini" : "Belum ada order"} description={hasFilter ? "Ubah atau reset filter." : "Order yang dibuat akan muncul di sini."} />
        ) : (
          <>
            <TableWrap>
              <table className={`w-full ${query.isPlaceholderData ? "opacity-60" : ""}`}>
                <thead className="bg-slate-50">
                  <tr>
                    <th className={th}>No. Order</th>
                    <th className={th}>Tanggal</th>
                    <th className={th}>Pelanggan</th>
                    <th className={`${th} text-right`}>Item</th>
                    <th className={`${th} text-right`}>Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50">
                      <td className={`${td} whitespace-nowrap font-mono`}>
                        <Link href={`/orders/${order.id}`} className="font-medium text-indigo-600 hover:underline">
                          {order.order_number}
                        </Link>
                      </td>
                      <td className={`${td} whitespace-nowrap`}>{formatDateTime(order.order_date)}</td>
                      <td className={td}>{order.customer?.customer_name}</td>
                      <td className={`${td} text-right`}>{order.items_count}</td>
                      <td className={`${td} whitespace-nowrap text-right font-medium`}>{formatRupiah(order.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            {query.data?.meta && <Pagination meta={query.data.meta} onPage={setPage} />}
          </>
        )}
      </Card>
    </>
  );
}
