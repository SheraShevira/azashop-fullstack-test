# AZA Shop: Sistem Online Shop (Order Management)

Technical test *Medior Fullstack Developer*: **Track B (Laravel)** + frontend Next.js. Backend dan frontend adalah dua service terpisah.

| Layer | Pilihan |
|---|---|
| Backend | PHP 8.4, **Laravel 13**, Eloquent + Migration + Factory + Seeder, **Laravel Sanctum** (API token), Form Request, API Resource, PHPUnit |
| Database | PostgreSQL 17 (test: SQLite in-memory) |
| Frontend | **Next.js 16 (App Router) + React 19 + TypeScript strict**, Tailwind CSS 4, TanStack Query, Zod, Vitest + Testing Library |
| Infra | Docker Compose (db + backend + frontend), GitHub Actions (lint + test + build) |

## Menjalankan aplikasi

Prasyarat: Docker.

```bash
git clone <url-repo> azashop
cd azashop
docker compose up --build
```

Selesai (3 perintah). Migration dan seeder otomatis berjalan saat container backend start (seeder idempotent).

- Frontend: <http://localhost:3000>
- API: <http://localhost:8000/api>
- **Login seeder:** `admin@azatech.id` / `password`

Data seeder: 1 admin, 20 produk, 15 pelanggan, 30 order tersebar 30 hari terakhir (3 produk sengaja bersisa stok < 5 agar peringatan stok menipis terlihat).

### Tanpa Docker (opsional)

```bash
# backend (butuh PHP 8.3+, Composer, PostgreSQL atau ubah DB_* ke sqlite)
cd backend && composer install && cp .env.example .env && php artisan key:generate
php artisan migrate --seed && php artisan serve
# frontend
cd frontend && npm ci && echo NEXT_PUBLIC_API_URL=http://localhost:8000/api > .env.local && npm run dev
```

## Menjalankan test

```bash
# backend: 22 feature test (SQLite in-memory, tidak butuh database lain)
cd backend && php artisan test
# atau tanpa PHP lokal:
docker compose run --rm --no-deps backend php artisan test

# frontend: unit/component test
cd frontend && npm test
```

Test backend mencakup semua skenario wajib: **order sukses, stok tidak cukup (atomik), validasi input gagal, akses tanpa token**, plus snapshot harga, soft delete, filter riwayat, dashboard, pagination/search/sort.

## Dokumentasi API

Postman collection: [`docs/postman_collection.json`](docs/postman_collection.json). Jalankan *Auth › Login* dulu; token tersimpan otomatis. Semua endpoint selain login butuh header `Authorization: Bearer <token>`.

| Endpoint | Keterangan |
|---|---|
| `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` | Auth (token Sanctum, kedaluwarsa 480 menit, `SANCTUM_TOKEN_EXPIRATION`) |
| `GET/POST /api/products`, `GET/PUT/DELETE /api/products/{id}` | List: `page, per_page (maks 100), search (nama/kode), sort` (`name, price, stock`, awalan `-` = desc, mis. `-price`) |
| `GET/POST /api/customers`, `GET/PUT/DELETE /api/customers/{id}` | List: `page, per_page, search` (nama) |
| `GET /api/orders`, `GET /api/orders/{id}`, `POST /api/orders` | List: `from, to (Y-m-d), customer_id, page, per_page` |
| `GET /api/orders/export` | Bonus: CSV riwayat order (filter sama dengan list) |
| `GET /api/dashboard/summary` | Total transaksi, total penjualan, 5 produk terlaris, stok < 5, penjualan harian 30 hari (bonus) |

Format response konsisten (`success`, `message`, `data`, `meta` / `errors`):

| Status | Dipakai untuk |
|---|---|
| 200 / 201 / 204 | sukses / dibuat / hapus |
| 401 | tanpa token, token salah/kedaluwarsa, login salah |
| 404 | data tidak ada (termasuk yang sudah soft-delete) |
| 409 | **stok tidak mencukupi** (konflik dengan state stok saat ini) |
| 422 | validasi gagal |
| 500 | error server (pesan di-mask saat `APP_DEBUG=false`) |

Contoh error stok: `409 {"success":false,"message":"Stok tidak mencukupi","errors":{"items.1.quantity":["Stok Hydrococo 150ml tersisa 3, diminta 5"]}}`. Frontend memetakan key `items.N.quantity` ke baris produk yang bermasalah.

## Logika aplikasi

### Alur pembuatan order (`app/Services/OrderService.php`)

Seluruhnya di **satu database transaction**:

