<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OrderTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->customer = Customer::factory()->create();
        Sanctum::actingAs($this->user);
    }

    public function test_create_order_succeeds_computes_totals_and_decrements_stock(): void
    {
        $a = Product::factory()->create(['price' => 12000, 'stock' => 10]);
        $b = Product::factory()->create(['price' => 12000.50, 'stock' => 4]);

        $response = $this->postJson('/api/orders', [
            'customer_id' => $this->customer->id,
            'items' => [
                ['product_id' => $a->id, 'quantity' => 2],
                ['product_id' => $b->id, 'quantity' => 1],
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.total_amount', '36000.50')
            ->assertJsonPath('data.items.0.unit_price', '12000.00')
            ->assertJsonPath('data.items.0.subtotal', '24000.00')
            ->assertJsonPath('data.created_by.id', $this->user->id);

        $this->assertMatchesRegularExpression('/^INV-\d{8}-0001$/', $response->json('data.order_number'));
        $this->assertSame(8, $a->fresh()->stock);
        $this->assertSame(3, $b->fresh()->stock);
        $this->assertDatabaseCount('order_items', 2);
    }

    public function test_client_supplied_price_and_total_are_ignored(): void
    {
        $product = Product::factory()->create(['price' => 5000, 'stock' => 10]);

        $this->postJson('/api/orders', [
            'customer_id' => $this->customer->id,
            'total_amount' => 1,
            'items' => [['product_id' => $product->id, 'quantity' => 2, 'price' => 1, 'unit_price' => 1]],
        ])->assertCreated()->assertJsonPath('data.total_amount', '10000.00');
    }

    public function test_insufficient_stock_fails_whole_order_and_changes_nothing(): void
    {
        $ok = Product::factory()->create(['stock' => 10]);
        $short = Product::factory()->create(['product_name' => 'Hydrococo 150ml', 'stock' => 3]);

        $this->postJson('/api/orders', [
            'customer_id' => $this->customer->id,
            'items' => [
                ['product_id' => $ok->id, 'quantity' => 2],
                ['product_id' => $short->id, 'quantity' => 5],
            ],
        ])->assertStatus(409)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Stok tidak mencukupi')
            ->assertJsonPath('errors', ['items.1.quantity' => ['Stok Hydrococo 150ml tersisa 3, diminta 5']]);

        $this->assertSame(10, $ok->fresh()->stock, 'stock of the valid line must not be touched');
        $this->assertSame(3, $short->fresh()->stock);
        $this->assertDatabaseCount('orders', 0);
        $this->assertDatabaseCount('order_items', 0);
    }

    public function test_invalid_input_is_rejected_with_422(): void
    {
        $product = Product::factory()->create(['stock' => 10]);

        $this->postJson('/api/orders', ['items' => []])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['customer_id', 'items'], 'errors');

        $this->postJson('/api/orders', [
            'customer_id' => $this->customer->id,
            'items' => [['product_id' => $product->id, 'quantity' => 0], ['product_id' => 99999, 'quantity' => 1]],
        ])->assertUnprocessable()
            ->assertJsonPath('success', false)
            ->assertJsonStructure(['errors' => ['items.0.quantity', 'items.1.product_id']]);

        $this->assertDatabaseCount('orders', 0);
    }

    public function test_duplicate_product_lines_are_rejected(): void
    {
        $product = Product::factory()->create(['stock' => 5]);

        $this->postJson('/api/orders', [
            'customer_id' => $this->customer->id,
            'items' => [['product_id' => $product->id, 'quantity' => 3], ['product_id' => $product->id, 'quantity' => 3]],
        ])->assertUnprocessable()->assertJsonValidationErrors(['items.0.product_id', 'items.1.product_id'], 'errors');
    }

    public function test_order_numbers_increment_per_day(): void
    {
        $product = Product::factory()->create(['stock' => 100]);
        $payload = ['customer_id' => $this->customer->id, 'items' => [['product_id' => $product->id, 'quantity' => 1]]];

        $first = $this->postJson('/api/orders', $payload)->json('data.order_number');
        $second = $this->postJson('/api/orders', $payload)->json('data.order_number');

        $this->assertSame(substr($first, 0, -4).'0002', $second);
    }

    public function test_history_keeps_snapshot_price_and_soft_deleted_product(): void
    {
        $product = Product::factory()->create(['price' => 10000, 'stock' => 10, 'product_name' => 'Produk Lama']);
        $orderId = $this->postJson('/api/orders', [
            'customer_id' => $this->customer->id,
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->json('data.id');

        $product->update(['price' => 99000]);
        $this->deleteJson("/api/products/{$product->id}")->assertNoContent();

        $this->getJson("/api/orders/{$orderId}")
            ->assertOk()
            ->assertJsonPath('data.items.0.unit_price', '10000.00')
            ->assertJsonPath('data.items.0.product_name', 'Produk Lama');
    }

    public function test_cannot_order_a_soft_deleted_product(): void
    {
        $product = Product::factory()->create(['stock' => 10]);
        $product->delete();

        $this->postJson('/api/orders', [
            'customer_id' => $this->customer->id,
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertUnprocessable()->assertJsonValidationErrors(['items.0.product_id'], 'errors');
    }

    public function test_history_can_be_filtered_by_date_range_and_customer(): void
    {
        $other = Customer::factory()->create();
        $old = Order::factory()->create(['customer_id' => $this->customer->id, 'order_date' => '2026-01-10 10:00:00', 'order_number' => 'INV-20260110-0001']);
        $inRange = Order::factory()->create(['customer_id' => $this->customer->id, 'order_date' => '2026-02-15 23:59:00', 'order_number' => 'INV-20260215-0001']);
        Order::factory()->create(['customer_id' => $other->id, 'order_date' => '2026-02-15 09:00:00', 'order_number' => 'INV-20260215-0002']);

        $this->getJson("/api/orders?from=2026-02-01&to=2026-02-15&customer_id={$this->customer->id}")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $inRange->id)
            ->assertJsonPath('meta.total', 1);

        $this->getJson('/api/orders')->assertJsonPath('meta.total', 3)->assertJsonPath('data.2.id', $old->id);
        $this->getJson('/api/orders?from=2026-03-01&to=2026-02-01')->assertUnprocessable();
    }

    public function test_dashboard_summary(): void
    {
        $hot = Product::factory()->create(['price' => 10000, 'stock' => 50]);
        $cold = Product::factory()->create(['price' => 5000, 'stock' => 50]);
        Product::factory()->create(['product_name' => 'Hampir Habis', 'stock' => 2]);

        foreach ([[$hot, 3], [$hot, 2], [$cold, 1]] as [$product, $qty]) {
            $this->postJson('/api/orders', [
                'customer_id' => $this->customer->id,
                'items' => [['product_id' => $product->id, 'quantity' => $qty]],
            ])->assertCreated();
        }

        $this->getJson('/api/dashboard/summary')
            ->assertOk()
            ->assertJsonPath('data.total_orders', 3)
            ->assertJsonPath('data.total_sales', '55000.00')
            ->assertJsonPath('data.top_products.0.id', $hot->id)
            ->assertJsonPath('data.top_products.0.total_quantity', 5)
            ->assertJsonCount(1, 'data.low_stock_products')
            ->assertJsonPath('data.low_stock_products.0.product_name', 'Hampir Habis')
            ->assertJsonCount(30, 'data.daily_sales');
    }
}
