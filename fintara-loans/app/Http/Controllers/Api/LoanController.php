<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\AddLoanAdjustmentRequest;
use App\Http\Requests\StoreLoanRequest;
use App\Models\Loan;
use App\Services\LoanScheduleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;

class LoanController extends Controller
{
    public function __construct(
        private readonly LoanScheduleService $scheduleService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $loans = Loan::query()
            ->where('user_id', $request->user()->id)
            ->latest()
            ->paginate(20);

        return response()->json($loans);
    }

    
    public function store(StoreLoanRequest $request): JsonResponse
    {
        $data = $request->validated();

        $prepayments = $data['prepayments'] ?? [];
        $lateDays = $data['late_days'] ?? [];

        $this->validateMonthKeys(
            $prepayments,
            (int) $data['n'],
            'prepayments'
        );

        $this->validateMonthKeys(
            $lateDays,
            (int) $data['n'],
            'late_days'
        );

        // Validate the schedule before saving.
        $this->scheduleService->calculate(
            (float) $data['principal'],
            (float) $data['annual_rate'],
            (int) $data['n'],
            $prepayments,
            $lateDays
        );

        $loan = DB::transaction(function () use (
            $request,
            $data,
            $prepayments,
            $lateDays
        ) {
            $monthYear = now()->format('m-Y');
            $prefix = 'LN-' . $monthYear . '-';

            // Lock the relevant loan-code namespace while generating
            // the next sequence number.
            $latestLoan = Loan::query()
                ->where('loan_code', 'like', $prefix . '%')
                ->orderByRaw(
                    'CAST(SUBSTRING_INDEX(loan_code, "-", -1) AS UNSIGNED) DESC'
                )
                ->lockForUpdate()
                ->first();

            $nextNumber = $latestLoan
                ? ((int) substr($latestLoan->loan_code, strrpos($latestLoan->loan_code, '-') + 1)) + 1
                : 1;

            $code = $prefix . str_pad(
                (string) $nextNumber,
                2,
                '0',
                STR_PAD_LEFT
            );

            return Loan::create([
                'loan_code' => $code,
                'user_id' => $request->user()->id,
                'principal' => $data['principal'],
                'annual_rate' => $data['annual_rate'],
                'term_months' => $data['n'],
                'prepayments' => $prepayments,
                'late_days' => $lateDays,
                'currency' => 'LKR',
            ]);
        }, 3);

        return response()->json([
            'message' => 'Loan created successfully.',
            'loan' => $loan,
        ], 201);
    }


    public function show(Request $request, string $loan): JsonResponse
    {
        // Ownership is enforced in the database query.
        $record = Loan::query()
            ->where('user_id', $request->user()->id)
            ->where('id', $loan)
            ->firstOrFail();

        return response()->json([
            'loan' => $record,
        ]);
    }

    public function addAdjustment(
        AddLoanAdjustmentRequest $request,
        string $loan
    ): JsonResponse {
        $record = Loan::query()
            ->where('user_id', $request->user()->id)
            ->where('id', $loan)
            ->firstOrFail();
        $data = $request->validated();
        $month = (int) $data['month'];

        if ($month > $record->term_months) {
            throw ValidationException::withMessages([
                'month' => [
                    "Month must be between 1 and {$record->term_months}.",
                ],
            ]);
        }

        $prepayments = $record->prepayments ?? [];
        $lateDays = $record->late_days ?? [];

        if (isset($data['prepayment'])) {
            $prepayments[$month] = $this->scheduleService->money(
                (float) ($prepayments[$month] ?? 0)
                    + (float) $data['prepayment']
            );
        }

        if (isset($data['late_days'])) {
            $lateDays[$month] = (int) $data['late_days'];
        }

        $schedule = $this->scheduleService->calculate(
            (float) $record->principal,
            (float) $record->annual_rate,
            (int) $record->term_months,
            $prepayments,
            $lateDays
        );

        if ($month > $schedule['instalments']) {
            throw ValidationException::withMessages([
                'month' => [
                    'Adjustment month exceeds the actual repayment schedule.',
                ],
            ]);
        }

        $record->update([
            'prepayments' => $prepayments,
            'late_days' => $lateDays,
        ]);

        return response()->json([
            'message' => 'Installment adjustment added successfully.',
            'loan' => $record->fresh(),
            'schedule' => $schedule,
        ]);
    }

    private function validateMonthKeys(
        array $values,
        int $term,
        string $field
    ): void {
        foreach ($values as $month => $value) {
            if (
                !ctype_digit((string) $month)
                || (int) $month < 1
                || (int) $month > $term
            ) {
                throw ValidationException::withMessages([
                    "$field.$month" => [
                        "Month must be between 1 and $term.",
                    ],
                ]);
            }
        }
    }
}
