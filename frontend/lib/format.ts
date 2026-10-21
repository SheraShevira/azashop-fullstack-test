const TIME_ZONE = "Asia/Jakarta";

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** "12000.00" -> "Rp 12.000" (Intl inserts a non-breaking space; normalise it). */
export function formatRupiah(value: string | number): string {
  return rupiah.format(Number(value)).replace(/ /g, " ");
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: TIME_ZONE }).format(new Date(value));
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: TIME_ZONE })
    .format(new Date(value))
    .replace(/\./g, ":");
}

/** Short label for chart axes: "2026-10-22" -> "22 Okt". */
export function formatDayMonth(isoDate: string): string {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${isoDate}T00:00:00Z`));
}
