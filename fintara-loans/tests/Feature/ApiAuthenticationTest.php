<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Loan;
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

    public function test_saved_loan_accepts_an_additional_payment_and_late_days(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $loan = Loan::create([
            'loan_code' => 'LN-10-2026-01',
            'user_id' => $user->id,
            'principal' => 120000,
            'annual_rate' => 12,
            'term_months' => 12,
            'prepayments' => ['2' => 5000],
            'late_days' => ['3' => 5],
            'currency' => 'LKR',
        ]);

        $response = $this->patchJson(
            "/api/loans/{$loan->id}/adjustments",
            [
                'month' => 2,
                'prepayment' => 2500,
                'late_days' => 8,
            ]
        );

        $response
            ->assertOk()
            ->assertJsonPath('loan.prepayments.2', 7500)
            ->assertJsonPath('loan.late_days.2', 8)
            ->assertJsonPath('loan.late_days.3', 5)
            ->assertJsonPath('schedule.rows.1.prepayment', 7500)
            ->assertJsonPath('schedule.rows.1.late_days', 8);

        $this->assertSame(7500.0, (float) $loan->fresh()->prepayments[2]);
        $this->assertSame(8, $loan->fresh()->late_days[2]);
    }

    public function test_user_cannot_add_adjustments_to_another_users_loan(): void
    {
        $loanOwner = User::factory()->create();
        $loan = Loan::create([
            'loan_code' => 'LN-10-2026-02',
            'user_id' => $loanOwner->id,
            'principal' => 120000,
            'annual_rate' => 12,
            'term_months' => 12,
            'prepayments' => [],
            'late_days' => [],
            'currency' => 'LKR',
        ]);

        Sanctum::actingAs(User::factory()->create());

        $this->patchJson("/api/loans/{$loan->id}/adjustments", [
            'month' => 2,
            'late_days' => 8,
        ])->assertNotFound();
    }
}
