import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking } from 'react-native';
import { useEmergency, usePlant } from '../api/hooks';
import { mapsUrl, telUrl } from '../lib/links';
import { PetEmergencyScreen } from '../screens/emergency/PetEmergencyScreen';

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) || undefined;
const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Opens a link, and shrugs when the device has nothing to open it with (a tablet with no phone). */
const open = (url: string | null) => {
  if (url) void Linking.openURL(url).catch(() => {});
};

export default function PetEmergencyRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ petId: string; plantId?: string; speciesId?: string }>();
  const petId = first(params.petId) ?? '';
  const plantId = first(params.plantId);
  const speciesId = first(params.speciesId);
  const emergency = useEmergency({
    petId,
    ...(plantId ? { plantId } : null),
    ...(speciesId ? { speciesId } : null),
  });
  // The plant's nickname when it came from a plant; the species name when it came from a label.
  const plant = usePlant(plantId ?? '', plantId != null);
  const info = emergency.data;
  if (!info || (plantId && plant.isLoading)) return null;
  const backLabel = plant.data?.nickname ?? capitalise(info.speciesName);
  return (
    <PetEmergencyScreen
      info={info}
      backLabel={backLabel}
      onCallVet={() => open(info.vet ? telUrl(info.vet.phone) : null)}
      onCallPoisonLine={() => open(info.poisonLine ? telUrl(info.poisonLine.phone) : null)}
      onFindVet={() => open(mapsUrl('vet'))}
      onSaveVet={() => router.push('/settings/household')}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
    />
  );
}
