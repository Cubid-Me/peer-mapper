import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "../src/app/page";

describe("App navigation", () => {
  it("links to every core route in order", () => {
    render(<Home />);

    const links = screen.getAllByRole("link");
    const hrefs = links.map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual([
      "/(routes)/signin",
      "/(routes)/new-user",
      "/(routes)/circle",
      "/(routes)/profile",
      "/(routes)/vouch",
      "/(routes)/scan",
      "/(routes)/results",
    ]);
  });
});
