<?php 

namespace App\Services;

use Illuminate\Validation\ValidationException;

class LoanScheduleService
{
    // Round monetary values to two decimal places using half-up rounding.
    public function money(float $amount): float
    {
        return round($amount, 2, PHP_ROUND_HALF_UP);
    }

    /**
     * Calculate the full reducing-balance schedule.
     *
     * $prepayments and $lateDays are maps keyed by month:
     * [3 => 5000]
     * [2 => 10]
     */
    public function calculate(
        float $principal,
        float $annualRate,
        int $months,
        array $prepayments = [],
        array $lateDays = []
    ): array {
        if (!is_finite($principal) || $principal <= 0) {
            throw ValidationException::withMessages([
                'principal' => 'Principal must be greater than zero.',
            ]);
        }

        if (!is_finite($annualRate) || $annualRate < 0 || $annualRate > 1000) {
            throw ValidationException::withMessages([
                'annual_rate' => 'Annual rate must be between 0 and 1000.',
            ]);
        }

        if ($months < 1 || $months > 600) {
            throw ValidationException::withMessages([
                'n' => 'Term must be between 1 and 600 months.',
            ]);
        }

        $rate = $annualRate / 12 / 100;

        // Rule A: use P / n for zero interest.
        $rawEmi = $rate == 0.0
            ? $principal / $months
            : ($principal * $rate * (1 + $rate) ** $months)
                / ((1 + $rate) ** $months - 1);

        if (!is_finite($rawEmi) || $rawEmi <= 0) {
            throw ValidationException::withMessages([
                'principal' => 'The supplied loan values cannot produce a valid EMI.',
            ]);
        }

        // Rule A: round UP to a multiple of 10.
        // The tiny tolerance avoids floating-point noise at exact multiples.
        $emi = ceil(($rawEmi - 1e-9) / 10) * 10;

        $balance = $this->money($principal);
        $totalInterest = 0.0;
        $totalPenalties = 0.0;
        $totalFees = 0.0;
        $totalPayments = 0.0;
        $rows = [];

        while ($balance > 0 && count($rows) < $months) {
            $month = count($rows) + 1;
            $opening = $balance;

            // Rule B1: round monthly interest half up to 2 decimals.
            $interest = $this->money($opening * $rate);

            // Rule B2: cap principal at the opening balance.
            $principalPaid = $this->money($emi - $interest);

            if ($principalPaid >= $opening) {
                $principalPaid = $opening;
            }

            $payment = $this->money($principalPaid + $interest);
            $balance = $this->money($opening - $principalPaid);

            $prepayment = 0.0;
            $fee = 0.0;

            // Rule C: apply the extra payment after the instalment.
            if (isset($prepayments[$month]) && $balance > 0) {
                $requested = (float) $prepayments[$month];
                $prepayment = $this->money(min($requested, $balance));

                // The fee is based on the amount actually applied.
                $fee = $month <= 12
                    ? $this->money($prepayment * 0.02)
                    : 0.0;

                // The fee is separate and never reduces the balance.
                $balance = $this->money($balance - $prepayment);
            }

            // Rule D: calculate penalty from the actual instalment payment.
            $days = (int) ($lateDays[$month] ?? 0);

            $penalty = $days > 3
                ? $this->money(min(
                    $payment * 0.001 * ($days - 3),
                    $payment * 0.05
                ))
                : 0.0;

            $totalInterest = $this->money($totalInterest + $interest);
            $totalPenalties = $this->money($totalPenalties + $penalty);
            $totalFees = $this->money($totalFees + $fee);
            $totalPayments = $this->money($totalPayments + $payment);

            $rows[] = [
                'month' => $month,
                'opening_balance' => $opening,
                'interest' => $interest,
                'principal' => $principalPaid,
                'payment' => $payment,
                'closing_balance' => $balance,
                'prepayment' => $prepayment,
                'fee' => $fee,
                'late_days' => $days,
                'penalty' => $penalty,
            ];
        }

        // A loan that has already finished cannot receive a later prepayment.
        foreach ($prepayments as $month => $amount) {
            if ((float) $amount > 0 && (int) $month > count($rows)) {
                throw ValidationException::withMessages([
                    "prepayments.$month" =>
                        'Prepayment month is beyond the actual repayment schedule.',
                ]);
            }
        }

        foreach ($lateDays as $month => $days) {
            if ((int) $days > 0 && (int) $month > count($rows)) {
                throw ValidationException::withMessages([
                    "late_days.$month" =>
                        'Late-payment month is beyond the actual repayment schedule.',
                ]);
            }
        }

        return [
            'currency' => 'LKR',
            'principal' => $this->money($principal),
            'annual_rate' => $annualRate,
            'term_months' => $months,
            'emi' => $this->money($emi),
            'instalments' => count($rows),
            'rows' => $rows,
            'totals' => [
                'instalments' => $totalPayments,
                'total_interest' => $totalInterest,
                'total_penalties' => $totalPenalties,
                'total_fees' => $totalFees,
                'total_prepayments' => $this->money(
                    array_sum(array_column($rows, 'prepayment'))
                ),
            ],
        ];
    }

    /**
     * Calculate settlement after instalment m and d additional days.
     */
    public function settlement(
        array $loan,
        int $month,
        int $daysAfter
    ): array {
        if ($month < 1) {
            throw ValidationException::withMessages([
                'm' => 'Settlement month must be at least 1.',
            ]);
        }

        if ($daysAfter < 0) {
            throw ValidationException::withMessages([
                'd' => 'Days after instalment cannot be negative.',
            ]);
        }

        $schedule = $this->calculate(
            (float) $loan['principal'],
            (float) $loan['annual_rate'],
            (int) $loan['n'],
            $loan['prepayments'] ?? [],
            $loan['late_days'] ?? []
        );

        if ($month > $schedule['instalments']) {
            throw ValidationException::withMessages([
                'm' => 'Settlement month exceeds the actual repayment schedule.',
            ]);
        }

        $row = $schedule['rows'][$month - 1];
        $balance = $row['closing_balance'];

        // Rule E: accrued simple interest uses an actual/365 basis.
        $accruedInterest = $this->money(
            $balance * (float) $loan['annual_rate'] / 100 / 365 * $daysAfter
        );

        $feeRate = $month < 24 ? 0.03 : 0.01;
        $closureFee = $this->money($balance * $feeRate);

        return [
            'currency' => 'LKR',
            'month' => $month,
            'days_after' => $daysAfter,
            'balance' => $balance,
            'accrued_interest' => $accruedInterest,
            'closure_fee_rate' => $feeRate,
            'closure_fee' => $closureFee,
            'settlement_amount' => $this->money(
                $balance + $accruedInterest + $closureFee
            ),
        ];
    }
}
