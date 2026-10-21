<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProductTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Sanctum::actingAs(User::factory()->create());
    }

    private function payload(array $overrides = []): array
    {
        return array_merge(['product_code' => 'P0001', 'product_name' => 'Hydrococo 150ml', 'stock' => 10, 'price' => 12000], $overrides);
    }

    public function test_crud_flow(): void
    {
        $id = $this->postJson('/api/products', $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.price', '12000.00')
            ->json('data.id');

        $this->getJson("/api/products/{$id}")->assertOk()->assertJsonPath('data.product_code', 'P0001');

        $this->putJson("/api/products/{$id}", $this->payload(['product_name' => 'Hydrococo 500ml', 'stock' => 0]))
            ->assertOk()
            ->assertJsonPath('data.product_name', 'Hydrococo 500ml');

        $this->deleteJson("/api/products/{$id}")->assertNoContent();
        $this->getJson("/api/products/{$id}")->assertNotFound()->assertJsonPath('success', false);
        $this->assertSoftDeleted('products', ['id' => $id]);
    }

    public function test_validation_rules(): void
    {
        Product::factory()->create(['product_code' => 'P0001']);

        $this->postJson('/api/products', $this->payload())->assertUnprocessable()->assertJsonValidationErrors(['product_code'], 'errors');
        $this->postJson('/api/products', $this->payload(['product_code' => 'P2', 'price' => 0]))->assertUnprocessable()->assertJsonValidationErrors(['price'], 'errors');
        $this->postJson('/api/products', $this->payload(['product_code' => 'P2', 'price' => -5]))->assertUnprocessable();
        $this->postJson('/api/products', $this->payload(['product_code' => 'P2', 'stock' => -1]))->assertUnprocessable()->assertJsonValidationErrors(['stock'], 'errors');
    }

    public function test_update_may_keep_its_own_code(): void
    {
        $product = Product::factory()->create(['product_code' => 'P0001']);

        $this->putJson("/api/products/{$product->id}", $this->payload(['product_name' => 'Baru']))->assertOk();
    }

    public function test_list_supports_pagination_search_and_sort(): void
    {
        Product::factory()->create(['product_code' => 'P0001', 'product_name' => 'Apel', 'price' => 3000, 'stock' => 5]);
        Product::factory()->create(['product_code' => 'P0002', 'product_name' => 'Jeruk', 'price' => 1000, 'stock' => 9]);
        Product::factory()->create(['product_code' => 'X0003', 'product_name' => 'Mangga', 'price' => 2000, 'stock' => 1]);

        $this->getJson('/api/products?per_page=2')
            ->assertOk()
            ->assertJsonPath('meta', ['page' => 1, 'per_page' => 2, 'total' => 3, 'total_pages' => 2])
            ->assertJsonCount(2, 'data');

        $this->getJson('/api/products?search=jer')->assertJsonCount(1, 'data')->assertJsonPath('data.0.product_name', 'Jeruk');
        $this->getJson('/api/products?search=x00')->assertJsonCount(1, 'data')->assertJsonPath('data.0.product_name', 'Mangga');
        $this->getJson('/api/products?sort=-price')->assertJsonPath('data.0.product_name', 'Apel');
        $this->getJson('/api/products?sort=stock')->assertJsonPath('data.0.product_name', 'Mangga');
        $this->getJson('/api/products?per_page=1000')->assertUnprocessable();
    }

    public function test_soft_deleted_products_are_hidden_from_the_list(): void
    {
        Product::factory()->create()->delete();
        Product::factory()->create();

        $this->getJson('/api/products')->assertJsonPath('meta.total', 1);
    }
}
