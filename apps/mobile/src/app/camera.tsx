import {
  cameraCopy,
  limitReachedTitle,
  parseLabelCode,
  type CaptureSource,
  type Organ,
} from '@tendril/core';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Snackbar } from '../components/Snackbar';
import { useIdentify, useQuota } from '../api/hooks';
import { choosePhotos, type PickOutcome } from '../lib/pickPhotos';
import { useScreenFocused } from '../lib/useScreenFocused';
import { CameraDeniedScreen } from '../screens/scan/CameraDeniedScreen';
import { CameraScreen, MAX_PHOTOS } from '../screens/scan/CameraScreen';
import { GalleryScreen } from '../screens/scan/GalleryScreen';
import { LabelScanScreen } from '../screens/scan/LabelScanScreen';
import { LimitSheet } from '../screens/scan/LimitSheet';
import { preparePhoto } from '../services/photos';
import { useTheme } from '../theme';

/** `/camera` scans a plant; `/camera?mode=label` reads a plant label's QR code. */
export default function CameraRoute() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  return mode === 'label' ? <LabelRoute /> : <PlantCameraRoute />;
}

/** Where the label QR codes point. A staging build sets EXPO_PUBLIC_WEB_HOST. */
const webHost = () => process.env.EXPO_PUBLIC_WEB_HOST || 'tendril.app';

/** What the camera permission allows: still asking, granted, or off. */
function useCameraAccess(): 'loading' | 'granted' | 'denied' {
  const [permission, request] = useCameraPermissions();
  const undetermined =
    permission != null && !permission.granted && permission.status === 'undetermined';
  useEffect(() => {
    if (undetermined) void request();
  }, [undetermined, request]);
  if (permission == null || undetermined) return 'loading';
  return permission.granted ? 'granted' : 'denied';
}

function useLeave() {
  const router = useRouter();
  return useCallback(
    () => (router.canGoBack() ? router.back() : router.replace('/today')),
    [router],
  );
}

/** The black behind a camera that is not running (loading, or the screen is not in front). */
function Dark() {
  const { c } = useTheme();
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: c.background }]} />;
}

interface Taken {
  uri: string;
  organ: Organ;
  source: CaptureSource;
}

