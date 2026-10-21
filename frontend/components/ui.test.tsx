import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EmptyState, Field, Pagination } from "./ui";

describe("Field", () => {
  it("links the label to the control and exposes the error", () => {
    render(<Field label="Harga" error="Harga harus lebih dari 0">{(props) => <input {...props} />}</Field>);

    const input = screen.getByLabelText("Harga");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Harga harus lebih dari 0");
  });
});

describe("Pagination", () => {
  const meta = { page: 2, per_page: 10, total: 35, total_pages: 4 };

  it("navigates between pages", async () => {
    const onPage = vi.fn();
    render(<Pagination meta={meta} onPage={onPage} />);

    await userEvent.click(screen.getByRole("button", { name: "Berikutnya" }));
    await userEvent.click(screen.getByRole("button", { name: "Sebelumnya" }));

    expect(onPage).toHaveBeenNthCalledWith(1, 3);
    expect(onPage).toHaveBeenNthCalledWith(2, 1);
  });

  it("disables the previous button on the first page", () => {
    render(<Pagination meta={{ ...meta, page: 1 }} onPage={() => {}} />);
    expect(screen.getByRole("button", { name: "Sebelumnya" })).toBeDisabled();
  });
});

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(<EmptyState title="Belum ada produk" description="Tambahkan produk pertama Anda." />);
    expect(screen.getByText("Belum ada produk")).toBeInTheDocument();
  });
});
