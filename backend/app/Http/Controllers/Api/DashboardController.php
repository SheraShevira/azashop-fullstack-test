<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    private const CHART_DAYS = 30;

    public function summary(): JsonResponse
    {
        $topProducts = OrderItem::query()
            ->join('products', 'products.id', '=', 'order_items.product_id') // includes soft-deleted products on purpose
            ->groupBy('products.id', 'products.product_code', 'products.product_name')
            ->selectRaw('products.id, products.product_code, products.product_name, SUM(order_items.quantity) AS total_quantity, SUM(order_items.subtotal) AS total_sales')
            ->orderByDesc('total_quantity')
            ->orderBy('products.id')
            ->limit(5)
            ->get()
            ->map(fn ($row) => [
                'id' => $row->id,
                'product_code' => $row->product_code,
                'product_name' => $row->product_name,
                'total_quantity' => (int) $row->total_quantity,
                'total_sales' => number_format((float) $row->total_sales, 2, '.', ''),
            ]);

        $lowStock = Product::query()
            ->where('stock', '<', Product::LOW_STOCK_THRESHOLD)
            ->orderBy('stock')
            ->orderBy('product_name')
            ->get();

        return ApiResponse::success([
            'total_orders' => Order::count(),
            'total_sales' => number_format((float) Order::sum('total_amount'), 2, '.', ''),
            'top_products' => $topProducts,
            'low_stock_threshold' => Product::LOW_STOCK_THRESHOLD,
            'low_stock_products' => ProductResource::collection($lowStock)->resolve(),
            'daily_sales' => $this->dailySales(),
        ]);
    }

    /** Bonus: sales per day for the last 30 days (days without orders are returned as 0). */
    private function dailySales(): array
    {
        $from = now()->subDays(self::CHART_DAYS - 1)->startOfDay();

        $rows = Order::query()
            ->where('order_date', '>=', $from)
            ->groupBy(DB::raw('DATE(order_date)'))
            ->selectRaw('DATE(order_date) AS day, COUNT(*) AS orders, SUM(total_amount) AS sales')
            ->get()
            ->keyBy(fn ($row) => substr((string) $row->day, 0, 10));

        $series = [];
        for ($i = 0; $i < self::CHART_DAYS; $i++) {
            $day = $from->copy()->addDays($i)->format('Y-m-d');
            $row = $rows->get($day);

            $series[] = [
                'date' => $day,
                'orders' => (int) ($row->orders ?? 0),
                'sales' => number_format((float) ($row->sales ?? 0), 2, '.', ''),
            ];
        }

        return $series;
    }
}
