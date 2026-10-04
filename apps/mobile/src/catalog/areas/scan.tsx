import { aoife, type QuotaState } from '@tendril/core';
import { CameraDeniedScreen } from '../../screens/scan/CameraDeniedScreen';
import { CameraScreen } from '../../screens/scan/CameraScreen';
import { GalleryScreen } from '../../screens/scan/GalleryScreen';
import { LabelScanScreen } from '../../screens/scan/LabelScanScreen';
import { LimitSheet } from '../../screens/scan/LimitSheet';
import { ScanTabScreen } from '../../screens/scan/ScanTabScreen';
import { PhotoSlot } from '../../components/PhotoSlot';
import { registerFrame } from '../registry';
import { TabScreenFrame } from '../TabScreenFrame';

/** Frames 2b, 4t, 4u, 4af and 4ag: the camera, its permission and gallery states, and the limit sheet; plus 2b-label. */

const noop = () => {};

// expo-camera cannot run in the catalog's web shots, so the viewfinder is the design's placeholder.
// It is 600 pt tall, as in the frame: the panel covers its lower part.
const viewfinder = <PhotoSlot label="Camera viewfinder" height={600} />;

const diagnosisQuota: QuotaState = {
  kind: 'diagnosis',
  used: 0,
  limit: 1,
  resetsOn: '2026-11-01',
  plan: 'free',
};

registerFrame({
  id: '2b',
  title: 'Camera · leaf chip, 2 of 5 photos, quota meter',
  scheme: 'dark',
  statusBar: 'light',
  render: () => (
    <CameraScreen
      preview={viewfinder}
      quota={aoife.today.identifications}
      organ="leaf"
      // Two photos, drawn as the design's placeholders.
      photos={['', '']}
      healthCheck={false}
      diagnosisQuota={diagnosisQuota}
      onOrgan={noop}
      onShutter={noop}
      onRemovePhoto={noop}
      onGallery={noop}
      onToggleHealth={noop}
      onIdentify={noop}
      onClose={noop}
    />
  ),
});

// The scanner for a plant label has no design frame; it keeps 2b's camera chrome.
registerFrame({
  id: '2b-label',
  title: 'Camera · scanning a plant label',
  scheme: 'dark',
  statusBar: 'light',
  render: () => <LabelScanScreen preview={viewfinder} onClose={noop} />,
});

registerFrame({
  id: '4t',
  title: 'Camera · denied',
  render: () => <CameraDeniedScreen onOpenSettings={noop} onChooseGallery={noop} onClose={noop} />,
});

registerFrame({
  id: '4u',
  title: 'Camera · gallery only',
  render: () => (
    <GalleryScreen
      photos={[]}
      onChoose={noop}
      onRemovePhoto={noop}
      onIdentify={noop}
      onClose={noop}
    />
  ),
});

const limitFree: QuotaState = {
  kind: 'identification',
  used: 10,
  limit: 10,
  resetsOn: '2026-11-01',
  plan: 'free',
};
const withLimit = (quota: QuotaState) => (
  <>
    <TabScreenFrame active="scan">
      <ScanTabScreen avatarLetter="A" onAvatar={noop} />
    </TabScreenFrame>
    <LimitSheet presentation="overlay" visible quota={quota} onTryPremium={noop} onClose={noop} />
  </>
);

registerFrame({
  id: '4af',
  title: 'Limit reached · sheet',
  render: () => withLimit(limitFree),
});

registerFrame({
  id: '4ag',
  title: 'Limit reached · Premium at its cap',
  render: () => withLimit({ ...limitFree, used: 60, limit: 60, plan: 'premium' }),
});
