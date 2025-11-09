import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import IndexerPage from "../src/app/(routes)/indexer/page";

describe("Indexer page", () => {
  it("embeds the Moonbeam indexer inside the app shell", () => {
    render(<IndexerPage />);

    expect(screen.getByRole("heading", { name: /Moonbeam indexer/i })).toBeInTheDocument();
    const iframe = screen.getByTitle(/Moonbeam indexer/i);
    expect(iframe).toHaveAttribute("src", "https://moonbeam.moonscan.io/");
  });
});
