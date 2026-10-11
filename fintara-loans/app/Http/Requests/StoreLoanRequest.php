<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreLoanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'principal' => ['required', 'numeric', 'gt:0', 'decimal:0,2', 'max:9999999999999.99'],
            'annual_rate' => ['required', 'numeric', 'min:0', 'max:1000', 'decimal:0,4'],
            'n' => ['required', 'integer', 'min:1', 'max:600'],

            'prepayments' => ['sometimes', 'array'],
            'prepayments.*' => ['required', 'numeric', 'gt:0', 'decimal:0,2'],

            'late_days' => ['sometimes', 'array'],
            'late_days.*' => ['required', 'integer', 'min:0', 'max:36500'],
        ];
    }
}

