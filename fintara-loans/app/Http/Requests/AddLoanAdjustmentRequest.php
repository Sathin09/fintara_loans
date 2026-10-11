<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AddLoanAdjustmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'month' => ['required', 'integer', 'min:1', 'max:600'],
            'prepayment' => [
                'required_without:late_days',
                'nullable',
                'numeric',
                'gt:0',
                'decimal:0,2',
            ],
            'late_days' => [
                'required_without:prepayment',
                'nullable',
                'integer',
                'min:0',
                'max:36500',
            ],
        ];
    }
}
