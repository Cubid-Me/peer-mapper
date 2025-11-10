declare module "jsqr" {
  type InversionAttempt = "dontInvert" | "onlyInvert" | "attemptBoth" | "invertFirst";

  interface Point {
    x: number;
    y: number;
  }

  interface QRLocation {
    topLeftCorner: Point;
    topRightCorner: Point;
    bottomLeftCorner: Point;
    bottomRightCorner: Point;
    topLeftFinderPattern: Point;
    topRightFinderPattern: Point;
    bottomLeftFinderPattern: Point;
  }

  interface QRCodeChunk {
    type: string;
    text?: string;
    byteLength?: number;
  }

  interface QRCode {
    binaryData: Uint8ClampedArray;
    data: string;
    chunks: QRCodeChunk[];
    version: number;
    location: QRLocation;
  }

  interface Options {
    inversionAttempts?: InversionAttempt;
  }

  export default function jsQR(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    options?: Options,
  ): QRCode | null;
}
