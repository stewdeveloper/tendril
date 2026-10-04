import { CryptoDigestAlgorithm, digest } from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** The most pixels a photo sent for identification has: about a 1600 x 1250 picture. */
export const MAX_PHOTO_PIXELS = 2_000_000;
const JPEG_QUALITY = 0.85;

export interface PreparedPhoto {
  /** A local JPEG file, at most `MAX_PHOTO_PIXELS`. */
  uri: string;
  base64: string;
  /** Hex SHA-256 of the JPEG's bytes: the upload's content address. */
  sha256: string;
  width: number;
  height: number;
}

const bytesOf = (base64: string): Uint8Array<ArrayBuffer> => {
  const text = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(text.length));
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
  return bytes;
};
const hex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');

/**
 * Gets a photo ready to send: shrunk to at most 2,000,000 pixels (never enlarged, shape kept),
 * saved as a JPEG at 0.85, with its base64 and the SHA-256 of its bytes.
 */
export async function preparePhoto(
  uri: string,
  width: number,
  height: number,
): Promise<PreparedPhoto> {
  const context = ImageManipulator.manipulate(uri);
  if (width * height > MAX_PHOTO_PIXELS) {
    // Scaling the width alone keeps the shape. Floored, so rounding never goes over the limit.
    const scale = Math.sqrt(MAX_PHOTO_PIXELS / (width * height));
    context.resize({ width: Math.floor(width * scale) });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({
    format: SaveFormat.JPEG,
    compress: JPEG_QUALITY,
    base64: true,
  });
  if (!saved.base64) throw new Error('The photo could not be encoded.');
  const sha256 = hex(await digest(CryptoDigestAlgorithm.SHA256, bytesOf(saved.base64)));
  return { uri: saved.uri, base64: saved.base64, sha256, width: saved.width, height: saved.height };
}
