<?php

declare(strict_types=1);

namespace App\Exceptions;

use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use RuntimeException;

class InsufficientStockException extends RuntimeException
{
    /**
     * @param  array<string, array<int, string>>  $errors  keyed by "items.{index}.quantity"
     */
    public function __construct(public readonly array $errors)
    {
        parent::__construct('Stok tidak mencukupi');
    }

    public function render(): JsonResponse
    {
        return ApiResponse::error($this->getMessage(), 409, $this->errors);
    }
}
