"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api, ApiError, fieldErrors } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import { type DraftLine, itemErrors, lineSubtotalCents, orderTotalCents } from "@/lib/order";
import { Alert, Button, Card, ErrorState, Field, LoadingState, PageHeader } from "@/components/ui";
import type { Customer, Order, Product } from "@/lib/types";

export default function NewOrderPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const nextKey = useRef(1);
  const newLine = (): DraftLine => ({ key: String(nextKey.current++), productId: "", quantity: "1" });

  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<DraftLine[]>(() => [{ key: "0", productId: "", quantity: "1" }]);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  // per_page=100 is the API maximum; a searchable async picker would be the next step for larger catalogues.
  const customers = useQuery({
    queryKey: ["customers", "options"],
    queryFn: async () => (await api<Customer[]>("/customers", { query: { per_page: 100 } })).data,
  });
  const products = useQuery({
    queryKey: ["products", "options"],
    queryFn: async () => (await api<Product[]>("/products", { query: { per_page: 100, sort: "name" } })).data,
  });

  const submit = useMutation({
    mutationFn: () =>
      api<Order>("/orders", {
        method: "POST",
        body: {
          customer_id: customerId,
          items: lines.map((line) => ({ product_id: Number(line.productId), quantity: Number(line.quantity) })),
        },
      }),
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      router.push(`/orders/${response.data.id}`);
    },
    onError: () => {
      // Stock may have changed under us; refresh the options so the next attempt shows current numbers.
      queryClient.invalidateQueries({ queryKey: ["products", "options"] });
    },
  });

  if (customers.isPending || products.isPending) return <LoadingState />;
  if (customers.isError || products.isError) {
    const error = customers.error ?? products.error;
    return <ErrorState message={error?.message ?? "Gagal memuat data"} onRetry={() => { customers.refetch(); products.refetch(); }} />;
  }

  const productList = products.data;
  const serverErrors = submit.error instanceof ApiError ? submit.error.errors : {};
  const lineServerErrors = itemErrors(serverErrors);
  const topLevelErrors = fieldErrors(submit.error);
  const totalCents = orderTotalCents(lines, productList);

  const updateLine = (key: string, patch: Partial<DraftLine>) => setLines(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    submit.reset();

    const next: Record<string, string> = {};
    if (!customerId) next.customer = "Pilih pelanggan";
    lines.forEach((line, index) => {
      const quantity = Number(line.quantity);
      if (!line.productId) next[`line.${index}`] = "Pilih produk";
      else if (!Number.isInteger(quantity) || quantity < 1) next[`line.${index}`] = "Jumlah minimal 1";
    });
    setClientErrors(next);
    if (Object.keys(next).length === 0) submit.mutate();
  }

  const usedProducts = new Set(lines.map((line) => line.productId));

  return (
    <>
      <PageHeader title="Buat Order" />

      <form onSubmit={onSubmit} noValidate className="space-y-6">
        {submit.isError && (
          <Alert>
            <p className="font-medium">{submit.error.message}</p>
            {Object.keys(lineServerErrors).length > 0 && <p className="mt-1">Periksa baris yang ditandai di bawah.</p>}
          </Alert>
        )}

        <Card className="p-5">
          <div className="max-w-md">
            <Field label="Pelanggan" error={clientErrors.customer ?? topLevelErrors.customer_id}>
              {(props) => (
                <select {...props} value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                  <option value="">Pilih pelanggan...</option>
                  {customers.data.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.customer_name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Item Produk</h2>

          <div className="space-y-4">
            {lines.map((line, index) => {
              const product = productList.find((p) => String(p.id) === line.productId);
              const error = clientErrors[`line.${index}`] ?? lineServerErrors[index];

              return (
                <div key={line.key} className={`rounded-lg border p-3 ${error ? "border-red-300 bg-red-50/40" : "border-slate-200"}`}>
                  <div className="grid gap-3 md:grid-cols-[1fr_7rem_9rem_9rem_auto] md:items-end">
                    <Field label="Produk">
                      {(props) => (
                        <select {...props} value={line.productId} onChange={(event) => updateLine(line.key, { productId: event.target.value })}>
                          <option value="">Pilih produk...</option>
                          {productList.map((p) => (
                            <option key={p.id} value={p.id} disabled={p.stock === 0 || (usedProducts.has(String(p.id)) && String(p.id) !== line.productId)}>
                              {p.product_name} (stok {p.stock})
                            </option>
                          ))}
                        </select>
                      )}
                    </Field>
                    <Field label="Jumlah">
                      {(props) => (
                        <input
                          {...props}
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={product?.stock}
                          step={1}
                          value={line.quantity}
                          onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                        />
                      )}
                    </Field>
                    <div>
                      <p className="mb-1 text-sm font-medium text-slate-700">Harga</p>
                      <p className="flex min-h-10 items-center text-sm text-slate-700">{product ? formatRupiah(product.price) : "-"}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-sm font-medium text-slate-700">Subtotal</p>
                      <p className="flex min-h-10 items-center text-sm font-semibold text-slate-900">{formatRupiah(lineSubtotalCents(line, productList) / 100)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      className="text-red-600"
                      aria-label={`Hapus baris ${index + 1}`}
                      disabled={lines.length === 1}
                      onClick={() => setLines(lines.filter((l) => l.key !== line.key))}
                    >
                      Hapus
                    </Button>
                  </div>
                  {error && (
                    <p role="alert" className="mt-2 text-sm font-medium text-red-600">
                      {error}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <Button variant="secondary" className="mt-4" onClick={() => setLines([...lines, newLine()])} disabled={lines.length >= productList.length}>
            Tambah Produk
          </Button>
        </Card>

        <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-sm text-slate-500">Total (perkiraan; dihitung ulang server)</p>
            <p className="text-2xl font-semibold text-slate-900">{formatRupiah(totalCents / 100)}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push("/orders")} disabled={submit.isPending}>
              Batal
            </Button>
            <Button type="submit" loading={submit.isPending}>
              Simpan Order
            </Button>
          </div>
        </Card>
      </form>
    </>
  );
}
