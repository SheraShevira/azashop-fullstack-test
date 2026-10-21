"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError, fieldErrors, tokenStore } from "@/lib/api";
import { Alert, Button, Card, Field } from "@/components/ui";
import type { User } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (tokenStore.get()) {
      router.replace("/");
      return;
    }
    // ?expired=1 is set by the API client after a 401.
    if (new URLSearchParams(window.location.search).get("expired")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off read of the URL after mount
      setMessage("Sesi Anda berakhir. Silakan login kembali.");
    }
  }, [router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    setMessage(null);

    const next: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = "Masukkan email yang valid";
    if (!password) next.password = "Password wajib diisi";
    if (Object.keys(next).length) return setErrors(next);

    setSubmitting(true);
    try {
      const response = await api<{ token: string; user: User }>("/auth/login", { method: "POST", body: { email, password } });
      tokenStore.set(response.data.token);
      router.replace("/");
    } catch (error) {
      setErrors(fieldErrors(error));
      setMessage(error instanceof ApiError ? error.message : "Terjadi kesalahan");
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm p-6">
        <h1 className="text-xl font-semibold text-slate-900">AZA Shop</h1>
        <p className="mb-6 text-sm text-slate-500">Masuk untuk mengelola toko Anda.</p>

        <form onSubmit={submit} className="space-y-4" noValidate>
          {message && <Alert tone={message.startsWith("Sesi") ? "warning" : "error"}>{message}</Alert>}
          <Field label="Email" error={errors.email}>
            {(props) => (
              <input {...props} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@azatech.id" />
            )}
          </Field>
          <Field label="Password" error={errors.password}>
            {(props) => <input {...props} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          <Button type="submit" loading={submitting} className="w-full">
            Masuk
          </Button>
        </form>
      </Card>
    </main>
  );
}
