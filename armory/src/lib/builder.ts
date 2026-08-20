// Armor builder shareable-link codec.
//
// The original site encodes the builder state as:
//   "slot:itemId;slot:itemId;..." -> zlib-compressed -> base64 -> urlencoded
// (we verified this by decoding the site's own ab= params: the payload is a
// zlib stream with header 0x78 0xda, i.e. RFC 1950). We reproduce the same
// wire format so links stay compatible with the original site.
//
// pako is used for deflate/inflate because the CompressionStream API is not
// available in jsdom and its raw-deflate output needs a zlib envelope anyway.

import { deflateRaw, inflateRaw } from "pako";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64FromBytes(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function bytesFromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Adler-32 checksum (RFC 1950 zlib trailer).
function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (const byte of data) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return (b << 16) | a;
}

/** Encode a list of [slot, itemId] pairs into the site-compatible ab= value. */
export async function encodeBuilder(pairs: Array<[string, number]>): Promise<string> {
  const body = pairs.map(([slot, id]) => `${slot}:${id}`).join(";");
  const raw = encoder.encode(body);
  const deflated = deflateRaw(raw, { level: 9 });
  // Wrap the raw deflate stream in a zlib envelope: 0x78 0xda header + adler32.
  const envelope = new Uint8Array(deflated.length + 6);
  envelope[0] = 0x78;
  envelope[1] = 0xda;
  envelope.set(deflated, 2);
  const adler = adler32(raw);
  envelope[envelope.length - 4] = (adler >>> 24) & 0xff;
  envelope[envelope.length - 3] = (adler >>> 16) & 0xff;
  envelope[envelope.length - 2] = (adler >>> 8) & 0xff;
  envelope[envelope.length - 1] = adler & 0xff;
  return encodeURIComponent(base64FromBytes(envelope));
}

export interface BuilderSlot {
  slot: string;
  itemId: number;
}

/** Decode an ab= value (urlencoded base64 zlib) into [slot, itemId] pairs. */
export async function decodeBuilder(ab: string): Promise<BuilderSlot[]> {
  try {
    const b64 = decodeURIComponent(ab);
    const bytes = bytesFromBase64(b64);
    // Skip the 2-byte zlib header; the adler trailer is ignored by the inflater.
    const deflated = bytes.slice(2);
    let inflated: Uint8Array;
    try {
      inflated = inflateRaw(deflated);
    } catch {
      return [];
    }
    const text = decoder.decode(inflated);
    const pairs: BuilderSlot[] = [];
    for (const part of text.split(";")) {
      const m = part.trim().match(/^([^:]+):(\d+)$/);
      if (m) pairs.push({ slot: m[1], itemId: Number(m[2]) });
    }
    return pairs;
  } catch {
    return [];
  }
}
