// Instant, AI-free photo fingerprints ("the shopkeeper recognises the item on sight").
//
// Every catalogue photo is reduced once (in the background) to a 128-bit
// perceptual fingerprint. A customer photo is fingerprinted in a few
// milliseconds and compared against the store's memorised fingerprints, so a
// catalogue photo sent back over Messenger (resized, recompressed, lightly
// cropped) is recognised without calling any AI model.
import { decode as decodeJpeg } from "jpeg-js";
import { decode as decodePng } from "fast-png";

type Rgba = { width: number; height: number; data: Uint8Array | Uint8ClampedArray | Uint16Array; channels: number };

function sniff(bytes: Uint8Array): "jpeg" | "png" | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  return null;
}

function decode(bytes: Uint8Array): Rgba | null {
  const kind = sniff(bytes);
  try {
    if (kind === "jpeg") {
      const img = decodeJpeg(bytes, { useTArray: true, formatAsRGBA: true, maxResolutionInMP: 40, maxMemoryUsageInMB: 256 });
      return { width: img.width, height: img.height, data: img.data, channels: 4 };
    }
    if (kind === "png") {
      const img = decodePng(bytes);
      return { width: img.width, height: img.height, data: img.data as any, channels: img.channels };
    }
  } catch {
    return null;
  }
  return null;
}

/** Box-average the image into a w×h grayscale grid (transparent pixels on white). */
function grayGrid(img: Rgba, w: number, h: number): Float64Array {
  const out = new Float64Array(w * h);
  const counts = new Float64Array(w * h);
  const { width, height, data, channels } = img;
  const max = data instanceof Uint16Array ? 65535 : 255;
  // Sample at most ~256×256 pixels for speed.
  const step = Math.max(1, Math.floor(Math.max(width, height) / 256));
  for (let y = 0; y < height; y += step) {
    const gy = Math.min(h - 1, Math.floor((y * h) / height));
    for (let x = 0; x < width; x += step) {
      const gx = Math.min(w - 1, Math.floor((x * w) / width));
      const i = (y * width + x) * channels;
      let r: number, g: number, b: number, a = 1;
      if (channels >= 3) {
        r = data[i]! / max; g = data[i + 1]! / max; b = data[i + 2]! / max;
        if (channels === 4) a = data[i + 3]! / max;
      } else {
        r = g = b = data[i]! / max;
        if (channels === 2) a = data[i + 1]! / max;
      }
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      out[gy * w + gx] += lum * a + (1 - a);
      counts[gy * w + gx] += 1;
    }
  }
  for (let i = 0; i < out.length; i += 1) out[i] = counts[i] ? out[i]! / counts[i]! : 1;
  return out;
}

function bitsToHex(bits: number[]) {
  let hex = "";
  for (let i = 0; i < bits.length; i += 4) {
    hex += ((bits[i]! << 3) | (bits[i + 1]! << 2) | (bits[i + 2]! << 1) | bits[i + 3]!).toString(16);
  }
  return hex;
}

/** 128-bit fingerprint (64-bit difference hash + 64-bit average hash) as 32 hex chars. */
export function fingerprintImage(bytes: Uint8Array): string | null {
  const img = decode(bytes);
  if (!img || !img.width || !img.height) return null;
  const d = grayGrid(img, 9, 8);
  const bits: number[] = [];
  for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) bits.push(d[y * 9 + x]! > d[y * 9 + x + 1]! ? 1 : 0);
  const a = grayGrid(img, 8, 8);
  const mean = a.reduce((s, v) => s + v, 0) / a.length;
  for (let i = 0; i < 64; i += 1) bits.push(a[i]! > mean ? 1 : 0);
  return bitsToHex(bits);
}

const POP = Array.from({ length: 16 }, (_, n) => ((n >> 3) & 1) + ((n >> 2) & 1) + ((n >> 1) & 1) + (n & 1));

export function fingerprintDistance(left: string, right: string): number {
  if (left.length !== right.length) return 128;
  let distance = 0;
  for (let i = 0; i < left.length; i += 1) distance += POP[parseInt(left[i]!, 16) ^ parseInt(right[i]!, 16)]!;
  return distance;
}

/** Same photo: close fingerprint AND clearly closer than the next product. */
export const FINGERPRINT_MATCH_MAX = 24;
export const FINGERPRINT_MIN_MARGIN = 12;
export const FINGERPRINT_CANDIDATE_MAX = 34;