function PlantCameraRoute() {
  const router = useRouter();
  const leave = useLeave();
  const access = useCameraAccess();
  const focused = useScreenFocused();
  const quota = useQuota('identification');
  const diagnosisQuota = useQuota('diagnosis');
  const identify = useIdentify();
  const camera = useRef<CameraView>(null);
  const capturing = useRef(false);
  const identifying = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Taken[]>([]);
  const [organ, setOrgan] = useState<Organ>('leaf');
  const [healthCheck, setHealthCheck] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [galleryOnly, setGalleryOnly] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  const room = MAX_PHOTOS - photos.length;
  const atCap = quota.data != null && quota.data.used >= quota.data.limit;

  const add = async (
    items: { uri: string; width: number; height: number }[],
    source: CaptureSource,
    organ: Organ,
  ) => {
    try {
      const prepared = await Promise.all(items.map((i) => preparePhoto(i.uri, i.width, i.height)));
      setError(null);
      setPhotos((have) =>
        [...have, ...prepared.map((p): Taken => ({ uri: p.uri, organ, source }))].slice(
          0,
          MAX_PHOTOS,
        ),
      );
    } catch {
      setError(cameraCopy.photoFailed);
    }
  };

  const shutter = async () => {
    if (room <= 0 || capturing.current || !camera.current) return;
    capturing.current = true;
    // The organ chosen now, not whatever it is by the time the photo is ready.
    const pressedOrgan = organ;
    try {
      const picture = await camera.current.takePictureAsync();
      await add([picture], 'camera', pressedOrgan);
    } catch {
      setError(cameraCopy.photoFailed);
    } finally {
      capturing.current = false;
    }
  };

  const gallery = async () => {
    if (room <= 0) return;
    const outcome: PickOutcome = await choosePhotos(room);
    if (outcome.status === 'picked') await add(outcome.assets, 'gallery', organ);
  };

  const identifyNow = async () => {
    // At the cap the Limit reached sheet is already up; nothing is sent.
    if (atCap || photos.length === 0 || identifying.current) return;
    identifying.current = true;
    setError(null);
    const withHealth =
      healthCheck &&
      !(diagnosisQuota.data && diagnosisQuota.data.used >= diagnosisQuota.data.limit);
    try {
      const result = await identify.mutateAsync({
        photoUris: photos.map((p) => p.uri),
        organs: photos.map((p) => p.organ),
        captureSource: photos.some((p) => p.source === 'gallery') ? 'gallery' : 'camera',
        healthCheck: withHealth,
      });
      router.replace(`/scan/${result.observationId}`);
    } catch (e) {
      if (e instanceof Error && e.message === 'quota_exceeded') {
        // The server refused: a month used up elsewhere. If it is identifications, the refreshed
        // quota opens the sheet; if only the diagnosis, the scan can still go without a health check.
        const [ident, diagnosis] = await Promise.all([quota.refetch(), diagnosisQuota.refetch()]);
        const identCapped = ident.data != null && ident.data.used >= ident.data.limit;
        if (!identCapped && withHealth && diagnosis.data) {
          setHealthCheck(false);
          setNotice(limitReachedTitle('diagnosis', diagnosis.data.plan, diagnosis.data.limit));
        }
      } else setError(cameraCopy.identifyFailed);
    } finally {
      identifying.current = false;
    }
  };

  const remove = (index: number) => setPhotos((have) => have.filter((_, at) => at !== index));

  let screen;
  if (access === 'denied' && galleryOnly) {
    screen = (
      <GalleryScreen
        photos={photos.map((p) => p.uri)}
        busy={identify.isPending}
        error={error}
        onChoose={() => void gallery()}
        onRemovePhoto={remove}
        onIdentify={() => void identifyNow()}
        onClose={leave}
      />
    );
  } else if (access === 'denied') {
    screen = (
      <CameraDeniedScreen
        onOpenSettings={() => void Linking.openSettings()}
        onChooseGallery={() => {
          setGalleryOnly(true);
          void gallery();
        }}
        onClose={leave}
      />
    );
  } else if (!quota.data || !diagnosisQuota.data) {
    screen = <Dark />;
  } else {
    screen = (
      <CameraScreen
        preview={
          access === 'granted' && focused ? (
            <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" />
          ) : (
            <Dark />
          )
        }
        quota={quota.data}
        organ={organ}
        photos={photos.map((p) => p.uri)}
        healthCheck={healthCheck}
        diagnosisQuota={diagnosisQuota.data}
        busy={identify.isPending}
        error={error}
        onOrgan={setOrgan}
        onShutter={() => void shutter()}
        onRemovePhoto={remove}
        onGallery={() => void gallery()}
        onToggleHealth={setHealthCheck}
        onIdentify={() => void identifyNow()}
        onClose={leave}
      />
    );
  }
  return (
    <>
      <StatusBar style={access === 'denied' ? 'auto' : 'light'} />
      {screen}
      {notice ? <Snackbar text={notice} /> : null}
      {atCap && quota.data ? (
        <LimitSheet
          visible
          quota={quota.data}
          onTryPremium={() => router.push('/paywall')}
          onClose={leave}
        />
      ) : null}
    </>
  );
}

function LabelRoute() {
  const router = useRouter();
  const leave = useLeave();
  const access = useCameraAccess();
  const focused = useScreenFocused();
  const [notTendril, setNotTendril] = useState(false);
  const opened = useRef(false);
  const clear = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (clear.current && clearTimeout(clear.current)), []);

  const onScanned = ({ data }: { data: string }) => {
    if (opened.current) return;
    const code = parseLabelCode(data, webHost());
    if (code) {
      opened.current = true;
      router.replace(`/l/${code}`);
      return;
    }
    // The scanner reports the same code many times a second: show the note while it stays in
    // view and for a moment after.
    setNotTendril(true);
    if (clear.current) clearTimeout(clear.current);
    clear.current = setTimeout(() => setNotTendril(false), 3000);
  };

  if (access === 'denied') {
    return (
      <CameraDeniedScreen
        body={cameraCopy.deniedLabelBody}
        onOpenSettings={() => void Linking.openSettings()}
        onClose={leave}
      />
    );
  }
  return (
    <>
      <StatusBar style="light" />
      <LabelScanScreen
        preview={
          access === 'granted' && focused ? (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={onScanned}
            />
          ) : (
            <Dark />
          )
        }
        notTendrilLabel={notTendril}
        onClose={leave}
      />
    </>
  );
}
