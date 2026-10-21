<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\InsufficientStockException;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

class OrderService
{
    private const NUMBER_RETRIES = 5;

    /**
     * Create an order atomically: validate stock, snapshot prices, compute totals server-side,
     * decrement stock. Everything happens in ONE transaction, so a single failing line leaves no trace.
     *
     * @param  array{customer_id: string, items: array<int, array{product_id: int, quantity: int}>}  $data
     *
     * @throws InsufficientStockException
     */
    public function create(array $data, User $user): Order
    {
        // order_number is derived from the day's current maximum. Two concurrent requests can pick the
        // same number; the unique index rejects the loser and we simply retry the whole transaction.
        for ($attempt = 1; ; $attempt++) {
            try {
                return DB::transaction(fn () => $this->place($data, $user));
            } catch (UniqueConstraintViolationException $e) {
                if ($attempt >= self::NUMBER_RETRIES) {
                    throw $e;
                }
            }
        }
    }

    private function place(array $data, User $user): Order
    {
        $lines = array_values($data['items']);

        // Lock rows in a stable (id) order so two orders sharing products cannot deadlock each other.
        $products = Product::query()
            ->whereIn('id', array_column($lines, 'product_id'))
            ->orderBy('id')
            ->lockForUpdate()
            ->get()
            ->keyBy('id');

        $errors = [];
        foreach ($lines as $index => $line) {
            $product = $products[$line['product_id']];

            if ($product->stock < $line['quantity']) {
                $errors["items.$index.quantity"] = [
                    "Stok {$product->product_name} tersisa {$product->stock}, diminta {$line['quantity']}",
                ];
            }
        }

        if ($errors !== []) {
            throw new InsufficientStockException($errors);
        }

        $orderDate = now();
        $order = Order::create([
            'order_number' => $this->nextOrderNumber($orderDate),
            'customer_id' => $data['customer_id'],
            'created_by' => $user->id,
            'order_date' => $orderDate,
            'total_amount' => 0,
        ]);

        // Money is summed in integer cents to avoid float drift.
        $totalCents = 0;
        foreach ($lines as $line) {
            $product = $products[$line['product_id']];
            $unitCents = (int) round(((float) $product->price) * 100);
            $subtotalCents = $unitCents * $line['quantity'];
            $totalCents += $subtotalCents;

            OrderItem::create([
                'order_id' => $order->id,
                'product_id' => $product->id,
                'quantity' => $line['quantity'],
                'unit_price' => $unitCents / 100,
                'subtotal' => $subtotalCents / 100,
            ]);

            $product->decrement('stock', $line['quantity']);
        }

        $order->update(['total_amount' => $totalCents / 100]);

        return $order->load(['customer', 'creator', 'items.product']);
    }

    private function nextOrderNumber(\DateTimeInterface $date): string
    {
        $prefix = 'INV-'.$date->format('Ymd').'-';

        $last = Order::query()->where('order_number', 'like', $prefix.'%')->max('order_number');
        $next = $last === null ? 1 : ((int) substr($last, strlen($prefix))) + 1;

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
