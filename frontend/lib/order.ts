export interface DraftLine {
  key: string;
  productId: string;
  quantity: string;
}

interface PricedProduct {
  id: number;
  price: string;
}

/** Display-only preview; the server recomputes everything and is the source of truth. Works in integer cents. */
export function lineSubtotalCents(line: DraftLine, products: PricedProduct[]): number {
  const product = products.find((p) => String(p.id) === line.productId);
  const quantity = Number(line.quantity);
  if (!product || !Number.isInteger(quantity) || quantity < 1) return 0;
  return Math.round(Number(product.price) * 100) * quantity;
}

export function orderTotalCents(lines: DraftLine[], products: PricedProduct[]): number {
  return lines.reduce((sum, line) => sum + lineSubtotalCents(line, products), 0);
}

/** Server returns validation keys like "items.1.quantity"; group them by line index. */
export function itemErrors(errors: Record<string, string[]>): Record<number, string> {
  const result: Record<number, string> = {};
  for (const [key, messages] of Object.entries(errors)) {
    const match = /^items\.(\d+)\./.exec(key);
    if (match) result[Number(match[1])] ??= messages[0];
  }
  return result;
}
