/**
 * ZBar WASM scanner wrapper.
 * Handles initialization and provides a simple scan interface for ImageData.
 * Returns all detected QR codes in a single call (native multi-code support).
 */

import { scanImageData, ZBarSymbol } from "@undecaf/zbar-wasm";

export interface ZBarResult {
  data: string;
  points: { x: number; y: number }[];
}

let initialized = false;

/**
 * Scan an ImageData for all QR codes using zbar-wasm.
 * Returns all detected codes with their polygon corner points.
 */
export async function scanWithZBar(imageData: ImageData): Promise<ZBarResult[]> {
  if (!initialized) {
    // First call warms up the WASM module
    initialized = true;
  }

  const symbols: ZBarSymbol[] = await scanImageData(imageData);

  return symbols.map((s) => ({
    data: s.decode("utf-8"),
    points: s.points.map((p) => ({ x: p.x, y: p.y })),
  }));
}
