<?php

namespace Database\Factories;

use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    public function definition(): array
    {
        return [
            'product_code' => 'P'.fake()->unique()->numerify('#####'),
            'product_name' => ucfirst(fake()->unique()->words(2, true)).' '.fake()->randomElement([100, 150, 250, 500]).'ml',
            'stock' => fake()->numberBetween(20, 200),
            'price' => fake()->numberBetween(5, 150) * 1000,
        ];
    }
}
