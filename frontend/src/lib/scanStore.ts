import { create } from "zustand";

import type { VerifyQrResponse } from "./api";

type ScanResult = {
  targetCubid: string;
  viewerCubid: string;
  challengeId: string;
  expiresAt: number;
  verifiedAt: number;
  overlaps: VerifyQrResponse["overlaps"];
};

type ScanState = {
  lastResult: ScanResult | null;
  setResult: (result: ScanResult) => void;
  reset: () => void;
};

export const useScanStore = create<ScanState>((set) => ({
  lastResult: null,
  setResult: (result) => set({ lastResult: result }),
  reset: () => set({ lastResult: null }),
}));
