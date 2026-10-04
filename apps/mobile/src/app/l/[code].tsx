import { useLocalSearchParams, useRouter } from 'expo-router';
import { useHousehold, useLabel } from '../../api/hooks';
import { useStartScan } from '../../components';
import { LabelAdoptionScreen } from '../../screens/plants/LabelAdoptionScreen';

export default function LabelRoute() {
  const router = useRouter();
  const { code = '' } = useLocalSearchParams<{ code: string }>();
  const label = useLabel(code);
  const household = useHousehold();
  const startScan = useStartScan();
  if (label.data === undefined || !household.data) return null;
  const speciesId = label.data?.species.id;
  return (
    <LabelAdoptionScreen
      label={label.data}
      pets={household.data.pets}
      onAdd={() =>
        router.push({
          pathname: '/plants/setup',
          params: { source: 'label_qr', labelCode: code },
        })
      }
      onScanPlant={startScan}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
      onPetAte={(petId) =>
        router.push({ pathname: '/pet-emergency', params: { petId, speciesId } })
      }
    />
  );
}
