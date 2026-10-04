// Regenerates gps.jpg: a 1x1 JPEG carrying GPS latitude and longitude (Dublin).
//   deno run --config supabase/functions/deno.json --allow-write supabase/functions/tests/fixtures/make-gps-fixture.ts
import piexif from 'piexifjs';

const BASE =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

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
const dataUrl = piexif.insert(exif, BASE);
const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (c) => c.charCodeAt(0));
await Deno.writeFile(new URL('./gps.jpg', import.meta.url), bytes);
