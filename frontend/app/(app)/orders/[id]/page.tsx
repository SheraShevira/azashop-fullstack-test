"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { formatDateTime, formatRupiah } from "@/lib/format";
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, TableWrap, td, th } from "@/components/ui";
import type { Order } from "@/lib/types";

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();

  const query = useQuery({
    queryKey: ["orders", "detail", id],
    queryFn: async () => (await api<Order>(`/orders/${id}`)).data,
    retry: false,
  });

  if (query.isPending) return <LoadingState />;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) {
      return <EmptyState title="Order tidak ditemukan" description="Order mungkin sudah tidak tersedia." />;
    }
    return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  }

  const order = query.data;

  return (
    <>
      <PageHeader
        title={order.order_number}
        actions={
          <Link href="/orders" className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Kembali
          </Link>
        }
      />

      <Card className="mb-6 grid gap-4 p-5 sm:grid-cols-3">
        <div>
          <p className="text-sm text-slate-500">Tanggal</p>
          <p className="font-medium">{formatDateTime(order.order_date)}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Pelanggan</p>
          <p className="font-medium">{order.customer?.customer_name}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Dibuat oleh</p>
          <p className="font-medium">{order.created_by?.name}</p>
        </div>
      </Card>

      <Card>
        <TableWrap>
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>Produk</th>
                <th className={`${th} text-right`}>Harga Satuan</th>
                <th className={`${th} text-right`}>Jumlah</th>
                <th className={`${th} text-right`}>Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {order.items?.map((item) => (
                <tr key={item.id}>
                  <td className={td}>
                    {item.product_name}
                    <span className="ml-2 font-mono text-xs text-slate-400">{item.product_code}</span>
                  </td>
                  <td className={`${td} whitespace-nowrap text-right`}>{formatRupiah(item.unit_price)}</td>
                  <td className={`${td} text-right`}>{item.quantity}</td>
                  <td className={`${td} whitespace-nowrap text-right`}>{formatRupiah(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200">
                <td colSpan={3} className={`${td} text-right font-semibold`}>
                  Total
                </td>
                <td className={`${td} whitespace-nowrap text-right text-base font-semibold text-slate-900`}>{formatRupiah(order.total_amount)}</td>
              </tr>
            </tfoot>
          </table>
        </TableWrap>
      </Card>
    </>
  );
}
