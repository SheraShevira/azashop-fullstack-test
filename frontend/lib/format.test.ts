import { describe, expect, it } from "vitest";
import { formatDate, formatRupiah } from "./format";

describe("formatRupiah", () => {
  it("uses Indonesian grouping with an Rp prefix", () => {
    expect(formatRupiah("12000.00")).toBe("Rp 12.000");
    expect(formatRupiah(36000)).toBe("Rp 36.000");
    expect(formatRupiah("1250000.50")).toBe("Rp 1.250.000,5");
  });
});

describe("formatDate", () => {
  it("formats in Indonesian", () => {
    expect(formatDate("2026-10-21T10:00:00+07:00")).toBe("21 Oktober 2026");
  });
});
