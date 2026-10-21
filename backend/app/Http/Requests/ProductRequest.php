<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Shared by POST (create) and PUT (full update) /api/products. */
class ProductRequest extends FormRequest
{
    public function rules(): array
    {
        $product = $this->route('product');

        return [
            // Unique across soft-deleted rows too: a retired code must not be reused, it still identifies old orders.
            'product_code' => ['required', 'string', 'max:20', Rule::unique('products', 'product_code')->ignore($product)],
            'product_name' => ['required', 'string', 'max:150'],
            'stock' => ['required', 'integer', 'min:0', 'max:4294967295'],
            'price' => ['required', 'numeric', 'gt:0', 'max:9999999999.99', 'decimal:0,2'],
        ];
    }
}
