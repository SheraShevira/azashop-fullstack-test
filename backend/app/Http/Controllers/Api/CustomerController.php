<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CustomerRequest;
use App\Http\Resources\CustomerResource;
use App\Models\Customer;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class CustomerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'page' => ['integer', 'min:1'],
            'per_page' => ['integer', 'min:1', 'max:100'],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $customers = Customer::query()
            ->when($request->query('search'), function ($query, string $search) {
                $term = '%'.mb_strtolower(addcslashes($search, '%_\\')).'%';
                $query->whereRaw('LOWER(customer_name) LIKE ?', [$term]);
            })
            ->orderBy('customer_name')
            ->orderBy('id')
            ->paginate((int) $request->query('per_page', 10));

        return ApiResponse::paginated($customers, CustomerResource::class);
    }

    public function show(Customer $customer): JsonResponse
    {
        return ApiResponse::success(CustomerResource::make($customer)->resolve());
    }

    public function store(CustomerRequest $request): JsonResponse
    {
        $customer = Customer::create($request->validated());

        return ApiResponse::created(CustomerResource::make($customer->refresh())->resolve(), 'Pelanggan berhasil ditambahkan');
    }

    public function update(CustomerRequest $request, Customer $customer): JsonResponse
    {
        $customer->update($request->validated());

        return ApiResponse::success(CustomerResource::make($customer)->resolve(), 'Pelanggan berhasil diperbarui');
    }

    public function destroy(Customer $customer): Response
    {
        $customer->delete();

        return response()->noContent();
    }
}
