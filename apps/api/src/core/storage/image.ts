import { HttpError } from "../../utils/http.js";

const MAX_BYTES = 1_000_000;
const MIN_EDGE = 16;

export interface SniffedImage {
  mime: "image/png" | "image/jpeg" | "image/webp";
  extension: ".png" | ".jpg" | ".webp";
  width: number;
  height: number;
}

export function sniffRasterImage(buffer: Buffer): SniffedImage {
  if (buffer.length > MAX_BYTES) {
    throw new HttpError(400, "Image must be 1 MB or smaller");
  }
  if (buffer.length < 24) {
    throw new HttpError(400, "File is too small to be a valid image");
  }

  let sniffed: SniffedImage | null = null;
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    sniffed = {
      mime: "image/png",
      extension: ".png",
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  } else if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    const size = jpegSize(buffer);
    sniffed = { mime: "image/jpeg", extension: ".jpg", ...size };
  } else if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    sniffed = { mime: "image/webp", extension: ".webp", ...webpSize(buffer) };
  }

  if (!sniffed) {
    throw new HttpError(400, "Only PNG, JPEG and WebP logos are accepted (SVG and PDF are refused)");
  }
  if (sniffed.width < MIN_EDGE || sniffed.height < MIN_EDGE) {
    throw new HttpError(400, `Image must be at least ${MIN_EDGE}×${MIN_EDGE} pixels`);
  }
  return sniffed;
}

function jpegSize(buffer: Buffer): { width: number; height: number } {
  let offset = 2;
  while (offset < buffer.length - 8) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    // SOF0 / SOF2
    if (marker === 0xc0 || marker === 0xc2) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  throw new HttpError(400, "Could not read JPEG dimensions");
}

function webpSize(buffer: Buffer): { width: number; height: number } {
  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8X" && buffer.length >= 30) {
    const width = 1 + buffer.readUIntLE(24, 3);
    const height = 1 + buffer.readUIntLE(27, 3);
    return { width, height };
  }
  if (chunk === "VP8 " && buffer.length >= 30) {
    return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === "VP8L" && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  throw new HttpError(400, "Could not read WebP dimensions");
}
