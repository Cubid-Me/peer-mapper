import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import IndexerPage from "../src/app/indexer/page";

describe("Indexer page", () => {
  it("embeds the Moonbeam indexer inside the app shell", () => {
    render(<IndexerPage />);

    expect(screen.getByRole("heading", { name: /Moonbeam indexer/i })).toBeInTheDocument();
    const iframe = screen.getByTitle(/Moonbeam indexer/i);
    expect(iframe).toHaveAttribute("src", "/api/indexer/moonscan");
    expect(
      screen.getByRole("link", { name: /Open Moonbeam indexer in a new tab/i }),
    ).toHaveAttribute("href", "https://moonbeam.moonscan.io/");
  });
});
