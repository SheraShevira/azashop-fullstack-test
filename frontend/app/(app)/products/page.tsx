"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { api, ApiError, fieldErrors } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import { useDebounced } from "@/lib/hooks";
import {
  Alert, Button, Card, ConfirmDialog, controlClass, EmptyState, ErrorState, Field, LoadingState, Modal, PageHeader, Pagination, TableWrap, td, th,
} from "@/components/ui";
import type { Product } from "@/lib/types";

const schema = z.object({
  product_code: z.string().trim().min(1, "Kode produk wajib diisi").max(20, "Maksimal 20 karakter"),
  product_name: z.string().trim().min(1, "Nama produk wajib diisi").max(150, "Maksimal 150 karakter"),
  stock: z.coerce.number("Stok harus berupa angka").int("Stok harus bilangan bulat").min(0, "Stok tidak boleh negatif"),
  price: z.coerce.number("Harga harus berupa angka").gt(0, "Harga harus lebih dari 0").max(9_999_999_999.99, "Harga terlalu besar"),
});

type FormState = { product_code: string; product_name: string; stock: string; price: string };

const SORTS = [
  { value: "name", label: "Nama (A-Z)" },
  { value: "-name", label: "Nama (Z-A)" },
  { value: "price", label: "Harga termurah" },
  { value: "-price", label: "Harga termahal" },
  { value: "stock", label: "Stok tersedikit" },
  { value: "-stock", label: "Stok terbanyak" },
];

function ProductForm({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>({
    product_code: product?.product_code ?? "",
    product_name: product?.product_name ?? "",
    stock: String(product?.stock ?? 0),
    price: product ? String(Number(product.price)) : "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: (body: z.infer<typeof schema>) =>
      product ? api(`/products/${product.id}`, { method: "PUT", body }) : api("/products", { method: "POST", body }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
    onError: (error) => setErrors(fieldErrors(error)),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      return setErrors(next);
    }
    setErrors({});
    save.mutate(parsed.data);
  }

  const set = (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: event.target.value });

  return (
    <Modal title={product ? "Ubah Produk" : "Tambah Produk"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {save.isError && Object.keys(errors).length === 0 && <Alert>{save.error.message}</Alert>}
        <Field label="Kode Produk" error={errors.product_code}>
          {(props) => <input {...props} value={form.product_code} onChange={set("product_code")} maxLength={20} placeholder="P0001" />}
        </Field>
        <Field label="Nama Produk" error={errors.product_name}>
          {(props) => <input {...props} value={form.product_name} onChange={set("product_name")} maxLength={150} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Stok" error={errors.stock}>
            {(props) => <input {...props} type="number" inputMode="numeric" min={0} step={1} value={form.stock} onChange={set("stock")} />}
          </Field>
          <Field label="Harga (Rp)" error={errors.price}>
            {(props) => <input {...props} type="number" inputMode="decimal" min={0} step="0.01" value={form.price} onChange={set("price")} />}
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Batal
          </Button>
          <Button type="submit" loading={save.isPending}>
            Simpan
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const debouncedSearch = useDebounced(search);

  const query = useQuery({
    queryKey: ["products", { search: debouncedSearch, sort, page }],
    queryFn: () => api<Product[]>("/products", { query: { search: debouncedSearch, sort, page, per_page: 10 } }),
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: (product: Product) => api(`/products/${product.id}`, { method: "DELETE" }),
    onSuccess: async () => {
      setDeleting(null);
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const products = query.data?.data ?? [];

  return (
    <>
      <PageHeader title="Produk" actions={<Button onClick={() => setEditing("new")}>Tambah Produk</Button>} />

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row">
          <input
            type="search"
            aria-label="Cari produk"
            placeholder="Cari nama atau kode produk..."
            className={`${controlClass} border-slate-300 sm:max-w-xs`}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <select
            aria-label="Urutkan"
            className={`${controlClass} border-slate-300 sm:max-w-48`}
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              setPage(1);
            }}
          >
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {query.isPending ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
        ) : products.length === 0 ? (
          <EmptyState title={debouncedSearch ? "Produk tidak ditemukan" : "Belum ada produk"} description={debouncedSearch ? "Coba kata kunci lain." : "Tambahkan produk pertama Anda."} />
        ) : (
          <>
            <TableWrap>
              <table className={`w-full ${query.isPlaceholderData ? "opacity-60" : ""}`}>
                <thead className="bg-slate-50">
                  <tr>
                    <th className={th}>Kode</th>
                    <th className={th}>Nama Produk</th>
                    <th className={`${th} text-right`}>Stok</th>
                    <th className={`${th} text-right`}>Harga</th>
                    <th className={`${th} text-right`}>Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td className={`${td} whitespace-nowrap font-mono`}>{product.product_code}</td>
                      <td className={td}>{product.product_name}</td>
                      <td className={`${td} text-right ${product.stock < 5 ? "font-semibold text-red-600" : ""}`}>{product.stock}</td>
                      <td className={`${td} whitespace-nowrap text-right`}>{formatRupiah(product.price)}</td>
                      <td className={`${td} whitespace-nowrap text-right`}>
                        <Button variant="ghost" onClick={() => setEditing(product)}>
                          Ubah
                        </Button>
                        <Button variant="ghost" className="text-red-600" onClick={() => setDeleting(product)}>
                          Hapus
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            {query.data?.meta && <Pagination meta={query.data.meta} onPage={setPage} />}
          </>
        )}
      </Card>

      {editing && <ProductForm product={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog
          title="Hapus produk?"
          message={`"${deleting.product_name}" akan dihapus dari daftar. Riwayat order yang memuat produk ini tidak terpengaruh.`}
          loading={remove.isPending}
          error={remove.error instanceof ApiError ? remove.error.message : undefined}
          onConfirm={() => remove.mutate(deleting)}
          onCancel={() => {
            remove.reset();
            setDeleting(null);
          }}
        />
      )}
    </>
  );
}
