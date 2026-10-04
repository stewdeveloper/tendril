declare module 'piexifjs' {
  /** Binary strings (one char per byte) in and out; no types ship with the package. */
  export function remove(jpeg: string): string;
  export function load(jpeg: string): Record<string, unknown>;
  export function dump(exif: Record<string, unknown>): string;
  export function insert(exif: string, jpeg: string): string;
  export const GPSIFD: Record<string, number>;
  export const ImageIFD: Record<string, number>;
  const piexif: {
    remove: typeof remove;
    load: typeof load;
    dump: typeof dump;
    insert: typeof insert;
    GPSIFD: typeof GPSIFD;
    ImageIFD: typeof ImageIFD;
  };
  export default piexif;
}
