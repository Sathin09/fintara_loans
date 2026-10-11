<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\LoanScheduleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class LoanCalculationController extends Controller
{
    public function __construct(
        private readonly LoanScheduleService $service
    ) {}

    private function validateLoan(Request $request): array
    {
        $data = $request->validate([
            'principal' => [
                'required', 'numeric', 'gt:0',
                'decimal:0,2', 'max:9999999999999.99',
            ],
            'annual_rate' => [
                'required', 'numeric', 'min:0', 'max:1000',
                'decimal:0,4',
            ],
            'n' => ['required', 'integer', 'min:1', 'max:600'],

            'prepayments' => ['sometimes', 'array'],
            'prepayments.*' => [
                'required', 'numeric', 'gt:0', 'decimal:0,2',
            ],

            'late_days' => ['sometimes', 'array'],
            'late_days.*' => [
                'required', 'integer', 'min:0', 'max:36500',
            ],
        ]);

        foreach (['prepayments', 'late_days'] as $field) {
            foreach ($data[$field] ?? [] as $month => $value) {
                if (
                    !ctype_digit((string) $month)
                    || (int) $month < 1
                    || (int) $month > (int) $data['n']
                ) {
                    throw ValidationException::withMessages([
                        "$field.$month" => [
                            "Month must be between 1 and {$data['n']}.",
                        ],
                    ]);
                }
            }
        }

        return $data;
    }

    public function schedule(Request $request): JsonResponse
    {
        $data = $this->validateLoan($request);

        $result = $this->service->calculate(
            (float) $data['principal'],
            (float) $data['annual_rate'],
            (int) $data['n'],
            $data['prepayments'] ?? [],
            $data['late_days'] ?? []
        );

        return response()->json($result);
    }

    public function settlement(Request $request): JsonResponse
    {
        $data = $this->validateLoan($request);

        $extra = $request->validate([
            'm' => ['required', 'integer', 'min:1', 'max:600'],
            'd' => ['required', 'integer', 'min:0', 'max:36500'],
        ]);

        $result = $this->service->settlement(
            $data,
            (int) $extra['m'],
            (int) $extra['d']
        );

        return response()->json($result);
    }
}

