<?php

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    private const PRODUCTS = [
        ['Hydrococo', '150ml', 12000], ['Hydrococo', '500ml', 28000], ['Minyak Kelapa Murni', '250ml', 35000],
        ['Sabun Cair Lavender', '250ml', 21000], ['Sabun Cair Lemon', '500ml', 32000], ['Sampo Herbal', '170ml', 24500],
        ['Kondisioner Argan', '170ml', 27500], ['Lotion Aloe Vera', '200ml', 19000], ['Pasta Gigi Mint', '120g', 9500],
        ['Deterjen Cair', '800ml', 26000], ['Pelembut Pakaian', '900ml', 18500], ['Pembersih Lantai Pine', '800ml', 15000],
        ['Hand Sanitizer', '100ml', 11000], ['Masker Wajah Clay', '75g', 38000], ['Serum Vitamin C', '30ml', 89000],
        ['Sunscreen SPF 50', '50ml', 67000], ['Minyak Zaitun', '250ml', 54000], ['Madu Hutan', '300ml', 72000],
        ['Teh Hijau Organik', '100g', 29000], ['Kopi Arabika Gayo', '200g', 58000],
    ];

    public function run(): void
    {
        // Idempotent so the container entrypoint can call it on every boot.
        if (User::where('email', 'admin@azatech.id')->exists()) {
            return;
        }

        DB::transaction(function () {
            $admin = User::factory()->create([
                'name' => 'Admin AZA',
                'email' => 'admin@azatech.id',
                'password' => 'password',
            ]);

            $products = collect(self::PRODUCTS)->map(fn (array $p, int $i) => Product::factory()->create([
                'product_code' => sprintf('P%04d', $i + 1),
                'product_name' => "{$p[0]} {$p[1]}",
                'price' => $p[2],
                'stock' => 300, // enough headroom for the historical orders below
            ]));
            $customers = Customer::factory()->count(15)->create();

            $this->seedOrders($admin, $products, $customers);

            // Leave a few products almost sold out so the dashboard "low stock" panel has content.
            $products->take(-3)->each(fn (Product $p, int $i) => $p->update(['stock' => $i + 1]));
        });
    }

    /** 30 orders spread over the last 30 days, built the same way OrderService does (snapshot price, decrement stock). */
    private function seedOrders(User $admin, $products, $customers): void
    {
        $counters = [];

        foreach (range(1, 30) as $n) {
            $date = now()->subDays(30 - $n)->setTime(random_int(8, 20), random_int(0, 59), random_int(0, 59));
            $key = $date->format('Ymd');
            $counters[$key] = ($counters[$key] ?? 0) + 1;

            $order = Order::create([
                'order_number' => sprintf('INV-%s-%04d', $key, $counters[$key]),
                'customer_id' => $customers->random()->id,
                'created_by' => $admin->id,
                'order_date' => $date,
                'total_amount' => 0,
            ]);

            $total = 0;
            foreach ($products->random(random_int(1, 4)) as $product) {
                $quantity = random_int(1, 5);
                $subtotal = $product->price * $quantity;
                $total += $subtotal;

                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $product->id,
                    'quantity' => $quantity,
                    'unit_price' => $product->price,
                    'subtotal' => $subtotal,
                ]);
                $product->decrement('stock', $quantity);
            }

            $order->update(['total_amount' => $total]);
        }
    }
}
