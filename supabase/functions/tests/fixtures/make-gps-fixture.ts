// Regenerates the JPEG fixtures (1x1, Dublin coordinates):
//   deno run --config supabase/functions/deno.json --allow-write supabase/functions/tests/fixtures/make-gps-fixture.ts
//   gps.jpg   Exif GPS latitude and longitude (via piexifjs)
//   xmp.jpg   XMP APP1 segment with exif:GPSLatitude/GPSLongitude, plus an IPTC APP13 and a COM segment
//   plain.jpg no metadata at all
import piexif from 'piexifjs';

const BASE_B64 =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
const base = Uint8Array.from(atob(BASE_B64), (c) => c.charCodeAt(0));
const plain = new Uint8Array([...base, 0xff, 0xd9]); // base lacks EOI

const toBytes = (dataUrl: string) =>
  Uint8Array.from(atob(dataUrl.split(',')[1]), (c) => c.charCodeAt(0));
const toDataUrl = (b: Uint8Array) => `data:image/jpeg;base64,${btoa(String.fromCharCode(...b))}`;

const exif = piexif.dump({
  GPS: {
    [piexif.GPSIFD.GPSLatitudeRef]: 'N',
    [piexif.GPSIFD.GPSLatitude]: [
      [53, 1],
      [21, 1],
      [0, 1],
    ],
    [piexif.GPSIFD.GPSLongitudeRef]: 'W',
    [piexif.GPSIFD.GPSLongitude]: [
      [6, 1],
      [15, 1],
      [36, 1],
    ],
  },
});
const gps = toBytes(piexif.insert(exif, toDataUrl(plain)));

function segment(marker: number, payload: Uint8Array): Uint8Array {
  const len = payload.length + 2;
  return new Uint8Array([0xff, marker, len >> 8, len & 0xff, ...payload]);
}
const enc = new TextEncoder();
const xmpText =
  '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/">' +
  '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:exif="http://ns.adobe.com/exif/1.0/" ' +
  'exif:GPSLatitude="53,21.0N" exif:GPSLongitude="6,15.6W"/></rdf:RDF></x:xmpmeta><?xpacket end="w"?>';
const xmp = segment(0xe1, enc.encode(`http://ns.adobe.com/xap/1.0/\0${xmpText}`));
const iptc = segment(0xed, enc.encode('Photoshop 3.0\0'));
const com = segment(0xfe, enc.encode('taken at home'));
// SOI, JFIF (APP0), then the metadata segments, then the rest.
const jfifEnd = 2 + 2 + ((base[4] << 8) | base[5]);
const withXmp = new Uint8Array([
  ...plain.subarray(0, jfifEnd),
  ...xmp,
  ...iptc,
  ...com,
  ...plain.subarray(jfifEnd),
]);

const dir = new URL('./', import.meta.url);
await Deno.writeFile(new URL('gps.jpg', dir), gps);
await Deno.writeFile(new URL('xmp.jpg', dir), withXmp);
await Deno.writeFile(new URL('plain.jpg', dir), plain);
