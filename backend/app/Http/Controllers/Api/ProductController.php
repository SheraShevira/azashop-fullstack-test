<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ProductRequest;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class ProductController extends Controller
{
    /** Public sort keys -> column. Prefix with "-" for descending, e.g. ?sort=-price. */
    private const SORTS = [
        'name' => 'product_name',
        'product_name' => 'product_name',
        'price' => 'price',
        'stock' => 'stock',
        'created_at' => 'created_at',
    ];

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'page' => ['integer', 'min:1'],
            'per_page' => ['integer', 'min:1', 'max:100'],
            'search' => ['nullable', 'string', 'max:100'],
            'sort' => ['nullable', 'string'],
        ]);

        $sort = (string) $request->query('sort', 'product_name');
        $direction = str_starts_with($sort, '-') ? 'desc' : 'asc';
        $column = self::SORTS[ltrim($sort, '-')] ?? 'product_name';

        $products = Product::query()
            ->when($request->query('search'), function ($query, string $search) {
                $term = '%'.mb_strtolower(addcslashes($search, '%_\\')).'%';
                $query->where(fn ($q) => $q
                    ->whereRaw('LOWER(product_name) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(product_code) LIKE ?', [$term]));
            })
            ->orderBy($column, $direction)
            ->orderBy('id')
            ->paginate((int) $request->query('per_page', 10));

        return ApiResponse::paginated($products, ProductResource::class);
    }

    public function show(Product $product): JsonResponse
    {
        return ApiResponse::success(ProductResource::make($product)->resolve());
    }

    public function store(ProductRequest $request): JsonResponse
    {
        $product = Product::create($request->validated());

        return ApiResponse::created(ProductResource::make($product)->resolve(), 'Produk berhasil ditambahkan');
    }

    public function update(ProductRequest $request, Product $product): JsonResponse
    {
        $product->update($request->validated());

        return ApiResponse::success(ProductResource::make($product)->resolve(), 'Produk berhasil diperbarui');
    }

    public function destroy(Product $product): Response
    {
        $product->delete();

        return response()->noContent();
    }
}
