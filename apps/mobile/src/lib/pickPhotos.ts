import * as ImagePicker from 'expo-image-picker';

/** What picking a photo came to: photos, nothing (the person backed out), or no permission. */
export type PickOutcome =
  { status: 'picked'; uris: string[] } | { status: 'cancelled' } | { status: 'denied' };

const OPTIONS = { mediaTypes: ['images' as const], quality: 0.8 };

const outcome = (result: ImagePicker.ImagePickerResult): PickOutcome =>
  result.canceled || result.assets.length === 0
    ? { status: 'cancelled' }
    : { status: 'picked', uris: result.assets.map((asset) => asset.uri) };

/** One photo from the camera. Asks for camera access the first time. */
export async function takePhoto(): Promise<PickOutcome> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return { status: 'denied' };
  return outcome(await ImagePicker.launchCameraAsync(OPTIONS));
}

/** Up to `max` photos from the library. The system picker needs no permission of ours. */
export async function choosePhotos(max: number): Promise<PickOutcome> {
  return outcome(
    await ImagePicker.launchImageLibraryAsync({
      ...OPTIONS,
      allowsMultipleSelection: max > 1,
      selectionLimit: max,
    }),
  );
}
