<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreOrderRequest;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Services\OrderService;
use App\Support\ApiResponse;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class OrderController extends Controller
{
    public function __construct(private readonly OrderService $orders) {}

    public function index(Request $request): JsonResponse
    {
        $orders = $this->filtered($request)
            ->with(['customer', 'creator'])
            ->withCount('items')
            ->latest('order_date')
            ->latest('id')
            ->paginate((int) $request->query('per_page', 10));

        return ApiResponse::paginated($orders, OrderResource::class);
    }

    public function show(Order $order): JsonResponse
    {
        $order->load(['customer', 'creator', 'items.product']);

        return ApiResponse::success(OrderResource::make($order)->resolve());
    }

    public function store(StoreOrderRequest $request): JsonResponse
    {
        $order = $this->orders->create($request->validated(), $request->user());

        return ApiResponse::created(OrderResource::make($order)->resolve(), 'Order berhasil dibuat');
    }

    /** Bonus: CSV export of the (filtered) order history. */
    public function export(Request $request): StreamedResponse
    {
        $query = $this->filtered($request)->with(['customer'])->withCount('items')->latest('order_date')->latest('id');

        return response()->streamDownload(function () use ($query) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['order_number', 'order_date', 'customer', 'items', 'total_amount']);

            foreach ($query->lazyById() as $order) {
                fputcsv($out, [
                    $order->order_number,
                    $order->order_date->format('Y-m-d H:i:s'),
                    $this->csvSafe($order->customer->customer_name),
                    $order->items_count,
                    $order->total_amount,
                ]);
            }

            fclose($out);
        }, 'orders.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    private function filtered(Request $request): Builder
    {
        $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'customer_id' => ['nullable', 'uuid'],
            'page' => ['integer', 'min:1'],
            'per_page' => ['integer', 'min:1', 'max:100'],
        ]);

        return Order::query()
            ->when($request->query('from'), fn (Builder $q, string $from) => $q->where('order_date', '>=', $from.' 00:00:00'))
            ->when($request->query('to'), fn (Builder $q, string $to) => $q->where('order_date', '<=', $to.' 23:59:59'))
            ->when($request->query('customer_id'), fn (Builder $q, string $id) => $q->where('customer_id', $id));
    }

    /** Neutralise spreadsheet formula injection in exported text cells. */
    private function csvSafe(string $value): string
    {
        return preg_match('/^[=+\-@\t\r]/', $value) ? "'".$value : $value;
    }
}
