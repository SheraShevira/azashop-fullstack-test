"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { api, ApiError, fieldErrors } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useDebounced } from "@/lib/hooks";
import {
  Alert, Button, Card, ConfirmDialog, controlClass, EmptyState, ErrorState, Field, LoadingState, Modal, PageHeader, Pagination, TableWrap, td, th,
} from "@/components/ui";
import type { Customer } from "@/lib/types";

const schema = z.object({
  customer_name: z.string().trim().min(1, "Nama wajib diisi").max(150, "Maksimal 150 karakter"),
  customer_address: z.string().trim().min(1, "Alamat wajib diisi").max(255, "Maksimal 255 karakter"),
  gender: z.enum(["Pria", "Wanita"], "Pilih jenis kelamin"),
  birth_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal lahir wajib diisi")
    .refine((value) => value <= new Date().toISOString().slice(0, 10), "Tanggal lahir tidak boleh di masa depan"),
  phone: z
    .string()
    .trim()
    .max(20, "Maksimal 20 karakter")
    .regex(/^[0-9+\-\s]*$/, "Hanya angka, spasi, + dan -")
    .transform((value) => value || null),
});

type FormState = { customer_name: string; customer_address: string; gender: string; birth_date: string; phone: string };

function CustomerForm({ customer, onClose }: { customer: Customer | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>({
    customer_name: customer?.customer_name ?? "",
    customer_address: customer?.customer_address ?? "",
    gender: customer?.gender ?? "",
    birth_date: customer?.birth_date ?? "",
    phone: customer?.phone ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: (body: z.infer<typeof schema>) =>
      customer ? api(`/customers/${customer.id}`, { method: "PUT", body }) : api("/customers", { method: "POST", body }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
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

  const set = (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: event.target.value });

  return (
    <Modal title={customer ? "Ubah Pelanggan" : "Tambah Pelanggan"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {save.isError && Object.keys(errors).length === 0 && <Alert>{save.error.message}</Alert>}
        <Field label="Nama" error={errors.customer_name}>
          {(props) => <input {...props} value={form.customer_name} onChange={set("customer_name")} maxLength={150} />}
        </Field>
        <Field label="Alamat" error={errors.customer_address}>
          {(props) => <textarea {...props} rows={2} value={form.customer_address} onChange={set("customer_address")} maxLength={255} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Jenis Kelamin" error={errors.gender}>
            {(props) => (
              <select {...props} value={form.gender} onChange={set("gender")}>
                <option value="">Pilih...</option>
                <option value="Pria">Pria</option>
                <option value="Wanita">Wanita</option>
              </select>
            )}
          </Field>
          <Field label="Tanggal Lahir" error={errors.birth_date}>
            {(props) => <input {...props} type="date" max={new Date().toISOString().slice(0, 10)} value={form.birth_date} onChange={set("birth_date")} />}
          </Field>
        </div>
        <Field label="No. HP (opsional)" error={errors.phone}>
          {(props) => <input {...props} type="tel" value={form.phone} onChange={set("phone")} maxLength={20} placeholder="081234567890" />}
        </Field>
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

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Customer | "new" | null>(null);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const debouncedSearch = useDebounced(search);

  const query = useQuery({
    queryKey: ["customers", { search: debouncedSearch, page }],
    queryFn: () => api<Customer[]>("/customers", { query: { search: debouncedSearch, page, per_page: 10 } }),
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: (customer: Customer) => api(`/customers/${customer.id}`, { method: "DELETE" }),
    onSuccess: async () => {
      setDeleting(null);
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });

  const customers = query.data?.data ?? [];

  return (
    <>
      <PageHeader title="Pelanggan" actions={<Button onClick={() => setEditing("new")}>Tambah Pelanggan</Button>} />

      <Card>
        <div className="border-b border-slate-200 p-4">
          <input
            type="search"
            aria-label="Cari pelanggan"
            placeholder="Cari nama pelanggan..."
            className={`${controlClass} border-slate-300 sm:max-w-xs`}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>

        {query.isPending ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
        ) : customers.length === 0 ? (
          <EmptyState title={debouncedSearch ? "Pelanggan tidak ditemukan" : "Belum ada pelanggan"} description={debouncedSearch ? "Coba kata kunci lain." : "Tambahkan pelanggan pertama Anda."} />
        ) : (
          <>
            <TableWrap>
              <table className={`w-full ${query.isPlaceholderData ? "opacity-60" : ""}`}>
                <thead className="bg-slate-50">
                  <tr>
                    <th className={th}>Nama</th>
                    <th className={th}>Alamat</th>
                    <th className={th}>Gender</th>
                    <th className={th}>Tgl Lahir</th>
                    <th className={th}>No. HP</th>
                    <th className={`${th} text-right`}>Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customers.map((customer) => (
                    <tr key={customer.id}>
                      <td className={`${td} whitespace-nowrap font-medium`}>{customer.customer_name}</td>
                      <td className={`${td} min-w-48`}>{customer.customer_address}</td>
                      <td className={td}>{customer.gender}</td>
                      <td className={`${td} whitespace-nowrap`}>{formatDate(customer.birth_date)}</td>
                      <td className={`${td} whitespace-nowrap`}>{customer.phone ?? "-"}</td>
                      <td className={`${td} whitespace-nowrap text-right`}>
                        <Button variant="ghost" onClick={() => setEditing(customer)}>
                          Ubah
                        </Button>
                        <Button variant="ghost" className="text-red-600" onClick={() => setDeleting(customer)}>
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

      {editing && <CustomerForm customer={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog
          title="Hapus pelanggan?"
          message={`"${deleting.customer_name}" akan dihapus dari daftar. Riwayat order pelanggan ini tetap tersimpan.`}
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
