import { cellToLatLng, isValidCell, latLngToCell } from 'h3-js';

export function toBigint(cell: string): bigint {
  return BigInt(`0x${cell}`);
}

/** Resolution 7 and 5 cells for a point, as bigints for the DB plus the r5 hex string. */
export function cellsFor(lat: number, lng: number): { r7: bigint; r5: bigint; r5Hex: string } {
  const r7 = latLngToCell(lat, lng, 7);
  const r5Hex = latLngToCell(lat, lng, 5);
  return { r7: toBigint(r7), r5: toBigint(r5Hex), r5Hex };
}

/**
 * A point's resolution-7 weather cell as decimal text. Cells are above 2^53, so they cross PostgREST as text and
 * the database casts them to bigint.
 */
export function cellR7Text(lat: number, lng: number): string {
  return toBigint(latLngToCell(lat, lng, 7)).toString();
}

const round3 = (n: number) => Math.round(n * 1000) / 1000 + 0; // + 0 turns -0 into 0

/** The centre of a cell given as decimal text, to 3 decimal places: the only point a weather provider sees. */
export function cellCentre(cell: string): { lat: number; lng: number } {
  if (!/^\d{1,20}$/.test(cell)) throw new Error('not a decimal cell id');
  const hex = BigInt(cell).toString(16);
  if (!isValidCell(hex)) throw new Error('not a valid cell');
  const [lat, lng] = cellToLatLng(hex);
  return { lat: round3(lat), lng: round3(lng) };
}
