import "@testing-library/jest-dom/vitest";

import { vi } from "vitest";

vi.mock("jsqr", () => ({
  default: vi.fn(),
}));
