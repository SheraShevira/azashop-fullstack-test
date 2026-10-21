import { describe, expect, it } from "vitest";
import { itemErrors, orderTotalCents, lineSubtotalCents } from "./order";

const products = [
  { id: 1, price: "12000.00" },
  { id: 3, price: "0.10" },
];

describe("order totals", () => {
  it("sums line subtotals in cents", () => {
    const lines = [
      { key: "a", productId: "1", quantity: "2" },
      { key: "b", productId: "3", quantity: "3" },
    ];
    expect(lineSubtotalCents(lines[0], products)).toBe(2_400_000);
    expect(orderTotalCents(lines, products)).toBe(2_400_030); // no 0.1*3 float drift
  });

  it("ignores incomplete or invalid lines", () => {
    expect(orderTotalCents([{ key: "a", productId: "", quantity: "2" }], products)).toBe(0);
    expect(orderTotalCents([{ key: "a", productId: "1", quantity: "0" }], products)).toBe(0);
    expect(orderTotalCents([{ key: "a", productId: "1", quantity: "1.5" }], products)).toBe(0);
  });
});

describe("itemErrors", () => {
  it("maps server keys to line indexes", () => {
    expect(
      itemErrors({
        "items.1.quantity": ["Stok Hydrococo 150ml tersisa 3, diminta 5"],
        "items.2.product_id": ["Produk tidak ditemukan."],
        customer_id: ["x"],
      }),
    ).toEqual({ 1: "Stok Hydrococo 150ml tersisa 3, diminta 5", 2: "Produk tidak ditemukan." });
  });
});
