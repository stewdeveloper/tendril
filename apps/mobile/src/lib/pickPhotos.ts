import { cameraCopy } from '@tendril/core';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';

/** A picked photo and its size in pixels, which `preparePhoto` needs to shrink it. */
export interface PickedAsset {
  uri: string;
  width: number;
  height: number;
}

/**
 * What picking a photo came to: photos, nothing (the person backed out), or no permission.
 * `uris` is `assets` without the sizes, for callers that only show or send the photos.
 */
export type PickOutcome =
  | { status: 'picked'; uris: string[]; assets: PickedAsset[] }
  | { status: 'cancelled' }
  | { status: 'denied' };

const OPTIONS = { mediaTypes: ['images' as const], quality: 0.8 };

const outcome = (result: ImagePicker.ImagePickerResult): PickOutcome =>
  result.canceled || result.assets.length === 0
    ? { status: 'cancelled' }
    : {
        status: 'picked',
        uris: result.assets.map((asset) => asset.uri),
        assets: result.assets.map(({ uri, width, height }) => ({ uri, width, height })),
      };

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

/**
 * One photo, from wherever the person prefers: the system asks "Take a photo" or "Choose from
 * library" (the browser has no camera to ask for, so it opens its file picker). Backing out of the
 * question is a cancel.
 */
export async function pickOnePhoto(): Promise<PickOutcome> {
  if (Platform.OS === 'web') return choosePhotos(1);
  const source = await new Promise<'camera' | 'library' | null>((resolve) => {
    Alert.alert(
      cameraCopy.addPhoto,
      undefined,
      [
        { text: cameraCopy.photoSourceTake, onPress: () => resolve('camera') },
        { text: cameraCopy.photoSourceChoose, onPress: () => resolve('library') },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
  if (source === 'camera') return takePhoto();
  if (source === 'library') return choosePhotos(1);
  return { status: 'cancelled' };
}
