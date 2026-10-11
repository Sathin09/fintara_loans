<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Loan extends Model
{
    protected $fillable = [
        'loan_code',
        'user_id',
        'principal',
        'annual_rate',
        'term_months',
        'prepayments',
        'late_days',
        'currency',
    ];

    protected function casts(): array
    {
        return [
            'principal' => 'decimal:2',
            'annual_rate' => 'decimal:4',
            'term_months' => 'integer',
            'prepayments' => 'array',
            'late_days' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
