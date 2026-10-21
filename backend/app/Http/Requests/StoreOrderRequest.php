<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Note: price / total are intentionally NOT accepted; the server derives them from the products table.
 */
class StoreOrderRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'customer_id' => [
                'required', 'uuid',
                Rule::exists('customers', 'id')->whereNull('deleted_at'),
            ],
            'items' => ['required', 'array', 'min:1', 'max:100'],
            // distinct: one line per product, otherwise per-line stock checks could be bypassed by splitting a quantity.
            'items.*.product_id' => [
                'required', 'integer', 'distinct',
                Rule::exists('products', 'id')->whereNull('deleted_at'),
            ],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:1000000'],
        ];
    }

    public function messages(): array
    {
        return [
            'items.*.product_id.distinct' => 'Produk duplikat dalam satu order; gabungkan jumlahnya.',
            'items.*.product_id.exists' => 'Produk tidak ditemukan.',
            'customer_id.exists' => 'Pelanggan tidak ditemukan.',
        ];
    }
}
