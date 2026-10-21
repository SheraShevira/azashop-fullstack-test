<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CustomerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Sanctum::actingAs(User::factory()->create());
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'customer_name' => 'Budi Santoso',
            'customer_address' => 'Jakarta',
            'gender' => 'Pria',
            'birth_date' => '1995-02-10',
            'phone' => '081234567890',
        ], $overrides);
    }

    public function test_crud_flow(): void
    {
        $id = $this->postJson('/api/customers', $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.birth_date', '1995-02-10')
            ->json('data.id');

        $this->assertTrue(\Illuminate\Support\Str::isUuid($id));

        $this->putJson("/api/customers/{$id}", $this->payload(['customer_name' => 'Budi S.', 'phone' => null]))
            ->assertOk()
            ->assertJsonPath('data.customer_name', 'Budi S.');

        $this->deleteJson("/api/customers/{$id}")->assertNoContent();
        $this->getJson("/api/customers/{$id}")->assertNotFound();
        $this->assertSoftDeleted('customers', ['id' => $id]);
    }

    public function test_validation(): void
    {
        $this->postJson('/api/customers', [])->assertUnprocessable()
            ->assertJsonValidationErrors(['customer_name', 'customer_address', 'gender', 'birth_date'], 'errors');
        $this->postJson('/api/customers', $this->payload(['gender' => 'Lainnya']))->assertUnprocessable()->assertJsonValidationErrors(['gender'], 'errors');
        $this->postJson('/api/customers', $this->payload(['birth_date' => '2999-01-01']))->assertUnprocessable();
        $this->postJson('/api/customers', $this->payload(['phone' => 'abc']))->assertUnprocessable();
    }

    public function test_list_searches_by_name_and_paginates(): void
    {
        Customer::factory()->create(['customer_name' => 'Budi Santoso']);
        Customer::factory()->create(['customer_name' => 'Siti Aminah']);
        Customer::factory()->create(['customer_name' => 'Budiman']);

        $this->getJson('/api/customers?search=BUDI')->assertJsonCount(2, 'data')->assertJsonPath('meta.total', 2);
        $this->getJson('/api/customers?per_page=2')->assertJsonPath('meta.total_pages', 2);
    }
}
