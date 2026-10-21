export interface Meta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: Meta;
  errors?: Record<string, string[]>;
}

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface Product {
  id: number;
  product_code: string;
  product_name: string;
  stock: number;
  price: string;
}

export type Gender = "Pria" | "Wanita";

export interface Customer {
  id: string;
  customer_name: string;
  customer_address: string;
  gender: Gender;
  birth_date: string;
  phone: string | null;
}

export interface OrderItem {
  id: number;
  product_id: number;
  product_code: string | null;
  product_name: string | null;
  quantity: number;
  unit_price: string;
  subtotal: string;
}

export interface Order {
  id: number;
  order_number: string;
  order_date: string;
  total_amount: string;
  customer?: { id: string; customer_name: string };
  created_by?: { id: number; name: string };
  items_count?: number;
  items?: OrderItem[];
}

export interface DashboardSummary {
  total_orders: number;
  total_sales: string;
  top_products: { id: number; product_code: string; product_name: string; total_quantity: number; total_sales: string }[];
  low_stock_threshold: number;
  low_stock_products: Product[];
  daily_sales: { date: string; orders: number; sales: string }[];
}
