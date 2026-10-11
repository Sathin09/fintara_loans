<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ApiAuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_unauthenticated_api_requests_return_json_without_accept_header(): void
    {
        $response = $this
            ->withHeader('Origin', 'http://localhost:5173')
            ->get('/api/loans');

        $response
            ->assertUnauthorized()
            ->assertJson(['message' => 'Unauthenticated.'])
            ->assertHeader(
                'Access-Control-Allow-Origin',
                'http://localhost:5173'
            );
    }

    public function test_authenticated_api_requests_can_load_loans_with_cors_headers(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $response = $this
            ->withHeader('Origin', 'http://localhost:5173')
            ->get('/api/loans');

        $response
            ->assertOk()
            ->assertJsonPath('data', [])
            ->assertHeader(
                'Access-Control-Allow-Origin',
                'http://localhost:5173'
            );
    }

    public function test_login_tokens_expire_after_24_hours(): void
    {
        $user = User::factory()->create();
        $issuedAt = now();
        $this->travelTo($issuedAt);

        $response = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $expiresAt = $issuedAt->copy()->addHours(24);
        $response
            ->assertOk()
            ->assertJsonPath('expires_at', $expiresAt->toISOString());

        $token = $user->tokens()->latest('id')->firstOrFail();
        $this->assertSame(
            $expiresAt->getTimestamp(),
            $token->expires_at->getTimestamp()
        );

        $this->travelTo($expiresAt->copy()->addSecond());
        $this->withToken($response->json()['token'])
            ->getJson('/api/user')
            ->assertUnauthorized();
    }
}