1. Request divalidasi (`StoreOrderRequest`): customer & produk harus ada dan belum soft-delete, `quantity >= 1`, tiap produk hanya boleh muncul satu kali. `price` dan `total` dari client **tidak pernah dibaca**.
2. Baris produk di-`SELECT ... FOR UPDATE` dengan urutan `id` tetap (mencegah deadlock antar order yang berbagi produk, dan mencegah dua order menjual stok yang sama).
3. Stok tiap item dicek. Jika ada yang kurang, semua kekurangan dikumpulkan, `InsufficientStockException` dilempar, transaction di-rollback: **tidak ada stok yang berkurang dan tidak ada order tersimpan**.
4. `order_number` `INV-YYYYMMDD-XXXX` dibuat dari nomor terbesar hari itu + 1. Jika dua request bentrok, unique index menolak salah satu dan seluruh transaction diulang (maks 5x).
5. `unit_price` = snapshot harga produk saat itu, `subtotal = unit_price × quantity`, `total_amount` = jumlah subtotal, dihitung dalam **integer sen** (bebas error floating point). Stok dikurangi.

### Keputusan desain

- **Soft delete** produk & pelanggan. Relasi `withTrashed()` di order item/order, jadi riwayat tetap utuh walau produk/pelanggan dihapus. Foreign key `RESTRICT` agar hard delete tidak pernah membuat data yatim. `product_code` unik juga terhadap produk yang sudah dihapus (kode lama tetap mengidentifikasi order lama).
- **Index tambahan:** `products.product_name`, `customers.customer_name` (search/sort), `orders.order_date` dan `(customer_id, order_date)` (filter riwayat), `order_items.product_id` (produk terlaris). Search memakai `LOWER(col) LIKE`, portable di PostgreSQL/MySQL/SQLite.
- Kolom tambahan di `users` hanya bawaan Laravel (`email_verified_at`, `remember_token`).
- **Status 409** untuk stok tidak cukup karena kegagalannya bukan salah format input, melainkan konflik dengan state stok. Respons tetap membawa `errors` per item seperti contoh pada soal.
- Token disimpan di `localStorage` frontend dan ditempel sebagai Bearer. Response 401 membersihkan token dan mengarahkan ke `/login`.
- Zona waktu aplikasi `Asia/Jakarta`; tanggal di UI diformat `id-ID`, mata uang `Rp 12.000`.

## Fitur bonus yang dikerjakan

Docker Compose, GitHub Actions (`.github/workflows/ci.yml`: Pint + PHPUnit; ESLint + tsc + Vitest + build), grafik penjualan harian (SVG tanpa dependency), export CSV riwayat order (dengan proteksi CSV formula injection), test frontend (Vitest + Testing Library).

## Asumsi, keterbatasan, dan perbaikan berikutnya

- Satu role (admin); tidak ada otorisasi per-role, sehingga status 403 belum terpakai.
- Pemilihan pelanggan/produk di form order memuat maks 100 data (batas `per_page`). Untuk katalog besar perlu *async searchable picker*.
- `order_number` dihasilkan dari `MAX()` + retry saat bentrok. Cukup untuk volume kecil/menengah; untuk throughput tinggi lebih baik tabel sequence per hari.
- Order tidak bisa diedit/dibatalkan (di luar scope soal); pembatalan perlu mengembalikan stok.
- Token Bearer di `localStorage` rentan XSS; produksi sebaiknya memakai cookie `HttpOnly` (mode SPA Sanctum) + refresh. Tidak ada refresh token; token kedaluwarsa memaksa login ulang.
- Backend dijalankan dengan `php artisan serve` di Docker demi kesederhanaan; produksi memakai php-fpm/Octane di belakang nginx.
- Test backend berjalan di SQLite; `FOR UPDATE` tidak berefek di sana. Perilaku konkurensi (row lock, retry nomor order) belum diuji, baik otomatis maupun manual. Alur order, seed, dan stok tidak cukup sudah dicoba manual terhadap PostgreSQL via Docker, tetapi tanpa beban paralel. Belum ada E2E (Playwright).
- Dokumentasi API berupa Postman collection, belum OpenAPI.

## AI Usage

Dikerjakan dengan **Claude (Claude Code)**: scaffolding Laravel/Next.js, implementasi backend, frontend, test, Dockerfile/compose, Postman collection, CI, dan draf README. Hasilnya dijalankan dan diverifikasi (test backend & frontend, build, seed, dan uji manual di browser). Seluruh kode saya review dan dapat saya jelaskan atau ubah saat sesi review.
