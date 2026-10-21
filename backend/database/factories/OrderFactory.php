<?php

namespace Database\Factories;

use App\Models\Customer;
use App\Models\Order;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Bare order header. Items/totals/stock are produced by DatabaseSeeder (or OrderService in tests).
 *
 * @extends Factory<Order>
 */
class OrderFactory extends Factory
{
    public function definition(): array
    {
        $date = now();

        return [
            'order_number' => 'INV-'.$date->format('Ymd').'-'.fake()->unique()->numerify('####'),
            'customer_id' => Customer::factory(),
            'created_by' => User::factory(),
            'order_date' => $date,
            'total_amount' => 0,
        ];
    }
}
