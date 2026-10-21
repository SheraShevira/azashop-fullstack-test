<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_returns_token_and_user(): void
    {
        User::factory()->create(['email' => 'admin@azatech.id', 'password' => 'password']);

        $this->postJson('/api/auth/login', ['email' => 'admin@azatech.id', 'password' => 'password'])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.user.email', 'admin@azatech.id')
            ->assertJsonStructure(['data' => ['token', 'token_type']]);
    }

    public function test_login_with_wrong_password_is_rejected(): void
    {
        User::factory()->create(['email' => 'admin@azatech.id', 'password' => 'password']);

        $this->postJson('/api/auth/login', ['email' => 'admin@azatech.id', 'password' => 'salah'])
            ->assertUnauthorized()
            ->assertJsonPath('success', false);
    }

    public function test_requests_without_token_are_unauthorized(): void
    {
        foreach (['/api/auth/me', '/api/products', '/api/customers', '/api/orders', '/api/dashboard/summary'] as $url) {
            $this->getJson($url)->assertUnauthorized()->assertJsonPath('success', false);
        }
    }

    public function test_me_and_logout_use_the_bearer_token(): void
    {
        $user = User::factory()->create(['password' => 'password']);
        $token = $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'password'])->json('data.token');

        $this->withToken($token)->getJson('/api/auth/me')->assertOk()->assertJsonPath('data.id', $user->id);

        $this->withToken($token)->postJson('/api/auth/logout')->assertOk();
        $this->assertDatabaseCount('personal_access_tokens', 0);

        // The Auth guard caches the resolved user inside a test process; reset it to simulate a fresh request.
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/auth/me')->assertUnauthorized();
    }
}
