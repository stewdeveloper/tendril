import { latLngToCell } from 'h3-js';

export function toBigint(cell: string): bigint {
  return BigInt(`0x${cell}`);
}

/** Resolution 7 and 5 cells for a point, as bigints for the DB plus the r5 hex string. */
export function cellsFor(lat: number, lng: number): { r7: bigint; r5: bigint; r5Hex: string } {
  const r7 = latLngToCell(lat, lng, 7);
  const r5Hex = latLngToCell(lat, lng, 5);
  return { r7: toBigint(r7), r5: toBigint(r5Hex), r5Hex };
}
